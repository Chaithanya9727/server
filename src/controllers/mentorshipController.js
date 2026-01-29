import User from "../models/User.js";
import Session from "../models/Session.js";
import AuditLog from "../models/AuditLog.js";
import { notifyUser } from "../utils/notifyUser.js";

// 📌 Get All Approved Mentors
export const getMentors = async (req, res) => {
  try {
    const { expertise, search } = req.query;
    const query = { role: "mentor", mentorApproved: true };

    if (expertise) {
      query["mentorProfile.expertise"] = { $regex: expertise, $options: "i" };
    }
    if (search) {
      query.$text = { $search: search }; 
    }

    const mentors = await User.find(query)
      .select("name avatar email mentorProfile")
      .lean();

    // Aggregate ratings for each mentor
    const mentorsWithRatings = await Promise.all(mentors.map(async (m) => {
       const stats = await Session.aggregate([
          { $match: { mentor: m._id, status: "completed", rating: { $gt: 0 } } },
          { $group: { _id: "$mentor", avgRating: { $avg: "$rating" }, totalReviews: { $sum: 1 } } }
       ]);
       return { 
          ...m, 
          averageRating: stats[0]?.avgRating?.toFixed(1) || "New", 
          totalReviews: stats[0]?.totalReviews || 0 
       };
    }));

    res.json(mentorsWithRatings);
  } catch (err) {
    console.error("Fetch mentors error:", err);
    res.status(500).json({ message: "Error fetching mentors" });
  }
};

// 📌 Get Specific Mentor Details
export const getMentorById = async (req, res) => {
  try {
    const mentor = await User.findById(req.params.id)
      .select("-password")
      .lean();
      
    if (!mentor || mentor.role !== "mentor") {
      return res.status(404).json({ message: "Mentor not found" });
    }

    // Get Reviews
    const reviews = await Session.find({ mentor: mentor._id, status: "completed", rating: { $gt: 0 } })
       .populate("mentee", "name avatar")
       .select("rating review mentee createdAt")
       .sort({ createdAt: -1 })
       .limit(10);
    
    // Calculate Average
    const stats = await Session.aggregate([
        { $match: { mentor: mentor._id, status: "completed", rating: { $gt: 0 } } },
        { $group: { _id: "$mentor", avgRating: { $avg: "$rating" }, totalReviews: { $sum: 1 } } }
    ]);

    res.json({ 
       ...mentor, 
       averageRating: stats[0]?.avgRating?.toFixed(1) || "New",
       totalReviews: stats[0]?.totalReviews || 0,
       reviews 
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// 📌 Update Mentor Services & Availability
export const updateMentorSettings = async (req, res) => {
  try {
    const { services, availability, bio, experience, expertise, company } = req.body;
    const user = await User.findById(req.user._id);

    // Patch mentor profile
    if (services) user.mentorProfile.services = services;
    if (availability) user.mentorProfile.availability = availability;
    if (bio !== undefined) user.mentorProfile.bio = bio;
    if (experience !== undefined) user.mentorProfile.experience = experience;
    if (expertise !== undefined) user.mentorProfile.expertise = expertise;
    if (company !== undefined) user.mentorProfile.company = company;

    await user.save();
    res.json({ message: "Mentor settings updated ✅", mentorProfile: user.mentorProfile });
  } catch (err) {
    console.error("Update mentor settings error:", err);
    res.status(500).json({ message: "Error updating settings" });
  }
};

// 📌 Book a Session
export const bookSession = async (req, res) => {
  try {
    const { mentorId, serviceTitle, serviceType, price, duration, scheduledDate, scheduledTime, notes } = req.body;

    const mentor = await User.findById(mentorId);
    if (!mentor || mentor.role !== "mentor") return res.status(404).json({ message: "Mentor not found" });

    // Create Booking
    const session = await Session.create({
      mentor: mentorId,
      mentee: req.user._id,
      serviceTitle,
      serviceType,
      price,
      duration,
      scheduledDate,
      scheduledTime,
      notes,
      status: "pending", 
      meetingLink: "", 
    });

    await AuditLog.create({
      action: "BOOK_MENTORSHIP",
      performedBy: req.user._id,
      targetUser: mentorId,
      details: `Booked session: ${serviceTitle} on ${scheduledDate} @ ${scheduledTime}`,
    });

    // Notify Mentor (DB + Socket + Email)
    await notifyUser({
       userId: mentor._id,
       email: mentor.email,
       title: "New Mentorship Request",
       message: `Request from ${req.user.name}: ${serviceTitle} on ${new Date(scheduledDate).toDateString()}.`,
       link: `/dashboard/mentorship`,
       type: "mentorship",
       emailEnabled: true,
       emailSubject: "New Session Request - OneStop",
       emailHtml: `
          <div style="font-family: sans-serif; padding: 20px;">
            <h2 style="color: #2563EB;">New Mentorship Request</h2>
            <p>You have received a new booking request from <strong>${req.user.name}</strong>.</p>
            <div style="background: #f1f5f9; padding: 15px; border-radius: 8px; margin: 15px 0;">
              <p><strong>Service:</strong> ${serviceTitle} (${serviceType})</p>
              <p><strong>Date:</strong> ${new Date(scheduledDate).toDateString()}</p>
              <p><strong>Time:</strong> ${scheduledTime}</p>
              <p><strong>Duration:</strong> ${duration} mins</p>
              <p><strong>Price:</strong> ₹${price}</p>
              <p><strong>Note:</strong> ${notes || "N/A"}</p>
            </div>
            <p>Please log in to your dashboard to Accept or Decline this request.</p>
            <a href="${process.env.CLIENT_URL || 'https://onestopfrontend.vercel.app'}/dashboard" style="display: inline-block; padding: 10px 20px; background: #2563EB; color: white; text-decoration: none; border-radius: 5px;">Go to Dashboard</a>
          </div>
       `
    });

    res.status(201).json({ message: "Session requested successfully! Notification sent (In-App + Email).", session });
  } catch (err) {
    console.error("Booking error:", err);
    res.status(500).json({ message: "Booking failed" });
  }
};

// 📌 Submit Review
export const reviewSession = async (req, res) => {
  try {
    const { rating, review } = req.body;
    const session = await Session.findById(req.params.id);

    if (!session) return res.status(404).json({ message: "Session not found" });
    if (session.mentee.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized to review this session" });
    }
    if (session.status !== "completed") {
      return res.status(400).json({ message: "Can only review completed sessions" });
    }

    session.rating = rating;
    session.review = review;
    await session.save();

    // Log the review
    await AuditLog.create({
      action: "REVIEW_MENTOR",
      performedBy: req.user._id,
      targetUser: session.mentor,
      details: `Rated ${rating} stars: ${review}`,
    });

    res.json({ message: "Review submitted successfully ✅", session });
  } catch (err) {
    console.error("Review error:", err);
    res.status(500).json({ message: "Error submitting review" });
  }
};

// 📌 Get My Sessions
export const getMySessions = async (req, res) => {
  try {
    const isMentor = req.user.role === "mentor";
    const query = isMentor ? { mentor: req.user._id } : { mentee: req.user._id };
    
    const sessions = await Session.find(query)
      .populate("mentee", "name avatar email")
      .populate("mentor", "name avatar email mentorProfile")
      .sort({ createdAt: -1 });

    res.json(sessions);
  } catch (err) {
    console.error("Fetch sessions error:", err);
    res.status(500).json({ message: "Error fetching sessions" });
  }
};

// 📌 Update Session Status
export const updateSessionStatus = async (req, res) => {
  try {
    const { status, meetingLink } = req.body; // status: confirmed, completed, cancelled
    const session = await Session.findById(req.params.id).populate("mentee", "name email").populate("mentor", "name email");

    if (!session) return res.status(404).json({ message: "Session not found" });
    
    // Authorization Check
    if (req.user.role !== "superadmin" && session.mentor._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    session.status = status;
    if (meetingLink) session.meetingLink = meetingLink;
    
    await session.save();

    // Notify Mentee (DB + Socket + Email)
    let emailSubject = `Session Update: ${status.toUpperCase()}`;
    let emailHtml = "";
    
    if (status === "confirmed") {
       emailSubject = "✅ Mentorship Session Confirmed!";
       emailHtml = `
         <h2>Your session has been confirmed!</h2>
         <p><strong>Mentor:</strong> ${session.mentor.name}</p>
         <p><strong>Topic:</strong> ${session.serviceTitle}</p>
         <p><strong>Time:</strong> ${new Date(session.scheduledDate).toDateString()} @ ${session.scheduledTime}</p>
         ${meetingLink ? `<p><strong>Join Link:</strong> <a href="${meetingLink}">${meetingLink}</a></p>` : ''}
         <p>Please be ready 5 minutes before the session.</p>
       `;
    } else if (status === "cancelled") {
       emailSubject = "❌ Session Cancelled";
       emailHtml = `
         <h2>Your session was cancelled.</h2>
         <p>The mentor <strong>${session.mentor.name}</strong> was unable to accept your request at this time.</p>
         <p>Please try booking another slot.</p>
       `;
    } else if (status === "completed") {
       emailSubject = "🎉 Session Completed";
       emailHtml = `
         <h2>Session Completed</h2>
         <p>Your session with <strong>${session.mentor.name}</strong> has been marked as complete.</p>
         <p>We hope it was helpful!</p>
       `;
    }

    await notifyUser({
       userId: session.mentee._id,
       email: session.mentee.email,
       title: `Session ${status.charAt(0).toUpperCase() + status.slice(1)}`,
       message: `Your session with ${session.mentor.name} is now ${status}.`,
       link: `/mentorship/my-sessions`,
       type: "mentorship",
       emailEnabled: true,
       emailSubject,
       emailHtml
    });

    res.json(session);
  } catch (err) {
    console.error("Update session error:", err);
    res.status(500).json({ message: "Error updating session" });
  }
};

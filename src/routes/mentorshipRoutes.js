import express from "express";
import User from "../models/User.js";
import Session from "../models/Session.js";
import { protect } from "../middleware/auth.js";
import { authorize } from "../middleware/authorize.js";
import AuditLog from "../models/AuditLog.js";
import { sendEmail } from "../utils/sendEmail.js";

const router = express.Router();

// 📌 Get All Approved Mentors (Public/Protected)
router.get("/list", protect, async (req, res) => {
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

    // Calculate rating logic here if needed later
    res.json(mentors);
  } catch (err) {
    console.error("Fetch mentors error:", err);
    res.status(500).json({ message: "Error fetching mentors" });
  }
});

// 📌 Get Specific Mentor Details (Public/Protected)
router.get("/:id", protect, async (req, res) => {
  try {
    const mentor = await User.findById(req.params.id)
      .select("-password")
      .lean();
      
    if (!mentor || mentor.role !== "mentor") {
      return res.status(404).json({ message: "Mentor not found" });
    }
    res.json(mentor);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

/* ============================
   📅 Availability & Services
   ============================ */

// 📌 Update Mentor Services & Availability (Mentor Only)
router.put("/settings", protect, authorize(["mentor"]), async (req, res) => {
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
});

/* ============================
   🤝 Booking Sessions
   ============================ */

// ... imports

// ... imports
import { notifyUser } from "../utils/notifyUser.js"; // Import notifyUser

// 📌 Book a Session (Candidate -> Mentor)
router.post("/book", protect, authorize(["candidate"]), async (req, res) => {
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
            <a href="http://localhost:5173/dashboard" style="display: inline-block; padding: 10px 20px; background: #2563EB; color: white; text-decoration: none; border-radius: 5px;">Go to Dashboard</a>
          </div>
       `
    });

    res.status(201).json({ message: "Session requested successfully! Notification sent (In-App + Email).", session });
  } catch (err) {
    console.error("Booking error:", err);
    res.status(500).json({ message: "Booking failed" });
  }
});

// 📌 Get My Sessions (As Mentor or Mentee)
router.get("/sessions/my", protect, async (req, res) => {
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
});

// 📌 Update Session Status (Mentor: Confirm/Cancel/Complete)
router.patch("/sessions/:id/status", protect, authorize(["mentor", "superadmin"]), async (req, res) => {
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
});

export default router;

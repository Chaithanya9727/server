import User from "../models/User.js";
import Session from "../models/Session.js";

/* =====================================================
   📋 UPDATE MENTOR SERVICES
===================================================== */
export const updateServices = async (req, res) => {
  try {
    const mentor = await User.findById(req.user._id);
    if (!mentor || !mentor.mentorApproved) {
      return res.status(403).json({ message: "Not authorized as mentor" });
    }

    const { services } = req.body;
    
    // Validate services structure
    if (!Array.isArray(services)) {
      return res.status(400).json({ message: "Services must be an array" });
    }

    mentor.mentorProfile.services = services.map(service => ({
      title: service.title,
      type: service.type,
      price: parseFloat(service.price) || 0,
      duration: parseInt(service.duration) || 30,
      description: service.description || "",
      isActive: service.isActive !== false
    }));

    await mentor.save();

    res.json({ 
      message: "Services updated successfully ✅",
      services: mentor.mentorProfile.services 
    });
  } catch (err) {
    console.error("updateServices error:", err);
    res.status(500).json({ message: "Error updating services" });
  }
};

/* =====================================================
   🗓️ UPDATE MENTOR AVAILABILITY
===================================================== */
export const updateAvailability = async (req, res) => {
  try {
    const mentor = await User.findById(req.user._id);
    if (!mentor || !mentor.mentorApproved) {
      return res.status(403).json({ message: "Not authorized as mentor" });
    }

    const { availability, bufferTime, maxSessionsPerDay, isAvailable } = req.body;

    if (availability) {
      mentor.mentorProfile.availability = availability.map(day => ({
        day: day.day,
        slots: day.slots.map(slot => ({
          startTime: slot.startTime,
          endTime: slot.endTime,
          isBooked: slot.isBooked || false
        }))
      }));
    }

    if (bufferTime !== undefined) {
      mentor.mentorProfile.bufferTime = parseInt(bufferTime);
    }

    if (maxSessionsPerDay !== undefined) {
      mentor.mentorProfile.maxSessionsPerDay = parseInt(maxSessionsPerDay);
    }

    if (isAvailable !== undefined) {
      mentor.mentorProfile.isAvailable = Boolean(isAvailable);
    }

    await mentor.save();

    res.json({ 
      message: "Availability updated successfully ✅",
      availability: mentor.mentorProfile.availability,
      settings: {
        bufferTime: mentor.mentorProfile.bufferTime,
        maxSessionsPerDay: mentor.mentorProfile.maxSessionsPerDay,
        isAvailable: mentor.mentorProfile.isAvailable
      }
    });
  } catch (err) {
    console.error("updateAvailability error:", err);
    res.status(500).json({ message: "Error updating availability" });
  }
};

/* =====================================================
   👤 UPDATE EXTENDED MENTOR PROFILE
===================================================== */
export const updateExtendedProfile = async (req, res) => {
  try {
    const mentor = await User.findById(req.user._id);
    if (!mentor || !mentor.mentorApproved) {
      return res.status(403).json({ message: "Not authorized as mentor" });
    }

    const { 
      profilePhoto, videoIntro, languages, timezone, 
      hourlyRate, achievements, certifications 
    } = req.body;

    if (profilePhoto) mentor.mentorProfile.profilePhoto = profilePhoto;
    if (videoIntro) mentor.mentorProfile.videoIntro = videoIntro;
    if (languages) mentor.mentorProfile.languages = languages;
    if (timezone) mentor.mentorProfile.timezone = timezone;
    if (hourlyRate !== undefined) mentor.mentorProfile.hourlyRate = parseFloat(hourlyRate);
    if (achievements) mentor.mentorProfile.achievements = achievements;
    if (certifications) mentor.mentorProfile.certifications = certifications;

    await mentor.save();

    res.json({ 
      message: "Profile updated successfully ✅",
      profile: mentor.mentorProfile 
    });
  } catch (err) {
    console.error("updateExtendedProfile error:", err);
    res.status(500).json({ message: "Error updating profile" });
  }
};

/* =====================================================
   📊 GET MENTOR EARNINGS & STATS
===================================================== */
export const getMentorStats = async (req, res) => {
  try {
    const mentor = await User.findById(req.user._id);
    if (!mentor || !mentor.mentorApproved) {
      return res.status(403).json({ message: "Not authorized as mentor" });
    }

    // Get all completed sessions
    const completedSessions = await Session.find({
      mentor: req.user._id,
      status: "completed"
    }).populate("mentee", "name email").sort({ scheduledTime: -1 });

    // Calculate stats
    const totalEarnings = completedSessions.reduce((sum, session) => sum + (session.price || 0), 0);
    const totalSessions = completedSessions.length;

    // Monthly breakdown (last 6 months)
    const monthlyData = {};
    const now = new Date();
    
    for (let i = 0; i < 6; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = date.toISOString().slice(0, 7); // "2024-01"
      monthlyData[monthKey] = { earnings: 0, sessions: 0 };
    }

    completedSessions.forEach(session => {
      const monthKey = new Date(session.scheduledTime).toISOString().slice(0, 7);
      if (monthlyData[monthKey]) {
        monthlyData[monthKey].earnings += session.price || 0;
        monthlyData[monthKey].sessions += 1;
      }
    });

    // Get average rating
    const sessionsWithRating = completedSessions.filter(s => s.rating);
    const averageRating = sessionsWithRating.length > 0
      ? sessionsWithRating.reduce((sum, s) => sum + s.rating, 0) / sessionsWithRating.length
      : 0;

    // Service popularity
    const serviceStats = {};
    completedSessions.forEach(session => {
      const serviceType = session.serviceType || "Unknown";
      if (!serviceStats[serviceType]) {
        serviceStats[serviceType] = { count: 0, earnings: 0 };
      }
      serviceStats[serviceType].count += 1;
      serviceStats[serviceType].earnings += session.price || 0;
    });

    res.json({
      totalEarnings,
      totalSessions,
      averageRating: averageRating.toFixed(1),
      totalReviews: sessionsWithRating.length,
      monthlyData,
      serviceStats,
      recentSessions: completedSessions.slice(0, 10)
    });
  } catch (err) {
    console.error("getMentorStats error:", err);
    res.status(500).json({ message: "Error fetching stats" });
  }
};

/* =====================================================
   📅 GET AVAILABLE SLOTS FOR A MENTOR (Public)
===================================================== */
export const getAvailableSlots = async (req, res) => {
  try {
    const mentor = await User.findById(req.params.mentorId);
    if (!mentor || !mentor.mentorApproved) {
      return res.status(404).json({ message: "Mentor not found" });
    }

    if (!mentor.mentorProfile.isAvailable) {
      return res.json({ 
        message: "Mentor is currently unavailable",
        slots: [] 
      });
    }

    // Get all booked sessions for this mentor
    const bookedSessions = await Session.find({
      mentor: mentor._id,
      status: { $in: ["pending", "confirmed"] }
    }).select("scheduledTime duration");

    // Filter out booked slots
    const availability = mentor.mentorProfile.availability.map(day => ({
      day: day.day,
      slots: day.slots.filter(slot => !slot.isBooked)
    }));

    res.json({
      availability,
      bufferTime: mentor.mentorProfile.bufferTime,
      timezone: mentor.mentorProfile.timezone
    });
  } catch (err) {
    console.error("getAvailableSlots error:", err);
    res.status(500).json({ message: "Error fetching available slots" });
  }
};

// controllers/registrationController.js
import Event from "../models/Event.js";
import Submission from "../models/Submission.js";

/**
 * @desc Get all registrations for a specific event (Unstop-style)
 * @route GET /api/events/:eventId/registrations?page=&limit=
 * @access Admin, Mentor, SuperAdmin
 */
export const getEventRegistrations = async (req, res) => {
  try {
    const { eventId } = req.params;
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "10", 10), 1), 100);
    const skip = (page - 1) * limit;

    // Fetch event with only participants field
    const event = await Event.findById(eventId, { participants: 1 }).lean();

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const total = event.participants.length;

    if (total === 0) {
      return res.json({
        data: [],
        page,
        limit,
        total,
        totalPages: 0,
      });
    }

    // Paginate participants (latest first)
    const sorted = [...event.participants].sort(
      (a, b) => new Date(b.registeredAt) - new Date(a.registeredAt)
    );

    const sliced = sorted.slice(skip, skip + limit);

    // Format data for frontend
    const submissions = await Submission.find({ event: eventId }).lean();
    
    const data = sliced.map((p) => {
      const sub = submissions.find(s => String(s.user) === String(p.userId));
      return {
        _id: p.userId || p._id,
        userId: p.userId,
        name: p.name || "—",
        email: p.email || "—",
        teamName: p.teamName || "—",
        registeredAt: p.registeredAt,
        submissionStatus: p.submissionStatus || "not_submitted",
        score: typeof p.score === "number" ? p.score : null,
        lastUpdated: p.lastUpdated || null,
        feedback: p.feedback || "",
        submissionLink: sub?.submissionLink || "",
        fileUrl: sub?.fileUrl || "",
        submissionDate: sub?.createdAt || null
      };
    });

    res.json({
      data,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("getEventRegistrations error:", err);
    res.status(500).json({ message: "Failed to load registrations" });
  }
};

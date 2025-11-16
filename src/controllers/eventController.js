// controllers/eventController.js
import multer from "multer";
import Event from "../models/Event.js";
import Submission from "../models/Submission.js";
import AuditLog from "../models/AuditLog.js";
import cloudinary from "../utils/cloudinary.js";
import { sendEmail } from "../utils/sendEmail.js";

/* =====================================================
   📦 MULTER CONFIG (Memory Storage for Cloudinary)
===================================================== */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 }, // 30 MB
});   

const uploadBufferToCloudinary = (buffer, folder, filename = "file") =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "auto", public_id: `${Date.now()}_${filename}` },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });

/* =====================================================
   🧠 HELPERS
===================================================== */
const parseMaybeJSON = (val, fallback) => {
  if (val === undefined || val === null) return fallback;
  if (Array.isArray(val) || typeof val === "object") return val;
  const str = String(val).trim();
  if (!str) return fallback;
  try {
    const parsed = JSON.parse(str);
    return parsed ?? fallback;
  } catch {
    if (typeof val === "string") {
      return val
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return fallback;
  }
};

/* =====================================================
   🎉 EVENT CRUD
===================================================== */

export const createEvent = async (req, res) => {
  try {
    const body = req.body;

    if (!body.title || !body.startDate || !body.endDate || !body.registrationDeadline) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    let coverImage;
    if (req.file) {
      const uploaded = await uploadBufferToCloudinary(
        req.file.buffer,
        "onestop/events",
        "cover"
      );
      coverImage = { url: uploaded.secure_url, publicId: uploaded.public_id };
    }

    const event = await Event.create({
      title: body.title,
      subtitle: body.subtitle ?? "",
      description: body.description ?? "",
      organizer: body.organizer ?? "",
      category: body.category ?? "other",
      tags: parseMaybeJSON(body.tags, []),
      location: body.location ?? "Online",
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      registrationDeadline: new Date(body.registrationDeadline),
      maxTeamSize: Number(body.maxTeamSize ?? 1),
      prizes: parseMaybeJSON(body.prizes, []),
      rules: parseMaybeJSON(body.rules, []),
      faqs: parseMaybeJSON(body.faqs, []),
      visibility: body.visibility || "public",
      coverImage,
      createdBy: req.user._id,
    });

    await AuditLog.create({
      action: "CREATE_EVENT",
      performedBy: req.user._id,
      details: `Created event "${event.title}" (${event._id})`,
    });

    res.status(201).json(event);
  } catch (err) {
    console.error("CreateEvent error:", err);
    res.status(500).json({ message: "Error creating event" });
  }
};

// 🌍 Get Events (Public)
export const getEvents = async (req, res) => {
  try {
    const { search = "", status = "", category = "", page = 1, limit = 9 } = req.query;
    const query = {};
    if (search) query.$text = { $search: search };
    if (category) query.category = category;

    const total = await Event.countDocuments(query);
    let events = await Event.find(query)
      .sort({ startDate: 1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean({ virtuals: true });

    if (status) events = events.filter((e) => e.status === status);

    res.json({
      events,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)) || 1,
    });
  } catch (err) {
    console.error("GetEvents error:", err);
    res.status(500).json({ message: "Error fetching events" });
  }
};

// 🔍 Get Event by ID
export const getEventById = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).populate("createdBy", "name email role");
    if (!event) return res.status(404).json({ message: "Event not found" });
    res.json(event);
  } catch (err) {
    console.error("GetEventById error:", err);
    res.status(500).json({ message: "Error fetching event" });
  }
};

// ✏️ Update Event
export const updateEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: "Event not found" });

    const body = req.body;
    const updatable = [
      "title",
      "subtitle",
      "description",
      "organizer",
      "category",
      "tags",
      "location",
      "startDate",
      "endDate",
      "registrationDeadline",
      "maxTeamSize",
      "prizes",
      "rules",
      "faqs",
      "visibility",
    ];

    updatable.forEach((k) => {
      if (body[k] !== undefined) {
        if (["startDate", "endDate", "registrationDeadline"].includes(k)) {
          event[k] = body[k] ? new Date(body[k]) : event[k];
        } else if (["tags", "rules", "prizes", "faqs"].includes(k)) {
          event[k] = parseMaybeJSON(body[k], event[k]);
        } else if (k === "maxTeamSize") {
          event[k] = Number(body[k]) || event[k];
        } else {
          event[k] = body[k];
        }
      }
    });

    if (req.file) {
      if (event.coverImage?.publicId) {
        try {
          await cloudinary.uploader.destroy(event.coverImage.publicId);
        } catch (e) {
          console.warn("Cloudinary destroy failed:", e?.message);
        }
      }
      const uploaded = await uploadBufferToCloudinary(req.file.buffer, "onestop/events", "cover");
      event.coverImage = { url: uploaded.secure_url, publicId: uploaded.public_id };
    }

    await event.save();

    await AuditLog.create({
      action: "UPDATE_EVENT",
      performedBy: req.user._id,
      details: `Updated event "${event.title}" (${event._id})`,
    });

    res.json(event);
  } catch (err) {
    console.error("UpdateEvent error:", err);
    res.status(500).json({ message: "Error updating event" });
  }
};

// 🗑️ Delete Event
export const deleteEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: "Event not found" });

    if (event.coverImage?.publicId) {
      try {
        await cloudinary.uploader.destroy(event.coverImage.publicId);
      } catch (e) {
        console.warn("Cloudinary destroy failed:", e?.message);
      }
    }

    await Submission.deleteMany({ event: event._id });
    await event.deleteOne();

    await AuditLog.create({
      action: "DELETE_EVENT",
      performedBy: req.user._id,
      details: `Deleted event "${event.title}" (${event._id})`,
    });

    res.json({ message: "Event deleted successfully" });
  } catch (err) {
    console.error("DeleteEvent error:", err);
    res.status(500).json({ message: "Error deleting event" });
  }
};

/* =====================================================
   🎟️ REGISTRATION & SUBMISSION
===================================================== */

export const registerForEvent = async (req, res) => {
  try {
    const { id: eventId } = req.params;
    const { teamName = "" } = req.body;

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: "Event not found" });

    if (new Date() > new Date(event.registrationDeadline)) {
      return res.status(400).json({ message: "Registration deadline has passed" });
    }

    const already = event.participants.find(
      (p) => String(p.userId) === String(req.user._id)
    );
    if (already) {
      return res.status(400).json({ message: "You are already registered for this event" });
    }

    event.participants.push({
      userId: req.user._id,
      name: req.user.name,
      email: req.user.email,
      teamName,
      registeredAt: new Date(),
      submissionStatus: "not_submitted",
    });

    await event.save();

    await sendEmail(
      req.user.email,
      `Registered: ${event.title}`,
      `✅ You have successfully registered for "${event.title}".`
    );

    await AuditLog.create({
      action: "REGISTER_EVENT",
      performedBy: req.user._id,
      details: `Registered for event "${event.title}" (${event._id})`,
    });

    res.status(201).json({ message: "Registration successful" });
  } catch (err) {
    console.error("RegisterForEvent error:", err);
    res.status(500).json({ message: "Error registering for event" });
  }
};

// 📤 Upload Submission
export const uploadSubmission = async (req, res) => {
  try {
    const { id: eventId } = req.params;
    const { submissionLink = "" } = req.body;

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: "Event not found" });

    const participant = event.participants.find(
      (p) => String(p.userId) === String(req.user._id)
    );
    if (!participant)
      return res.status(403).json({ message: "Please register before submitting" });

    let fileResult;
    if (req.file) {
      fileResult = await uploadBufferToCloudinary(
        req.file.buffer,
        "onestop/submissions",
        req.file.originalname?.split(".")[0] || "submission"
      );
    }

    await Submission.findOneAndUpdate(
      { event: eventId, user: req.user._id },
      {
        event: eventId,
        user: req.user._id,
        teamName: participant.teamName,
        submissionLink,
        fileUrl: fileResult?.secure_url || "",
        status: "submitted",
      },
      { new: true, upsert: true }
    );

    participant.submissionStatus = "submitted";
    participant.lastUpdated = new Date();
    await event.save();

    await sendEmail(
      req.user.email,
      `Submission Confirmed: ${event.title}`,
      `Your submission for "${event.title}" has been received.`
    );

    await AuditLog.create({
      action: "SUBMIT_ENTRY",
      performedBy: req.user._id,
      details: `User submitted entry for "${event.title}" (${event._id})`,
    });

    res.status(201).json({ message: "Submission uploaded successfully" });
  } catch (err) {
    console.error("UploadSubmission error:", err);
    res.status(500).json({ message: "Error uploading submission" });
  }
};

/* =====================================================
   ⚖️ EVALUATION & LEADERBOARD
===================================================== */

export const evaluateSubmission = async (req, res) => {
  try {
    const { id: eventId } = req.params;
    const { userId, score, feedback = "", round = 1 } = req.body;

    if (!eventId || !userId)
      return res.status(400).json({ message: "Missing eventId or userId" });

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: "Event not found" });

    const participant = event.participants.find(
      (p) => String(p.userId) === String(userId)
    );
    if (!participant)
      return res.status(404).json({ message: "Participant not found for this event" });

    participant.score = typeof score === "number" ? score : null;
    participant.feedback = feedback;
    participant.submissionStatus = "reviewed";
    participant.round = round;
    participant.lastUpdated = new Date();

    await event.save();

    await Submission.findOneAndUpdate(
      { event: eventId, user: userId },
      {
        $set: {
          finalScore: participant.score,
          feedback: participant.feedback,
          status: "reviewed",
          updatedAt: new Date(),
        },
      },
      { new: true, upsert: true }
    );

    await AuditLog.create({
      action: "EVALUATE_SUBMISSION",
      performedBy: req.user._id,
      details: `Evaluated participant ${userId} in event ${eventId}`,
    });

    res.json({ message: "Evaluation saved", participant });
  } catch (err) {
    console.error("EvaluateSubmission error:", err);
    res.status(500).json({ message: "Error evaluating submission" });
  }
};

export const getLeaderboard = async (req, res) => {
  try {
    const { id: eventId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const event = await Event.findById(eventId).lean();
    if (!event) return res.status(404).json({ message: "Event not found" });

    const participants = [...event.participants].filter(
      (p) => p.score !== null && p.score !== undefined
    );

    const sorted = participants.sort((a, b) => b.score - a.score);

    let currentRank = 1;
    const leaderboard = sorted.map((p, i) => {
      if (i > 0 && sorted[i - 1].score !== p.score) {
        currentRank = i + 1;
      }
      return {
        rank: currentRank,
        name: p.name,
        email: p.email,
        teamName: p.teamName,
        score: p.score,
        feedback: p.feedback || "",
        lastUpdated: p.lastUpdated,
      };
    });

    const start = (page - 1) * limit;
    const end = start + Number(limit);
    const paginated = leaderboard.slice(start, end);

    res.json({
      eventId,
      totalParticipants: event.participants.length,
      totalRanked: leaderboard.length,
      page: Number(page),
      totalPages: Math.ceil(leaderboard.length / limit),
      leaderboard: paginated,
    });
  } catch (err) {
    console.error("GetLeaderboard error:", err);
    res.status(500).json({ message: "Error fetching leaderboard" });
  }
};

/* =====================================================
   👤 USER REGISTRATIONS
===================================================== */

export const listMyRegistrations = async (req, res) => {
  try {
    const events = await Event.find({
      "participants.userId": req.user._id,
    })
      .select("title category startDate endDate registrationDeadline participants")
      .lean();

    const myEvents = events.map((e) => {
      const participant = e.participants.find(
        (p) => String(p.userId) === String(req.user._id)
      );
      return {
        eventId: e._id,
        title: e.title,
        category: e.category,
        startDate: e.startDate,
        endDate: e.endDate,
        registrationDeadline: e.registrationDeadline,
        registeredAt: participant?.registeredAt || null,
        teamName: participant?.teamName || "—",
        submissionStatus: participant?.submissionStatus || "not_submitted",
        score: participant?.score ?? null,
        feedback: participant?.feedback || "",
      };
    });

    res.json({ registrations: myEvents });
  } catch (err) {
    console.error("listMyRegistrations error:", err);
    res.status(500).json({ message: "Error fetching my registrations" });
  }
};

/* =====================================================
   📄 SUBMISSIONS LIST (ADMIN)
===================================================== */
export const listSubmissionsForEvent = async (req, res) => {
  try {
    const { id: eventId } = req.params;
    const submissions = await Submission.find({ event: eventId })
      .populate("user", "name email")
      .sort({ updatedAt: -1 })
      .lean();

    res.json({ submissions });
  } catch (err) {
    console.error("listSubmissionsForEvent error:", err);
    res.status(500).json({ message: "Error fetching submissions" });
  }
};

/* =====================================================
   📈 ADMIN DASHBOARD
===================================================== */
export const eventAdminMetrics = async (_req, res) => {
  try {
    const total = await Event.countDocuments();
    const byCategory = await Event.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    res.json({ total, byCategory });
  } catch (err) {
    console.error("eventAdminMetrics error:", err);
    res.status(500).json({ message: "Error fetching metrics" });
  }
};

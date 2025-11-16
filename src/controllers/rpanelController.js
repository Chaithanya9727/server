// controllers/rpanelController.js
import mongoose from "mongoose";
import User from "../models/User.js";
import Event from "../models/Event.js";
import AuditLog from "../models/AuditLog.js";

// These models likely exist in your app; if names differ, adjust imports.
import Job from "../models/Job.js";
import Notification from "../models/Notification.js";
import Message from "../models/Message.js";

/* ---------------------------------------------
   Helpers
----------------------------------------------*/
const toObjectId = (id) => new mongoose.Types.ObjectId(id);
const now = () => new Date();
const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

/* ---------------------------------------------
   GET /api/rpanel/ping
----------------------------------------------*/
export const ping = (_req, res) => {
  res.json({ ok: true, service: "Recruiter Panel API", ts: Date.now() });
};

/* ---------------------------------------------
   GET /api/rpanel/overview
   Cards + sparkline + recent activity
----------------------------------------------*/
export const getOverview = async (req, res) => {
  try {
    const recruiterId = toObjectId(req.user._id);

    // Jobs owned by this recruiter
    const jobs = await Job.find({ createdBy: recruiterId })
      .select("_id status createdAt title")
      .lean();

    const jobIds = jobs.map((j) => j._id);

    // Counts
    const jobsCount = jobs.length;
    const activeJobsCount = jobs.filter((j) =>
      ["active", "open", "published"].includes(String(j.status || "").toLowerCase())
    ).length;

    const upcomingEventsCount = await Event.countDocuments({
      createdBy: recruiterId,
      startDate: { $gte: now() },
    });

    // Applications count (from User.applications array referencing those jobs)
    let totalApplications = 0;
    if (jobIds.length) {
      const appsAgg = await User.aggregate([
        { $unwind: "$applications" },
        { $match: { "applications.job": { $in: jobIds } } },
        { $count: "total" },
      ]);
      totalApplications = appsAgg?.[0]?.total || 0;
    }

    // Unread notifications/messages (optional; skip safely if models differ)
    const [unreadNotifications, unreadMessages] = await Promise.all([
      Notification?.countDocuments
        ? Notification.countDocuments({ user: recruiterId, read: false })
        : Promise.resolve(0),
      Message?.countDocuments
        ? Message.countDocuments({ to: recruiterId, read: false })
        : Promise.resolve(0),
    ]);

    // Sparkline: applications per day over last 14 days
    let sparkline = [];
    if (jobIds.length) {
      const start = daysAgo(13);
      const sparkAgg = await User.aggregate([
        { $unwind: "$applications" },
        {
          $match: {
            "applications.job": { $in: jobIds },
            "applications.appliedAt": { $gte: start },
          },
        },
        {
          $group: {
            _id: {
              y: { $year: "$applications.appliedAt" },
              m: { $month: "$applications.appliedAt" },
              d: { $dayOfMonth: "$applications.appliedAt" },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.y": 1, "_id.m": 1, "_id.d": 1 } },
      ]);

      // Normalize to an array of last 14 days
      const map = new Map(
        sparkAgg.map((g) => [
          `${g._id.y}-${g._id.m}-${g._id.d}`,
          g.count,
        ])
      );
      const days = [];
      for (let i = 13; i >= 0; i--) {
        const d = daysAgo(i);
        const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
        days.push({
          date: d.toISOString().slice(0, 10),
          value: map.get(key) || 0,
        });
      }
      sparkline = days;
    }

    // Recent activity (audit logs by this recruiter)
    const recentActivity = await AuditLog.find({ performedBy: recruiterId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("action details createdAt")
      .lean();

    res.json({
      cards: {
        jobsCount,
        activeJobsCount,
        totalApplications,
        upcomingEventsCount,
        unreadNotifications,
        unreadMessages,
      },
      sparkline,
      recentActivity,
    });
  } catch (err) {
    console.error("rpanel.getOverview error:", err);
    res.status(500).json({ message: "Failed to load overview" });
  }
};

/* ---------------------------------------------
   GET /api/rpanel/jobs
   Query: search, status, page, limit
----------------------------------------------*/
export const listJobs = async (req, res) => {
  try {
    const recruiterId = toObjectId(req.user._id);
    const { search = "", status = "", page = 1, limit = 10 } = req.query;

    const q = { createdBy: recruiterId };
    if (search) q.title = { $regex: String(search).trim(), $options: "i" };
    if (status) q.status = status;

    const total = await Job.countDocuments(q);
    const jobs = await Job.find(q)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .select("title status createdAt applicantsCount")
      .lean();

    // Fallback: compute applicantsCount quickly if field missing
    const jobIds = jobs.map((j) => j._id);
    let countsByJob = {};
    if (jobIds.length) {
      const agg = await User.aggregate([
        { $unwind: "$applications" },
        { $match: { "applications.job": { $in: jobIds } } },
        { $group: { _id: "$applications.job", count: { $sum: 1 } } },
      ]);
      countsByJob = Object.fromEntries(agg.map((a) => [String(a._id), a.count]));
    }

    const rows = jobs.map((j) => ({
      _id: j._id,
      title: j.title,
      status: j.status,
      createdAt: j.createdAt,
      applicants: j.applicantsCount ?? countsByJob[String(j._id)] ?? 0,
    }));

    res.json({
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)) || 1,
      jobs: rows,
    });
  } catch (err) {
    console.error("rpanel.listJobs error:", err);
    res.status(500).json({ message: "Failed to load jobs" });
  }
};

/* ---------------------------------------------
   GET /api/rpanel/jobs/:jobId/applications
   Query: status, page, limit
----------------------------------------------*/
export const listJobApplications = async (req, res) => {
  try {
    const recruiterId = toObjectId(req.user._id);
    const jobId = toObjectId(req.params.jobId);
    const { status = "", page = 1, limit = 20 } = req.query;

    // Ensure the job belongs to this recruiter
    const job = await Job.findOne({ _id: jobId, createdBy: recruiterId }).lean();
    if (!job) return res.status(404).json({ message: "Job not found" });

    const match = { "applications.job": jobId };
    if (status) match["applications.status"] = status;

    const pipeline = [
      { $unwind: "$applications" },
      { $match: match },
      {
        $project: {
          name: 1,
          email: 1,
          mobile: 1,
          resumeUrl: 1,
          application: "$applications",
        },
      },
      { $sort: { "application.appliedAt": -1 } },
      { $skip: (Number(page) - 1) * Number(limit) },
      { $limit: Number(limit) },
    ];

    const apps = await User.aggregate(pipeline);
    const totalAgg = await User.aggregate([
      { $unwind: "$applications" },
      { $match: match },
      { $count: "total" },
    ]);
    const total = totalAgg?.[0]?.total || 0;

    res.json({
      jobId: String(jobId),
      jobTitle: job.title,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)) || 1,
      applications: apps.map((a) => ({
        _id: a.application._id,
        userId: a._id,
        name: a.name,
        email: a.email,
        mobile: a.mobile,
        resumeUrl: a.resumeUrl,
        status: a.application.status,
        appliedAt: a.application.appliedAt,
        updatedAt: a.application.updatedAt,
      })),
    });
  } catch (err) {
    console.error("rpanel.listJobApplications error:", err);
    res.status(500).json({ message: "Failed to load applications" });
  }
};

/* ---------------------------------------------
   PATCH /api/rpanel/applications/:applicationId/status
   Body: { status: "shortlisted" | "rejected" | ... }
----------------------------------------------*/
export const updateApplicationStatus = async (req, res) => {
  try {
    const recruiterId = toObjectId(req.user._id);
    const applicationId = toObjectId(req.params.applicationId);
    const { status } = req.body;

    if (!status) return res.status(400).json({ message: "Missing status" });

    // Find user by embedded application id
    const userDoc = await User.findOne({ "applications._id": applicationId }).lean();
    if (!userDoc) return res.status(404).json({ message: "Application not found" });

    const application = userDoc.applications.find(
      (a) => String(a._id) === String(applicationId)
    );
    if (!application) return res.status(404).json({ message: "Application not found" });

    // Ensure the job belongs to this recruiter
    const job = await Job.findById(application.job).lean();
    if (!job || String(job.createdBy) !== String(recruiterId)) {
      return res.status(403).json({ message: "Not authorized for this application" });
    }

    // Update status and updatedAt
    await User.updateOne(
      { "applications._id": applicationId },
      {
        $set: {
          "applications.$.status": status,
          "applications.$.updatedAt": new Date(),
        },
      }
    );

    // Write audit log (and optionally notify user)
    await AuditLog.create({
      action: "UPDATE_APPLICATION_STATUS",
      performedBy: recruiterId,
      details: `Recruiter updated application ${applicationId} to ${status}`,
    });

    res.json({ message: "Application status updated", status });
  } catch (err) {
    console.error("rpanel.updateApplicationStatus error:", err);
    res.status(500).json({ message: "Failed to update application" });
  }
};

/* ---------------------------------------------
   GET /api/rpanel/events
   Query: status(upcoming|ongoing|ended), page, limit
----------------------------------------------*/
export const listEvents = async (req, res) => {
  try {
    const recruiterId = toObjectId(req.user._id);
    const { status = "", page = 1, limit = 10 } = req.query;

    const q = { createdBy: recruiterId };
    // We'll filter status in-memory because status is a virtual
    const total = await Event.countDocuments(q);
    let events = await Event.find(q)
      .sort({ startDate: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .select("title startDate endDate registrationDeadline visibility coverImage")
      .lean({ virtuals: true });

    if (status) {
      events = events.filter((e) => e.status === status);
    }

    res.json({
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)) || 1,
      events,
    });
  } catch (err) {
    console.error("rpanel.listEvents error:", err);
    res.status(500).json({ message: "Failed to load events" });
  }
};

/* ---------------------------------------------
   POST /api/rpanel/events
   Create an event (minimal proxy)
----------------------------------------------*/
export const createEventForRecruiter = async (req, res) => {
  try {
    const recruiterId = toObjectId(req.user._id);
    const {
      title,
      subtitle = "",
      description = "",
      organizer = "",
      category = "other",
      tags = [],
      location = "Online",
      startDate,
      endDate,
      registrationDeadline,
      maxTeamSize = 1,
      prizes = [],
      rules = [],
      faqs = [],
      visibility = "public",
    } = req.body;

    if (!title || !startDate || !endDate || !registrationDeadline) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const event = await Event.create({
      title,
      subtitle,
      description,
      organizer,
      category,
      tags: Array.isArray(tags) ? tags : [],
      location,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      registrationDeadline: new Date(registrationDeadline),
      maxTeamSize: Number(maxTeamSize) || 1,
      prizes: Array.isArray(prizes) ? prizes : [],
      rules: Array.isArray(rules) ? rules : [],
      faqs: Array.isArray(faqs) ? faqs : [],
      visibility,
      createdBy: recruiterId,
    });

    await AuditLog.create({
      action: "CREATE_EVENT",
      performedBy: recruiterId,
      details: `Recruiter created event "${event.title}" (${event._id})`,
    });

    res.status(201).json({ message: "Event created", event });
  } catch (err) {
    console.error("rpanel.createEventForRecruiter error:", err);
    res.status(500).json({ message: "Failed to create event" });
  }
};

/* ---------------------------------------------
   GET /api/rpanel/inbox/summary
   Unread counts + recent conversations
----------------------------------------------*/
export const inboxSummary = async (req, res) => {
  try {
    const recruiterId = toObjectId(req.user._id);

    const unread = Message?.countDocuments
      ? await Message.countDocuments({ to: recruiterId, read: false })
      : 0;

    // Pick last 5 conversation heads (very light)
    let recents = [];
    if (Message?.aggregate) {
      recents = await Message.aggregate([
        {
          $match: {
            $or: [{ to: recruiterId }, { from: recruiterId }],
          },
        },
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: {
              other:
                "$from" === recruiterId
                  ? "$to"
                  : "$from",
            },
            last: { $first: "$$ROOT" },
          },
        },
        { $limit: 5 },
        {
          $project: {
            _id: 0,
            messageId: "$last._id",
            from: "$last.from",
            to: "$last.to",
            text: "$last.text",
            createdAt: "$last.createdAt",
          },
        },
      ]);
    }

    res.json({ unread, recents });
  } catch (err) {
    console.error("rpanel.inboxSummary error:", err);
    res.status(500).json({ message: "Failed to load inbox" });
  }
};

/* ---------------------------------------------
   GET /api/rpanel/notifications
----------------------------------------------*/
export const listNotifications = async (req, res) => {
  try {
    const recruiterId = toObjectId(req.user._id);

    const unread = Notification?.countDocuments
      ? await Notification.countDocuments({ user: recruiterId, read: false })
      : 0;

    const items = Notification?.find
      ? await Notification.find({ user: recruiterId })
          .sort({ createdAt: -1 })
          .limit(10)
          .select("title message read createdAt")
          .lean()
      : [];

    res.json({ unread, items });
  } catch (err) {
    console.error("rpanel.listNotifications error:", err);
    res.status(500).json({ message: "Failed to load notifications" });
  }
};

/* ---------------------------------------------
   GET /api/rpanel/profile
   PATCH /api/rpanel/profile
----------------------------------------------*/
export const getProfile = async (req, res) => {
  try {
    const me = await User.findById(req.user._id)
      .select("name email mobile orgName avatar role status")
      .lean();
    res.json(me);
  } catch (err) {
    console.error("rpanel.getProfile error:", err);
    res.status(500).json({ message: "Failed to load profile" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const updatable = ["orgName", "mobile", "avatar", "name"];
    const body = req.body || {};
    const patch = {};
    updatable.forEach((k) => {
      if (body[k] !== undefined) patch[k] = body[k];
    });

    const updated = await User.findByIdAndUpdate(req.user._id, patch, {
      new: true,
      runValidators: true,
    })
      .select("name email mobile orgName avatar role status")
      .lean();

    await AuditLog.create({
      action: "UPDATE_RECRUITER_PROFILE",
      performedBy: req.user._id,
      details: `Recruiter updated profile fields: ${Object.keys(patch).join(", ") || "none"}`,
    });

    res.json(updated);
  } catch (err) {
    console.error("rpanel.updateProfile error:", err);
    res.status(500).json({ message: "Failed to update profile" });
  }
};

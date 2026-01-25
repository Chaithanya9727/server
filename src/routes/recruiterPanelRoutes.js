import express from "express";
import { protect } from "../middleware/auth.js";
import { authorize } from "../middleware/authorize.js";
import Job from "../models/Job.js";
import Application from "../models/Application.js";
import Notification from "../models/Notification.js";

const router = express.Router();

/* =====================================================
 📊 RECRUITER DASHBOARD OVERVIEW
 GET /api/rpanel/overview
===================================================== */
router.get("/overview", protect, authorize(["recruiter"]), async (req, res) => {
  try {
    const recruiterId = req.user._id;

    const jobs = await Job.find({ postedBy: recruiterId }).sort({ createdAt: -1 });
    const jobIds = jobs.map((j) => j._id);

    const totalJobs = jobs.length;
    const totalApplications = await Application.countDocuments({ job: { $in: jobIds } });
    const totalShortlisted = await Application.countDocuments({ job: { $in: jobIds }, status: "shortlisted" });
    const totalHires = await Application.countDocuments({ job: { $in: jobIds }, status: "hired" });

    const recentJobs = jobs.slice(0, 5).map((job) => ({
      id: job._id,
      title: job.title,
      createdAt: job.createdAt,
      location: job.location || "Not specified",
      status: job.status || "pending",
    }));

    const since = new Date();
    since.setDate(since.getDate() - 7);

    const sparkline = await Application.aggregate([
      { $match: { job: { $in: jobIds }, createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      counts: {
        totalJobs,
        totalApplications,
        totalShortlisted,
        totalHires,
      },
      recentJobs,
      sparkline: sparkline.map((s) => ({ date: s._id, count: s.count })),
    });
  } catch (err) {
    console.error("Error loading recruiter overview:", err);
    res.status(500).json({ message: "Server error loading overview" });
  }
});

/* =====================================================
 🔔 GET RECRUITER NOTIFICATIONS
 GET /api/rpanel/notifications
===================================================== */
router.get("/notifications", protect, authorize(["recruiter"]), async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user._id }).sort({
      createdAt: -1,
    });

    res.json(notifications);
  } catch (err) {
    console.error("Error loading recruiter notifications:", err);
    res.status(500).json({ message: "Error loading notifications" });
  }
});

/* =====================================================
 📄 LIST RECRUITER JOBS
 GET /api/rpanel/jobs
===================================================== */
router.get("/jobs", protect, authorize(["recruiter"]), async (req, res) => {
  try {
    const jobs = await Job.find({ postedBy: req.user._id }).sort({ createdAt: -1 });
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ message: "Error loading jobs" });
  }
});

/* =====================================================
 📝 LIST APPLICATIONS FOR RECRUITER JOBS
 GET /api/rpanel/applications
===================================================== */
router.get("/applications", protect, authorize(["recruiter"]), async (req, res) => {
  try {
    const jobs = await Job.find({ postedBy: req.user._id }).select("_id");
    const jobIds = jobs.map((j) => j._id);

    const applications = await Application.find({ job: { $in: jobIds } })
      .populate("job", "title")
      .populate("applicant", "name email");

    res.json(applications);
  } catch (err) {
    res.status(500).json({ message: "Error loading applications" });
  }
});

export default router;

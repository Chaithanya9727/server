// routes/recruiterPanelRoutes.js
import express from "express";
import { protect } from "../middleware/auth.js";
import { authorize } from "../middleware/authorize.js";
import Job from "../models/Job.js";
import Application from "../models/Application.js";
import User from "../models/User.js";
import AuditLog from "../models/AuditLog.js";
import { notifyUser } from "../utils/notifyUser.js";

const router = express.Router();

/* =====================================================
   📊 GET Recruiter Overview (Dashboard Data)
   @route   GET /api/rpanel/overview
   @access  Private (Recruiter)
===================================================== */
router.get("/overview", protect, authorize(["recruiter"]), async (req, res) => {
  try {
    const recruiterId = req.user._id;

    // 🧩 Fetch recruiter's jobs
    const jobs = await Job.find({ postedBy: recruiterId }).sort({ createdAt: -1 });

    const totalJobs = jobs.length;
    const jobIds = jobs.map((j) => j._id);

    // 🧩 Application statistics
    const totalApplications = await Application.countDocuments({
      job: { $in: jobIds },
    });

    const hiredCount = await Application.countDocuments({
      job: { $in: jobIds },
      status: "hired",
    });

    const shortlistedCount = await Application.countDocuments({
      job: { $in: jobIds },
      status: "shortlisted",
    });

    // 🧩 Active jobs
    const activeJobs = jobs.filter((j) => j.status === "active" || j.status === "approved").length;

    // 🧩 Recent jobs (latest 5)
    const recentJobs = jobs.slice(0, 5).map((job) => ({
      id: job._id,
      title: job.title,
      location: job.location,
      createdAt: job.createdAt,
      status: job.status || "pending",
    }));

    // 🧩 Sparkline data (applications in last 7 days)
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);

    const sparkline = await Application.aggregate([
      {
        $match: {
          job: { $in: jobIds },
          createdAt: { $gte: last7Days },
        },
      },
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
        totalHires: hiredCount,
        totalShortlisted: shortlistedCount,
        activeJobs,
      },
      recentJobs,
      sparkline: sparkline.map((d) => ({
        date: d._id,
        count: d.count,
      })),
    });
  } catch (err) {
    console.error("Error fetching recruiter overview:", err);
    res.status(500).json({ message: "Server error loading overview" });
  }
});

/* =====================================================
   📈 Recruiter Analytics
   @route   GET /api/rpanel/analytics
   @access  Private (Recruiter)
===================================================== */
router.get("/analytics", protect, authorize(["recruiter"]), async (req, res) => {
  try {
    const recruiterId = req.user._id;

    // Get all recruiter's jobs
    const jobs = await Job.find({ postedBy: recruiterId }).select("_id title createdAt");
    const jobIds = jobs.map((j) => j._id);

    if (!jobIds.length) {
      return res.json({
        pending: 0,
        shortlisted: 0,
        rejected: 0,
        hired: 0,
        trends: [],
        topJobs: [],
        conversionRate: 0,
      });
    }

    // Count applications by status
    const statusCounts = await Application.aggregate([
      { $match: { job: { $in: jobIds } } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const counts = {
      pending: statusCounts.find((s) => s._id === "applied")?.count || 0,
      shortlisted: statusCounts.find((s) => s._id === "shortlisted")?.count || 0,
      rejected: statusCounts.find((s) => s._id === "rejected")?.count || 0,
      hired: statusCounts.find((s) => s._id === "hired")?.count || 0,
    };

    // Conversion Rate
    const conversionRate =
      counts.shortlisted > 0
        ? Math.round((counts.hired / counts.shortlisted) * 100)
        : 0;

    // Applications over time (last 30 days)
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    const trends = await Application.aggregate([
      {
        $match: {
          job: { $in: jobIds },
          createdAt: { $gte: last30Days },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          applications: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Top 5 jobs with most applications
    const topJobs = await Application.aggregate([
      { $match: { job: { $in: jobIds } } },
      { $group: { _id: "$job", applications: { $sum: 1 } } },
      { $sort: { applications: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "jobs",
          localField: "_id",
          foreignField: "_id",
          as: "jobDetails",
        },
      },
      { $unwind: "$jobDetails" },
      {
        $project: {
          _id: 0,
          jobId: "$jobDetails._id",
          title: "$jobDetails.title",
          applications: 1,
        },
      },
    ]);

    res.json({
      ...counts,
      conversionRate,
      trends: trends.map((t) => ({
        date: t._id,
        applications: t.applications,
      })),
      topJobs,
    });
  } catch (err) {
    console.error("❌ Recruiter Analytics Error:", err);
    res.status(500).json({ message: "Failed to load analytics" });
  }
});

/* =====================================================
   👤 GET Recruiter Profile
   @route   GET /api/rpanel/profile
   @access  Private (Recruiter)
===================================================== */
router.get("/profile", protect, authorize(["recruiter"]), async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      "name email mobile orgName avatar companyWebsite companyDescription"
    );

    if (!user)
      return res.status(404).json({ message: "Recruiter profile not found" });

    res.json(user);
  } catch (err) {
    console.error("Error fetching recruiter profile:", err);
    res.status(500).json({ message: "Server error fetching profile" });
  }
});

/* =====================================================
   ✏️ UPDATE Recruiter Profile
   @route   PATCH /api/rpanel/profile
   @access  Private (Recruiter)
===================================================== */
router.patch("/profile", protect, authorize(["recruiter"]), async (req, res) => {
  try {
    const {
      name,
      mobile,
      orgName,
      avatar,
      companyWebsite,
      companyDescription,
    } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "Recruiter not found" });

    // Apply updates only to defined fields
    if (name !== undefined) user.name = name;
    if (mobile !== undefined) user.mobile = mobile;
    if (orgName !== undefined) user.orgName = orgName;
    if (avatar !== undefined) user.avatar = avatar;
    if (companyWebsite !== undefined) user.companyWebsite = companyWebsite;
    if (companyDescription !== undefined)
      user.companyDescription = companyDescription;

    await user.save();

    // 🧾 Log update
    await AuditLog.create({
      action: "UPDATE_RECRUITER_PROFILE",
      performedBy: req.user._id,
      targetUser: req.user._id,
      details: `Recruiter profile updated (${user.email})`,
    });

    // 🔔 Real-time notification
    await notifyUser(user._id, {
      title: "Profile Updated",
      message: "Your recruiter profile details were updated successfully.",
      type: "recruiter",
    });

    res.json({
      message: "Profile updated successfully ✅",
      recruiter: {
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        orgName: user.orgName,
        avatar: user.avatar,
        companyWebsite: user.companyWebsite,
        companyDescription: user.companyDescription,
      },
    });
  } catch (err) {
    console.error("Error updating recruiter profile:", err);
    res.status(500).json({ message: "Error updating profile" });
  }
});

export default router;

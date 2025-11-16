import express from "express";
import mongoose from "mongoose";
import { protect, authorize } from "../middleware/auth.js";
import Job from "../models/Job.js";
import Application from "../models/Application.js";

const router = express.Router();

/* =====================================================
   ⚙️ Helper Utilities
===================================================== */
const safeAggregate = async (model, pipeline, fallbackName) => {
  try {
    if (model) return await model.aggregate(pipeline);
  } catch (err) {
    console.warn(`Aggregate failed for ${fallbackName}:`, err.message);
  }
  try {
    return await mongoose.connection.collection(fallbackName).aggregate(pipeline).toArray();
  } catch {
    return [];
  }
};

/* =====================================================
   📊 Unified Recruiter Analytics
   @route   GET /api/rpanel/analytics
   @access  Private (Recruiter)
===================================================== */
router.get("/analytics", protect, authorize("recruiter"), async (req, res) => {
  try {
    const recruiterId = req.user._id;

    /* =============================
       1️⃣ Fetch Recruiter Jobs
    ============================== */
    const jobs = await Job.find({ postedBy: recruiterId }).select("_id title status");
    const jobIds = jobs.map((j) => j._id);
    const totalJobs = jobs.length;

    /* =============================
       2️⃣ Application Stats by Status
    ============================== */
    const statusAgg = await safeAggregate(
      Application,
      [
        { $match: { job: { $in: jobIds } } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ],
      "applications"
    );

    const stats = {
      pending: 0,
      shortlisted: 0,
      rejected: 0,
      hired: 0,
    };
    statusAgg.forEach((s) => {
      const key = (s._id || "").toLowerCase();
      if (stats[key] !== undefined) stats[key] = s.count;
    });

    const totalApplications =
      stats.pending + stats.shortlisted + stats.rejected + stats.hired;

    /* =============================
       3️⃣ Conversion Rate (Shortlisted → Hired)
    ============================== */
    let conversionRate = 0;
    if (stats.shortlisted > 0)
      conversionRate = ((stats.hired / stats.shortlisted) * 100).toFixed(1);

    /* =============================
       4️⃣ Application Trend (Last 30 days)
    ============================== */
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 30);
    start.setHours(0, 0, 0, 0);

    const trendAgg = await safeAggregate(
      Application,
      [
        { $match: { job: { $in: jobIds }, createdAt: { $gte: start } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            applications: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ],
      "applications"
    );

    const trends = trendAgg.map((d) => ({
      date: d._id,
      applications: d.applications,
    }));

    /* =============================
       5️⃣ Top 5 Jobs by Applications
    ============================== */
    const topJobsAgg = await safeAggregate(
      Application,
      [
        { $match: { job: { $in: jobIds } } },
        { $group: { _id: "$job", applications: { $sum: 1 } } },
        { $sort: { applications: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: "jobs",
            localField: "_id",
            foreignField: "_id",
            as: "jobInfo",
          },
        },
        { $unwind: "$jobInfo" },
        {
          $project: {
            _id: 0,
            title: "$jobInfo.title",
            applications: 1,
          },
        },
      ],
      "applications"
    );

    const topJobs = topJobsAgg.map((job) => ({
      title: job.title || "Untitled Job",
      applications: job.applications,
    }));

    /* =============================
       ✅ Response
    ============================== */
    res.json({
      success: true,
      data: {
        totalJobs,
        totalApplications,
        ...stats,
        conversionRate,
        trends,
        topJobs,
      },
    });
  } catch (err) {
    console.error("Error in recruiter analytics route:", err);
    res.status(500).json({
      success: false,
      message: "Server error fetching recruiter analytics",
    });
  }
});

export default router;

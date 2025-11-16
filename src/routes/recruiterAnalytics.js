// src/routes/recruiterAnalytics.js
import express from "express";
import { protect } from "../middleware/auth.js";
import { authorize } from "../middleware/authorize.js";
import Job from "../models/Job.js";
import Application from "../models/Application.js";
import mongoose from "mongoose";  // For aggregating data by time

const router = express.Router();

// 🚀 Recruiter Analytics
router.get("/analytics", protect, authorize(["recruiter"]), async (req, res) => {
  try {
    const recruiterId = req.user._id;

    // Total number of jobs posted
    const totalJobs = await Job.countDocuments({ postedBy: recruiterId });

    // Total applications per job
    const totalApplications = await Application.countDocuments({ job: { $in: await Job.find({ postedBy: recruiterId }).select('_id') } });

    // Job status breakdown (pending, approved, closed)
    const jobStatusBreakdown = await Job.aggregate([
      { $match: { postedBy: mongoose.Types.ObjectId(recruiterId) } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    // Application status breakdown (applied, shortlisted, hired, rejected)
    const applicationStatusBreakdown = await Application.aggregate([
      { $match: { job: { $in: await Job.find({ postedBy: recruiterId }).select('_id') } } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    // Jobs over time (Monthly)
    const monthlyJobPostings = await Job.aggregate([
      { $match: { postedBy: mongoose.Types.ObjectId(recruiterId) } },
      { $group: { _id: { $month: "$createdAt" }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      totalJobs,
      totalApplications,
      jobStatusBreakdown,
      applicationStatusBreakdown,
      monthlyJobPostings,
    });
  } catch (err) {
    console.error("Error fetching recruiter analytics:", err);
    res.status(500).json({ message: "Error fetching analytics" });
  }
});

export default router;

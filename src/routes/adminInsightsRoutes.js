// ✅ routes/adminInsightsRoutes.js
import express from "express";
import asyncHandler from "express-async-handler";
import { protect } from "../middleware/auth.js";
import User from "../models/User.js";
import Job from "../models/Job.js";

const router = express.Router();

/* =====================================================
   🛡️ Admin Access Middleware
===================================================== */
const adminGate = (req, res, next) => {
  if (req.user && (req.user.role === "admin" || req.user.role === "superadmin")) {
    return next();
  }
  return res.status(403).json({ message: "Access denied: Admin only" });
};

/* =====================================================
   📊 GET /api/admin/insights
   Returns: System-wide KPIs for admin dashboard
===================================================== */
router.get(
  "/insights",
  protect,
  adminGate,
  asyncHandler(async (_req, res) => {
    // 🔹 Job Stats
    const [totalJobs, openJobs, closedJobs] = await Promise.all([
      Job.countDocuments({}),
      Job.countDocuments({ status: { $in: ["open", "active", "approved"] } }),
      Job.countDocuments({ status: { $in: ["closed", "inactive"] } }),
    ]);

    // 🔹 Recruiter Stats
    const [totalRecruiters, approvedRecruiters, pendingRecruiters] =
      await Promise.all([
        User.countDocuments({ role: "recruiter" }),
        User.countDocuments({ role: "recruiter", status: "approved" }),
        User.countDocuments({ role: "recruiter", status: "pending" }),
      ]);

    // 🔹 Applicants Stats
    const allJobs = await Job.find({}, "applicants createdAt");
    const totalApplicants = allJobs.reduce(
      (acc, j) => acc + (j.applicants?.length || 0),
      0
    );

    // 🔹 Applicants added in the last 7 days
    const now = new Date();
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    let last7dApplicants = 0;
    allJobs.forEach((j) => {
      (j.applicants || []).forEach((a) => {
        if (a.appliedAt && new Date(a.appliedAt) >= last7d) {
          last7dApplicants += 1;
        }
      });
    });

    res.json({
      jobs: { totalJobs, openJobs, closedJobs },
      recruiters: { totalRecruiters, approvedRecruiters, pendingRecruiters },
      applicants: { totalApplicants, last7dApplicants },
      generatedAt: new Date(),
    });
  })
);

export default router;

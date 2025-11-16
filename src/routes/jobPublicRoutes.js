import express from "express";
import asyncHandler from "express-async-handler";
import Job from "../models/Job.js";
import User from "../models/User.js";
import { protect } from "../middleware/auth.js";
import AuditLog from "../models/AuditLog.js";
import { notifyUser } from "../utils/notifyUser.js";

const router = express.Router();

/* =====================================================
   🌍 GET /api/jobs — Get All Open Jobs
===================================================== */
router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const jobs = await Job.find({ status: "open" })
      .populate("recruiter", "name email orgName")
      .sort({ createdAt: -1 });

    res.json(jobs);
  })
);

/* =====================================================
   📄 GET /api/jobs/:id — Job Details
===================================================== */
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const job = await Job.findById(req.params.id).populate("recruiter", "name email orgName");
    if (!job) return res.status(404).json({ message: "Job not found" });
    res.json(job);
  })
);

/* =====================================================
   🧑‍🎓 POST /api/jobs/:id/apply — Apply for a Job
===================================================== */
router.post(
  "/:id/apply",
  protect,
  asyncHandler(async (req, res) => {
    if (req.user.role !== "candidate") {
      return res.status(403).json({ message: "Only candidates can apply for jobs." });
    }

    const job = await Job.findById(req.params.id).populate("recruiter", "name email");
    if (!job) return res.status(404).json({ message: "Job not found" });
    if (job.status !== "open") return res.status(400).json({ message: "Job is closed." });

    // 🧩 Check if already applied
    const alreadyApplied = job.applicants.some(
      (a) => a.user.toString() === req.user._id.toString()
    );
    if (alreadyApplied) {
      return res.status(400).json({ message: "You have already applied for this job." });
    }

    // ✅ Add candidate to job applicants
    job.applicants.push({ user: req.user._id, status: "applied" });
    await job.save();

    // ✅ Add job to user's application list
    const me = await User.findById(req.user._id);
    me.applications.push({ job: job._id, status: "applied" });
    await me.save();

    // 🧾 Create audit log
    await AuditLog.create({
      action: "JOB_APPLY",
      performedBy: req.user._id,
      targetUser: req.user._id,
      details: `Candidate ${req.user.name} applied to job "${job.title}" (${job._id})`,
    });

    /* =====================================================
       🔔 Notifications
    ====================================================== */

    // 🔔 Notify Candidate (self)
    await notifyUser({
      userId: req.user._id,
      email: req.user.email,
      title: "Application Submitted ✅",
      message: `You successfully applied to "${job.title}".`,
      link: `/candidate/applications`,
      type: "application",
      emailSubject: "Application Submitted - OneStop Hub",
    });

    // 🔔 Notify Recruiter
    if (job.recruiter) {
      await notifyUser({
        userId: job.recruiter._id,
        email: job.recruiter.email,
        title: "New Application Received 👤",
        message: `${req.user.name} applied for your job "${job.title}".`,
        link: `/recruiter/jobs/${job._id}/applications`,
        type: "candidate",
        emailSubject: `New Application - ${job.title}`,
      });
    }

    res.status(200).json({ message: "Applied successfully ✅" });
  })
);

export default router;

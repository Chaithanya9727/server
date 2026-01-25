import express from "express";
import asyncHandler from "express-async-handler";
import Job from "../models/Job.js";
import User from "../models/User.js";
import { protect } from "../middleware/auth.js";
import AuditLog from "../models/AuditLog.js";
import Application from "../models/Application.js";
import { notifyUser } from "../utils/notifyUser.js";

const router = express.Router();

/* =====================================================
   🌍 GET /api/jobs — Get All Open Jobs
===================================================== */
router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const jobs = await Job.find({ status: { $in: ["approved", "active", "open"] } })
      .populate("postedBy", "name email orgName")
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
    const job = await Job.findById(req.params.id).populate("postedBy", "name email orgName");
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

    const job = await Job.findById(req.params.id).populate("postedBy", "name email");
    if (!job) return res.status(404).json({ message: "Job not found" });
    
    // Allow applying if status is active, approved, or open
    const allowedStatuses = ["active", "approved", "open"];
    if (!allowedStatuses.includes(job.status)) {
      return res.status(400).json({ message: "Job is closed." });
    }

    // 🧩 Check if already applied (Single Source of Truth)
    const existingApplication = await Application.findOne({ 
      job: req.params.id, 
      candidate: req.user._id 
    });

    if (existingApplication) {
      return res.status(400).json({ message: "You have already applied for this job." });
    }

    // ✅ Create new Application document
    const application = await Application.create({
      job: job._id,
      candidate: req.user._id,
      status: "applied",
      resumeUrl: req.user.resumeUrl || "", // Assuming user has resumeUrl, else empty
      coverLetter: req.body.coverLetter || ""
    });

    // ✅ Add application reference to job applicants (Array of ObjectIds)
    job.applicants.push(application._id);
    await job.save();

    // ✅ Add application reference to user's application list (Subdocuments)
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
    if (job.postedBy) {
      await notifyUser({
        userId: job.postedBy._id,
        email: job.postedBy.email,
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

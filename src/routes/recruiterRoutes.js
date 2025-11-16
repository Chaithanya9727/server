// routes/recruiterRoutes.js
import express from "express";
import { protect } from "../middleware/auth.js";
import { authorize } from "../middleware/authorize.js";
import Job from "../models/Job.js";
import User from "../models/User.js";
import Application from "../models/Application.js";
import AuditLog from "../models/AuditLog.js";
import { sendEmail } from "../utils/sendEmail.js";
import { notifyUser } from "../utils/notifyUser.js";

const router = express.Router();

/* =====================================================
   💼 Recruiter — Create Job
===================================================== */
router.post("/jobs", protect, authorize(["recruiter"]), async (req, res) => {
  try {
    const { title, description, skills, location, salary } = req.body;

    const job = await Job.create({
      title,
      description,
      skills,
      location,
      salary,
      postedBy: req.user._id,
      status: "pending",
    });

    await AuditLog.create({
      action: "CREATE_JOB",
      performedBy: req.user._id,
      targetUser: req.user._id,
      details: `Recruiter ${req.user.email} created job "${title}"`,
    });

    res
      .status(201)
      .json({ message: "Job created successfully and pending admin approval ✅", job });
  } catch (err) {
    console.error("Error creating job:", err);
    res.status(500).json({ message: "Error creating job" });
  }
});

/* =====================================================
   🧾 Recruiter — Get My Jobs (and alias /jobs)
===================================================== */
router.get("/my-jobs", protect, authorize(["recruiter"]), async (req, res) => {
  try {
    const jobs = await Job.find({ postedBy: req.user._id }).sort({ createdAt: -1 });
    res.json(jobs);
  } catch (err) {
    console.error("Error fetching recruiter jobs:", err);
    res.status(500).json({ message: "Error fetching jobs" });
  }
});

// alias to match frontend calling /api/recruiter/jobs
router.get("/jobs", protect, authorize(["recruiter"]), async (req, res) => {
  try {
    const jobs = await Job.find({ postedBy: req.user._id }).sort({ createdAt: -1 });
    res.json(jobs);
  } catch (err) {
    console.error("Error fetching recruiter jobs:", err);
    res.status(500).json({ message: "Error fetching jobs" });
  }
});

/* =====================================================
   📋 Recruiter — View Applications for a Job
===================================================== */
router.get("/jobs/:id/applications", protect, authorize(["recruiter"]), async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ message: "Job not found" });

    if (job.postedBy.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "Not authorized to view this job’s applications" });

    const applications = await Application.find({ job: job._id }).populate(
      "candidate",
      "name email"
    );
    res.json(applications);
  } catch (err) {
    console.error("Error fetching applications:", err);
    res.status(500).json({ message: "Error fetching applications" });
  }
});

/* =====================================================
   🧠 Recruiter — Update Application Status
===================================================== */
router.patch("/applications/:id/status", protect, authorize(["recruiter"]), async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ["shortlisted", "rejected", "hired"];
    if (!validStatuses.includes(status))
      return res.status(400).json({ message: "Invalid application status" });

    const application = await Application.findById(req.params.id)
      .populate("candidate", "name email")
      .populate("job", "title postedBy");

    if (!application) return res.status(404).json({ message: "Application not found" });

    const job = application.job;
    if (job.postedBy.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "Not authorized to modify this application" });

    application.status = status;
    await application.save();

    await AuditLog.create({
      action: "UPDATE_APPLICATION_STATUS",
      performedBy: req.user._id,
      targetUser: application.candidate._id,
      details: `Application for job "${job.title}" marked as ${status} by recruiter`,
    });

    // ✉️ Send Email + Notify Candidate
    let emailSubject = "";
    let emailBody = "";

    switch (status) {
      case "shortlisted":
        emailSubject = "🎯 Application Shortlisted - OneStop Hub";
        emailBody = `Hello ${application.candidate.name},\n\nYour application for "${job.title}" has been shortlisted! The recruiter may contact you soon.\n\n— Team OneStop Hub`;
        break;
      case "rejected":
        emailSubject = "❌ Application Update - OneStop Hub";
        emailBody = `Hello ${application.candidate.name},\n\nUnfortunately, your application for "${job.title}" was not shortlisted.\nKeep applying — opportunities await!\n\n— Team OneStop Hub`;
        break;
      case "hired":
        emailSubject = "🎉 Congratulations! You're Hired - OneStop Hub";
        emailBody = `Hello ${application.candidate.name},\n\nCongratulations! You have been hired for "${job.title}".\nThe recruiter will reach out soon.\n\n— Team OneStop Hub`;
        break;
    }

    await sendEmail(application.candidate.email, emailSubject, emailBody);
    await notifyUser(application.candidate._id, {
      title: emailSubject,
      message: emailBody.replace(/\n/g, " "),
      type: "candidate",
    });

    res.json({ message: `Application status updated to "${status}" ✅`, application });
  } catch (err) {
    console.error("Error updating application status:", err);
    res.status(500).json({ message: "Error updating application status" });
  }
});

/* =====================================================
   💬 Recruiter — Notify Candidate Manually
===================================================== */
router.post("/applications/:id/notify", protect, authorize(["recruiter"]), async (req, res) => {
  try {
    const { message } = req.body;
    const application = await Application.findById(req.params.id)
      .populate("candidate", "name email")
      .populate("job", "title postedBy");

    if (!application) return res.status(404).json({ message: "Application not found" });
    const job = application.job;
    if (job.postedBy.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "Not authorized" });

    await sendEmail(
      application.candidate.email,
      `Message Regarding "${job.title}"`,
      `Hello ${application.candidate.name},\n\n${message}\n\n— ${req.user.name} (Recruiter)`
    );

    await notifyUser(application.candidate._id, {
      title: `New Message from Recruiter`,
      message,
      type: "candidate",
    });

    await AuditLog.create({
      action: "NOTIFY_CANDIDATE",
      performedBy: req.user._id,
      targetUser: application.candidate._id,
      details: `Recruiter ${req.user.email} sent a custom message regarding "${job.title}"`,
    });

    res.json({ message: "Candidate notified successfully 📩" });
  } catch (err) {
    console.error("Error notifying candidate:", err);
    res.status(500).json({ message: "Error notifying candidate" });
  }
});

/* =====================================================
   ⚙️ Recruiter — Profile Management (/rpanel/profile)
===================================================== */
router.get("/rpanel/profile", protect, authorize(["recruiter"]), async (req, res) => {
  try {
    const recruiter = await User.findById(req.user._id).select(
      "name email mobile orgName avatar companyWebsite companyDescription"
    );
    if (!recruiter) return res.status(404).json({ message: "Recruiter not found" });
    res.json(recruiter);
  } catch (err) {
    console.error("Error fetching recruiter profile:", err);
    res.status(500).json({ message: "Error fetching recruiter profile" });
  }
});

router.patch("/rpanel/profile", protect, authorize(["recruiter"]), async (req, res) => {
  try {
    const updates = (({
      name,
      mobile,
      orgName,
      avatar,
      companyWebsite,
      companyDescription,
    }) => ({
      name,
      mobile,
      orgName,
      avatar,
      companyWebsite,
      companyDescription,
    }))(req.body);

    const recruiter = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
      select: "name email mobile orgName avatar companyWebsite companyDescription",
    });

    await AuditLog.create({
      action: "UPDATE_RECRUITER_PROFILE",
      performedBy: req.user._id,
      targetUser: req.user._id,
      details: `Recruiter ${req.user.email} updated profile details`,
    });

    res.json({ message: "Profile updated successfully ✅", recruiter });
  } catch (err) {
    console.error("Error updating recruiter profile:", err);
    res.status(500).json({ message: "Error updating recruiter profile" });
  }
});

/* =====================================================
   📊 Recruiter — Analytics & Overview
===================================================== */
router.get("/analytics", protect, authorize(["recruiter"]), async (req, res) => {
  try {
    const jobs = await Job.find({ postedBy: req.user._id }).select("_id");
    const jobIds = jobs.map(j => j._id);

    const countsAgg = await Application.aggregate([
      { $match: { job: { $in: jobIds } } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const counts = { applied: 0, shortlisted: 0, rejected: 0, hired: 0 };
    countsAgg.forEach(r => (counts[r._id] = r.count || 0));

    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);

    const trendAgg = await Application.aggregate([
      { $match: { job: { $in: jobIds }, createdAt: { $gte: last7Days } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          applications: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const trends = trendAgg.map(t => ({ date: t._id, applications: t.applications }));

    res.json({
      totalJobs: jobs.length,
      totalApplications: counts.applied + counts.shortlisted + counts.hired,
      hiredCount: counts.hired,
      counts,
      trends,
    });
  } catch (err) {
    console.error("Error fetching recruiter analytics:", err);
    res.status(500).json({ message: "Error fetching analytics" });
  }
});

router.get("/rpanel/overview", protect, authorize(["recruiter"]), async (req, res) => {
  try {
    const jobs = await Job.find({ postedBy: req.user._id }).sort({ createdAt: -1 }).limit(5);
    const jobCount = await Job.countDocuments({ postedBy: req.user._id });
    const appCount = await Application.countDocuments({
      job: { $in: jobs.map(j => j._id) },
    });
    const hired = await Application.countDocuments({
      job: { $in: jobs.map(j => j._id) },
      status: "hired",
    });

    res.json({
      totalJobs: jobCount,
      totalApplications: appCount,
      hiredCount: hired,
      recentJobs: jobs,
    });
  } catch (err) {
    console.error("Error fetching recruiter overview:", err);
    res.status(500).json({ message: "Error fetching overview" });
  }
});

/* =====================================================
   📦 Recruiter — All Applications (Fallback)
   GET /api/recruiter/applications
   Returns all applications across all jobs posted by the recruiter
===================================================== */
router.get("/applications", protect, authorize(["recruiter"]), async (req, res) => {
  try {
    const myJobs = await Job.find({ postedBy: req.user._id }).select("_id title");
    const jobIds = myJobs.map((j) => j._id);

    if (jobIds.length === 0) {
      return res.json({ applications: [] });
    }

    const applications = await Application.find({ job: { $in: jobIds } })
      .populate("job", "title")
      .populate("candidate", "name email")
      .sort({ createdAt: -1 });

    res.json({ applications });
  } catch (err) {
    console.error("Error fetching all recruiter applications:", err);
    res.status(500).json({ message: "Error fetching recruiter applications" });
  }
});

export default router;

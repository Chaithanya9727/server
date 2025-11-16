    import express from "express";
import asyncHandler from "express-async-handler";
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import { protect } from "../middleware/auth.js";
import User from "../models/User.js";
import Job from "../models/Job.js";
import { notify } from "../utils/notify.js";

const router = express.Router();

/* =======================
   Cloudinary Config
======================= */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: async () => ({
    folder: "onestop/resumes",
    resource_type: "raw",
    format: "pdf",
  }),
});
const upload = multer({ storage });

/* =====================================================
   📄 GET /api/candidate/profile
===================================================== */
router.get(
  "/profile",
  protect,
  asyncHandler(async (req, res) => {
    if (req.user.role !== "candidate")
      return res.status(403).json({ message: "Candidates only" });

    const user = await User.findById(req.user._id)
      .select("-password")
      .populate("savedJobs", "title location status deadline");

    res.json(user);
  })
);

/* =====================================================
   ⬆️ POST /api/candidate/resume  (multipart/form-data)
   body: { file: <pdf> }
===================================================== */
router.post(
  "/resume",
  protect,
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (req.user.role !== "candidate")
      return res.status(403).json({ message: "Candidates only" });

    if (!req.file?.path) {
      return res.status(400).json({ message: "Resume file is required" });
    }

    const user = await User.findById(req.user._id);
    // Remove old resume from Cloudinary if exists
    if (user.resumePublicId) {
      try {
        await cloudinary.uploader.destroy(user.resumePublicId, { resource_type: "raw" });
      } catch (e) {
        console.warn("Cloudinary destroy warning:", e.message);
      }
    }

    user.resumeUrl = req.file.path;
    user.resumePublicId = req.file.filename || "";
    await user.save();

    await notify({
      userId: user._id,
      title: "Resume Uploaded",
      message: "Your resume was uploaded successfully.",
      type: "application",
    });

    res.json({ message: "Resume uploaded successfully ✅", resumeUrl: user.resumeUrl });
  })
);

/* =====================================================
   📝 PUT /api/candidate/cover-letter
   body: { coverLetter }
===================================================== */
router.put(
  "/cover-letter",
  protect,
  asyncHandler(async (req, res) => {
    if (req.user.role !== "candidate")
      return res.status(403).json({ message: "Candidates only" });

    const { coverLetter = "" } = req.body;
    const user = await User.findById(req.user._id);
    user.coverLetter = coverLetter;
    await user.save();

    res.json({ message: "Cover letter updated ✅" });
  })
);

/* =====================================================
   💾 POST /api/candidate/save/:jobId  — save job
===================================================== */
router.post(
  "/save/:jobId",
  protect,
  asyncHandler(async (req, res) => {
    if (req.user.role !== "candidate")
      return res.status(403).json({ message: "Candidates only" });

    const job = await Job.findById(req.params.jobId);
    if (!job) return res.status(404).json({ message: "Job not found" });

    const user = await User.findById(req.user._id);
    if (!user.savedJobs.includes(job._id)) {
      user.savedJobs.push(job._id);
      await user.save();
    }
    res.json({ message: "Job saved ✅" });
  })
);

/* =====================================================
   🗑️ DELETE /api/candidate/save/:jobId  — unsave job
===================================================== */
router.delete(
  "/save/:jobId",
  protect,
  asyncHandler(async (req, res) => {
    if (req.user.role !== "candidate")
      return res.status(403).json({ message: "Candidates only" });

    const user = await User.findById(req.user._id);
    user.savedJobs = user.savedJobs.filter((id) => id.toString() !== req.params.jobId);
    await user.save();

    res.json({ message: "Job removed from saved list ❌" });
  })
);

/* =====================================================
   📋 GET /api/candidate/applications — list my applications
===================================================== */
router.get(
  "/applications",
  protect,
  asyncHandler(async (req, res) => {
    if (req.user.role !== "candidate")
      return res.status(403).json({ message: "Candidates only" });

    const user = await User.findById(req.user._id).populate({
      path: "applications.job",
      select: "title location status deadline recruiter",
      populate: { path: "recruiter", select: "name email orgName" },
    });

    res.json(user.applications || []);
  })
);

/* =====================================================
   🔁 PATCH /api/candidate/applications/:jobId/status — update my app status (withdraw)
   body: { status: "withdrawn" }
===================================================== */
router.patch(
  "/applications/:jobId/status",
  protect,
  asyncHandler(async (req, res) => {
    if (req.user.role !== "candidate")
      return res.status(403).json({ message: "Candidates only" });

    const { status } = req.body; // allow only "withdrawn" by candidate
    if (!["withdrawn"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const user = await User.findById(req.user._id);
    const app = user.applications.find((a) => a.job.toString() === req.params.jobId);
    if (!app) return res.status(404).json({ message: "Application not found" });
    app.status = "withdrawn";
    app.updatedAt = new Date();
    await user.save();

    const job = await Job.findById(req.params.jobId);
    if (job) {
      const ja = job.applicants.find((a) => a.user.toString() === req.user._id.toString());
      if (ja) {
        ja.status = "withdrawn";
        ja.updatedAt = new Date();
        await job.save();
      }
    }

    res.json({ message: "Application withdrawn ✅" });
  })
);

export default router;

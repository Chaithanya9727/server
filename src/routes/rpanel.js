// routes/rpanel.js
import express from "express";
import { protect } from "../middleware/auth.js";
import { authorize } from "../middleware/authorize.js";
import User from "../models/User.js";
import Job from "../models/Job.js";
import Application from "../models/Application.js";

const router = express.Router();

/**
 * GET /api/rpanel/profile
 * Returns the current recruiter's profile info
 */
router.get("/profile", protect, authorize(["recruiter"]), async (req, res) => {
  try {
    // select fields to return
    const user = await User.findById(req.user._id).select(
      "name email mobile orgName avatar companyWebsite companyDescription"
    );
    if (!user) return res.status(404).json({ message: "Profile not found" });
    res.json(user);
  } catch (err) {
    console.error("GET /api/rpanel/profile error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * PATCH /api/rpanel/profile
 * Update the recruiter's profile fields
 */
router.patch("/profile", protect, authorize(["recruiter"]), async (req, res) => {
  try {
    const updates = {};
    const allowed = ["name", "mobile", "orgName", "avatar", "companyWebsite", "companyDescription"];
    allowed.forEach((k) => {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    });

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true }).select(
      "name email mobile orgName avatar companyWebsite companyDescription"
    );
    res.json(user);
  } catch (err) {
    console.error("PATCH /api/rpanel/profile error:", err);
    res.status(500).json({ message: "Error updating profile" });
  }
});

/**
 * GET /api/rpanel/overview
 * Small overview data for the recruiter dashboard (counts)
 */
router.get("/overview", protect, authorize(["recruiter"]), async (req, res) => {
  try {
    const jobCount = await Job.countDocuments({ postedBy: req.user._id });
    const appsCount = await Application.countDocuments({ job: { $in: (await Job.find({ postedBy: req.user._id }).select("_id")).map(j=>j._id) } });

    res.json({
      jobs: jobCount,
      applications: appsCount,
    });
  } catch (err) {
    console.error("GET /api/rpanel/overview error:", err);
    res.status(500).json({ message: "Error fetching overview" });
  }
});

export default router;

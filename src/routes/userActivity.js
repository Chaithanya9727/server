import express from "express";
import { protect } from "../middleware/auth.js";
import User from "../models/User.js";

const router = express.Router();

// 📌 Get my login history
router.get("/me/logins", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("lastLogin loginHistory");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({
      lastLogin: user.lastLogin || null,
      loginHistory: user.loginHistory || [],
    });
  } catch (err) {
    console.error("Error fetching login activity:", err);
    res.status(500).json({ message: "Failed to fetch login activity" });
  }
});

export default router;

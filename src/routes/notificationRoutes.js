import express from "express";
import { protect } from "../middleware/auth.js";

const router = express.Router();

/**
 * 🔔 Clear all notifications (for now just simulate)
 * Later you can extend this to mark them as "read" in DB
 */
router.delete("/clear", protect, async (req, res) => {
  try {
    // ✅ If you want DB persistence later:
    // await Notification.updateMany({ user: req.user._id }, { read: true });

    res.json({ success: true, message: "Notifications cleared" });
  } catch (err) {
    console.error("Clear notifications error:", err);
    res.status(500).json({ message: "Error clearing notifications" });
  }
});

export default router;

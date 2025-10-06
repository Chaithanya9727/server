import express from "express";
import { protect } from "../middleware/auth.js";
import User from "../models/User.js";
import cloudinary from "../utils/cloudinary.js";
import multer from "multer";
import bcrypt from "bcryptjs";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// ===========================
// 🔹 Update profile (name/email/avatar)
// ===========================
router.put("/", protect, upload.single("avatar"), async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // ✅ Update name/email
    user.name = req.body.name || user.name;
    user.email = req.body.email || user.email;

    // ✅ Avatar upload to Cloudinary
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "onestophub/avatars",
        resource_type: "image",
      });
      user.avatar = result.secure_url;
    }

    await user.save();
    res.json({ message: "Profile updated ✅", user });
  } catch (err) {
    console.error("Profile update error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ===========================
// 🔹 Change password
// ===========================
router.put("/password", protect, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: "Both old & new passwords required" });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid old password" });

    user.password = newPassword;
    await user.save();

    res.json({ message: "Password changed successfully ✅" });
  } catch (err) {
    console.error("Password change error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;

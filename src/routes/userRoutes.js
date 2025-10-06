import express from "express";
import User from "../models/User.js";
import { protect } from "../middleware/auth.js";
import bcrypt from "bcryptjs";
import { authorize } from "../middleware/authorize.js";
import { sendEmail } from "../utils/sendEmail.js";
import AuditLog from "../models/AuditLog.js";
import multer from "multer";
import cloudinary from "../utils/cloudinary.js";
import fs from "fs";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

/* =====================================================
   @route   GET /api/users/me
   @desc    Get current user profile
   @access  Private
===================================================== */
router.get("/me", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

/* =====================================================
   @route   PUT /api/users/me
   @desc    Update current user profile
   @access  Private
===================================================== */
router.put("/me", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.name = req.body.name || user.name;
    user.email = req.body.email || user.email;

    if (req.body.role && user.role === "admin") {
      user.role = req.body.role.toLowerCase();
    }

    const updatedUser = await user.save();
    res.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      avatar: updatedUser.avatar,
    });
  } catch (err) {
    res.status(500).json({ message: "Update failed" });
  }
});

/* =====================================================
   @route   PUT /api/users/me/password
   @desc    Change own password
   @access  Private
===================================================== */
router.put("/me/password", protect, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: "Both old and new password required" });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) return res.status(401).json({ message: "Old password is incorrect" });

    user.password = newPassword;
    await user.save();

    res.json({ message: "Password updated successfully ✅" });
  } catch (err) {
    res.status(500).json({ message: "Error updating password" });
  }
});

/* =====================================================
   @route   PUT /api/users/me/avatar
   @desc    Upload/Update avatar (Cloudinary overwrite)
   @access  Private
===================================================== */
router.put("/me/avatar", protect, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    // ✅ Always overwrite the same avatar for this user
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "avatars",
      public_id: `user_${req.user._id}`, // overwrite file by user id
      overwrite: true,
      resource_type: "image",
    });

    req.user.avatar = result.secure_url;
    await req.user.save();

    fs.unlinkSync(req.file.path);
    res.json(req.user);
  } catch (err) {
    console.error("Avatar upload error:", err);
    res.status(500).json({ message: "Error uploading avatar" });
  }
});

/* =====================================================
   @route   GET /api/users
   @desc    Get all users (Admin only, with optional search)
   @access  Private/Admin
===================================================== */
router.get("/", protect, authorize(["admin"]), async (req, res) => {
  try {
    const { search = "" } = req.query;

    const query = search
      ? {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    const users = await User.find(query).select("-password").limit(20);
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Error fetching users" });
  }
});

/* =====================================================
   @route   PUT /api/users/:id/role
   @desc    Update user role (Admin only)
   @access  Private/Admin
===================================================== */
router.put("/:id/role", protect, authorize(["admin"]), async (req, res) => {
  try {
    const { role } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const oldRole = user.role;
    user.role = role;
    await user.save();

    await AuditLog.create({
      action: "CHANGE_ROLE",
      targetUser: user._id,
      targetUserSnapshot: { name: user.name, email: user.email },
      performedBy: req.user._id,
      details: `Role changed from ${oldRole} → ${role}`,
    });

    res.json({ message: "Role updated successfully ✅" });
  } catch (err) {
    res.status(500).json({ message: "Error updating role" });
  }
});

/* =====================================================
   @route   PUT /api/users/:id/reset-password
   @desc    Reset user password (Admin only)
   @access  Private/Admin
===================================================== */
router.put("/:id/reset-password", protect, authorize(["admin"]), async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword) return res.status(400).json({ message: "New password required" });

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.password = newPassword;
    await user.save();

    await AuditLog.create({
      action: "RESET_PASSWORD",
      targetUser: user._id,
      targetUserSnapshot: { name: user.name, email: user.email },
      performedBy: req.user._id,
      details: `Password reset for ${user.email}`,
    });

    await sendEmail(
      user.email,
      "Your OneStop App Password Has Been Reset",
      `Hello ${user.name}, your password has been reset by an admin. New temporary password: ${newPassword}`
    );

    res.json({ message: "Password reset successfully ✅, email sent to user" });
  } catch (err) {
    res.status(500).json({ message: "Error resetting password" });
  }
});

/* =====================================================
   @route   DELETE /api/users/:id
   @desc    Delete a user (Admin only)
   @access  Private/Admin
===================================================== */
router.delete("/:id", protect, authorize(["admin"]), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    await AuditLog.create({
      action: "DELETE_USER",
      targetUser: user._id,
      targetUserSnapshot: { name: user.name, email: user.email },
      performedBy: req.user._id,
      details: `Deleted user: ${user.email}`,
    });

    await user.deleteOne();

    res.json({ message: "User deleted successfully ❌" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting user" });
  }
});

/* =====================================================
   @route   GET /api/users/audit
   @desc    Get audit logs (with pagination + search + filter)
   @access  Private/Admin
===================================================== */
router.get("/audit", protect, authorize(["admin"]), async (req, res) => {
  try {
    let { page = 1, limit = 10, search = "", action = "all", admin = "" } = req.query;
    page = Number(page);
    limit = Number(limit);

    const query = {};

    if (action !== "all") query.action = action;

    if (search) {
      query.$or = [
        { action: { $regex: search, $options: "i" } },
        { details: { $regex: search, $options: "i" } },
      ];
    }

    if (admin) {
      query.$or = [
        { "performedBy.name": { $regex: admin, $options: "i" } },
        { "performedBy.email": { $regex: admin, $options: "i" } },
      ];
    }

    const total = await AuditLog.countDocuments(query);

    const logs = await AuditLog.find(query)
      .populate("targetUser", "name email")
      .populate("performedBy", "name email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      logs,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("Error fetching logs:", err);
    res.status(500).json({ message: "Error fetching logs" });
  }
});

/* =====================================================
   @route   DELETE /api/users/audit/bulk
   @desc    Bulk delete audit logs
   @access  Private/Admin
===================================================== */
router.delete("/audit/bulk", protect, authorize(["admin"]), async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "No log IDs provided" });
    }

    await AuditLog.deleteMany({ _id: { $in: ids } });

    res.json({ message: `${ids.length} logs deleted successfully ✅` });
  } catch (err) {
    console.error("Bulk delete logs error:", err);
    res.status(500).json({ message: "Error deleting logs" });
  }
});

/* =====================================================
   @route   DELETE /api/users/audit/:id
   @desc    Delete a single audit log (Admin only)
   @access  Private/Admin
===================================================== */
router.delete("/audit/:id", protect, authorize(["admin"]), async (req, res) => {
  try {
    const log = await AuditLog.findById(req.params.id);
    if (!log) return res.status(404).json({ message: "Log not found" });

    await log.deleteOne();

    res.json({ message: "Audit log deleted ❌" });
  } catch (err) {
    console.error("Error deleting audit log:", err);
    res.status(500).json({ message: "Error deleting audit log" });
  }
});

export default router;

import express from "express";
import User from "../models/User.js";
import { protect } from "../middleware/auth.js";
import { authorize } from "../middleware/authorize.js";
import bcrypt from "bcryptjs";
import { sendEmail } from "../utils/sendEmail.js";
import AuditLog from "../models/AuditLog.js";
import multer from "multer";
import cloudinary from "../utils/cloudinary.js";
import fs from "fs";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

/* =====================================================
   🧾 SELF PROFILE ROUTES (For All Authenticated Users)
===================================================== */

// ✅ Get current user details
router.get("/me", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Update own info
router.put("/me", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.name = req.body.name || user.name;
    user.email = req.body.email || user.email;
    user.mobile = req.body.mobile || user.mobile;

    const updated = await user.save();
    res.json({
      _id: updated._id,
      name: updated.name,
      email: updated.email,
      mobile: updated.mobile,
      role: updated.role,
      avatar: updated.avatar,
    });
  } catch {
    res.status(500).json({ message: "Update failed" });
  }
});

// ✅ Change password
router.put("/me/password", protect, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const match = await bcrypt.compare(oldPassword, user.password);
    if (!match) return res.status(401).json({ message: "Old password wrong" });

    user.password = newPassword;
    await user.save();

    res.json({ message: "Password updated ✅" });
  } catch {
    res.status(500).json({ message: "Error updating password" });
  }
});

// ✅ Avatar upload
router.put("/me/avatar", protect, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "avatars",
      public_id: `user_${req.user._id}`,
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
   👑 USER MANAGEMENT (Admin + SuperAdmin)
===================================================== */

// ✅ Get users (Admin + SuperAdmin)
router.get("/", protect, authorize(["admin", "superadmin"]), async (req, res) => {
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

    const users = await User.find(query).select("-password").limit(100);
    res.json(users);
  } catch (err) {
    console.error("Fetch users error:", err);
    res.status(500).json({ message: "Error fetching users" });
  }
});

// ✅ Admin + SuperAdmin → Create Admin (Temporary for development)
router.post("/create-admin", protect, authorize(["admin", "superadmin"]), async (req, res) => {
  try {
    console.log("👉 Current user role:", req.user.role); // Debugging line

    const { name, email, password, mobile } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ message: "All fields required" });

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(400).json({ message: "Email exists" });

    const newAdmin = await User.create({
      name,
      email,
      password,
      mobile,
      role: "admin",
    });

    await AuditLog.create({
      action: "CREATE_ADMIN",
      performedBy: req.user._id,
      targetUser: newAdmin._id,
      targetUserSnapshot: { name: newAdmin.name, email: newAdmin.email },
      details: `${req.user.role} created admin: ${newAdmin.email}`,
    });

    await sendEmail(
      newAdmin.email,
      "🎓 OneStop Admin Account",
      `Hello ${newAdmin.name},\n\nYour admin account has been created.\n\nEmail: ${newAdmin.email}\nPassword: ${password}\n\n— OneStop Team`
    );

    res.status(201).json({ message: "Admin created ✅", newAdmin });
  } catch (err) {
    console.error("Create admin error:", err);
    res.status(500).json({ message: "Error creating admin" });
  }
});

// ✅ Change user role (SuperAdmin only)
router.put("/:id/role", protect, authorize(["superadmin"]), async (req, res) => {
  try {
    const { role } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const oldRole = user.role;
    user.role = role;
    await user.save();

    await AuditLog.create({
      action: "CHANGE_ROLE",
      performedBy: req.user._id,
      targetUser: user._id,
      targetUserSnapshot: { name: user.name, email: user.email },
      details: `Role changed ${oldRole} → ${role}`,
    });

    res.json({ message: "Role updated ✅" });
  } catch (err) {
    console.error("Change role error:", err);
    res.status(500).json({ message: "Error updating role" });
  }
});

// ✅ Reset password (Admin + SuperAdmin)
router.put("/:id/reset-password", protect, authorize(["admin", "superadmin"]), async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword) return res.status(400).json({ message: "Password required" });

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.password = newPassword;
    await user.save();

    await AuditLog.create({
      action: "RESET_PASSWORD",
      performedBy: req.user._id,
      targetUser: user._id,
      details: `Password reset for ${user.email}`,
    });

    await sendEmail(
      user.email,
      "🔐 OneStop Password Reset",
      `Hello ${user.name},\nYour password was reset by ${req.user.role}.\nNew Password: ${newPassword}`
    );

    res.json({ message: "Password reset ✅" });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ message: "Error resetting password" });
  }
});

// ✅ Delete user (SuperAdmin only)
router.delete("/:id", protect, authorize(["superadmin"]), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    await AuditLog.create({
      action: "DELETE_USER",
      performedBy: req.user._id,
      targetUser: user._id,
      targetUserSnapshot: { name: user.name, email: user.email },
      details: `SuperAdmin deleted user: ${user.email}`,
    });

    await user.deleteOne();
    res.json({ message: "User deleted ❌" });
  } catch (err) {
    console.error("Delete user error:", err);
    res.status(500).json({ message: "Error deleting user" });
  }
});

/* =====================================================
   🧾 AUDIT LOG MANAGEMENT
===================================================== */

// ✅ View audit logs (Admin + SuperAdmin)
router.get("/audit", protect, authorize(["admin", "superadmin"]), async (req, res) => {
  try {
    let { page = 1, limit = 10, search = "", action = "all" } = req.query;
    page = Number(page);
    limit = Number(limit);

    const query = {};
    if (action !== "all") query.action = action;
    if (search)
      query.$or = [
        { action: { $regex: search, $options: "i" } },
        { details: { $regex: search, $options: "i" } },
      ];

    const total = await AuditLog.countDocuments(query);
    const logs = await AuditLog.find(query)
      .populate("performedBy", "name email role")
      .populate("targetUser", "name email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({ logs, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("Fetch logs error:", err);
    res.status(500).json({ message: "Error fetching audit logs" });
  }
});

// ✅ Bulk delete logs (SuperAdmin only)
router.delete("/audit/bulk", protect, authorize(["superadmin"]), async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids))
      return res.status(400).json({ message: "Invalid log IDs" });

    await AuditLog.deleteMany({ _id: { $in: ids } });

    await AuditLog.create({
      action: "DELETE_LOGS",
      performedBy: req.user._id,
      details: `Deleted ${ids.length} logs in bulk`,
    });

    res.json({ message: `${ids.length} logs deleted ✅` });
  } catch (err) {
    console.error("Delete logs error:", err);
    res.status(500).json({ message: "Error deleting logs" });
  }
});

export default router;

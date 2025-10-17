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
  } catch (err) {
    console.error("Fetch profile error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Update own profile info
router.put("/me", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.name = req.body.name || user.name;
    user.email = req.body.email || user.email;
    user.mobile = req.body.mobile || user.mobile;
    if (req.body.mentorProfile) user.mentorProfile = req.body.mentorProfile;

    const updated = await user.save();
    res.json(updated);
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ message: "Error updating profile" });
  }
});

// ✅ Change password
router.put("/me/password", protect, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select("+password");
    if (!user) return res.status(404).json({ message: "User not found" });

    const match = await bcrypt.compare(oldPassword, user.password);
    if (!match)
      return res.status(401).json({ message: "Old password incorrect" });

    user.password = newPassword;
    await user.save();

    await AuditLog.create({
      action: "USER_CHANGE_PASSWORD",
      performedBy: req.user._id,
      targetUser: req.user._id,
      details: `${user.email} changed their password.`,
    });

    res.json({ message: "Password updated ✅" });
  } catch (err) {
    console.error("Password change error:", err);
    res.status(500).json({ message: "Error updating password" });
  }
});

// ✅ Upload avatar
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

// ✅ Get all users
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

// ✅ Create Admin
router.post("/create-admin", protect, authorize(["admin", "superadmin"]), async (req, res) => {
  try {
    const { name, email, password, mobile } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ message: "All fields are required" });

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(400).json({ message: "Email already exists" });

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
      details: `Role changed ${oldRole} → ${role}`,
    });

    res.json({ message: "Role updated ✅" });
  } catch (err) {
    console.error("Change role error:", err);
    res.status(500).json({ message: "Error updating role" });
  }
});

/* =====================================================
   🆕 RESET PASSWORD BY ADMIN (NEWLY ADDED)
===================================================== */
router.put(
  "/:id/reset-password",
  protect,
  authorize(["admin", "superadmin"]),
  async (req, res) => {
    try {
      const { newPassword } = req.body;
      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      user.password = newPassword;
      await user.save();

      await AuditLog.create({
        action: "ADMIN_RESET_PASSWORD",
        performedBy: req.user._id,
        targetUser: user._id,
        targetUserSnapshot: { name: user.name, email: user.email, role: user.role },
        details: `${req.user.role} reset password for ${user.email}`,
      });

      await sendEmail(
        user.email,
        "🔒 Your Password Has Been Reset",
        `Hello ${user.name},\n\nYour account password was reset by an administrator.\nPlease log in using your new password.\n\nIf this wasn’t you, contact support immediately.\n\n— OneStop Hub`
      );

      res.json({ message: "Password reset successfully ✅" });
    } catch (err) {
      console.error("Reset password error:", err);
      res.status(500).json({ message: "Error resetting password" });
    }
  }
);

/* =====================================================
   🧑‍🏫 MENTOR MANAGEMENT (Admin + SuperAdmin)
===================================================== */

// ✅ Get pending mentors for approval
router.get("/mentors/pending", protect, authorize(["admin", "superadmin"]), async (req, res) => {
  try {
    const mentors = await User.find({
      mentorRequested: true,
      mentorApproved: false,
    }).select("-password");
    res.json(mentors);
  } catch (err) {
    console.error("Fetch pending mentors error:", err);
    res.status(500).json({ message: "Error fetching pending mentors" });
  }
});

// ✅ Approve mentor profile
router.put("/mentors/:id/approve", protect, authorize(["admin", "superadmin"]), async (req, res) => {
  try {
    const mentor = await User.findById(req.params.id);
    if (!mentor) return res.status(404).json({ message: "Mentor not found" });

    mentor.mentorApproved = true;
    mentor.mentorRequested = false;
    mentor.role = "mentor";
    await mentor.save();

    await AuditLog.create({
      action: "APPROVE_MENTOR",
      performedBy: req.user._id,
      targetUser: mentor._id,
      details: `${req.user.role} approved mentor: ${mentor.email}`,
    });

    await sendEmail(
      mentor.email,
      "✅ Mentor Approved - OneStop Hub",
      `Hi ${mentor.name},\n\nYour mentor profile has been approved by ${req.user.role}.`
    );

    res.json({ message: "Mentor approved successfully ✅" });
  } catch (err) {
    console.error("Approve mentor error:", err);
    res.status(500).json({ message: "Error approving mentor" });
  }
});

// ✅ Reject mentor profile
router.put("/mentors/:id/reject", protect, authorize(["admin", "superadmin"]), async (req, res) => {
  try {
    const mentor = await User.findById(req.params.id);
    if (!mentor) return res.status(404).json({ message: "Mentor not found" });

    mentor.mentorRequested = false;
    mentor.mentorProfile = {};
    await mentor.save();

    await AuditLog.create({
      action: "REJECT_MENTOR",
      performedBy: req.user._id,
      targetUser: mentor._id,
      details: `Rejected mentor: ${mentor.email}`,
    });

    res.json({ message: "Mentor application rejected ❌" });
  } catch (err) {
    console.error("Reject mentor error:", err);
    res.status(500).json({ message: "Error rejecting mentor" });
  }
});

// ✅ Assign mentor to candidate
router.put("/assign-mentor/:candidateId", protect, authorize(["admin", "superadmin"]), async (req, res) => {
  try {
    const { mentorId } = req.body;
    const candidate = await User.findById(req.params.candidateId);
    const mentor = await User.findById(mentorId);

    if (!candidate || !mentor)
      return res.status(404).json({ message: "Candidate or Mentor not found" });

    candidate.mentorAssigned = mentor._id;
    mentor.mentees.push(candidate._id);

    await candidate.save();
    await mentor.save();

    await AuditLog.create({
      action: "ASSIGN_MENTOR",
      performedBy: req.user._id,
      targetUser: candidate._id,
      details: `Mentor ${mentor.email} assigned to ${candidate.email}`,
    });

    res.json({ message: "Mentor assigned successfully ✅" });
  } catch (err) {
    console.error("Assign mentor error:", err);
    res.status(500).json({ message: "Error assigning mentor" });
  }
});

/* =====================================================
   🗑️ Delete User (SuperAdmin Only)
===================================================== */
router.delete("/:id", protect, authorize(["superadmin"]), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    await user.deleteOne();

    await AuditLog.create({
      action: "DELETE_USER",
      performedBy: req.user._id,
      targetUser: user._id,
      details: `SuperAdmin deleted user: ${user.email}`,
    });

    res.json({ message: "User deleted ❌" });
  } catch (err) {
    console.error("Delete user error:", err);
    res.status(500).json({ message: "Error deleting user" });
  }
});

/* =====================================================
   📜 AUDIT LOGS (Admin + SuperAdmin)
===================================================== */
router.get("/audit", protect, authorize(["admin", "superadmin"]), async (req, res) => {
  try {
    const logs = await AuditLog.find()
      .populate("performedBy", "name email role")
      .populate("targetUser", "name email role")
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({ logs });
  } catch (err) {
    console.error("Fetch audit logs error:", err);
    res.status(500).json({ message: "Error fetching audit logs" });
  }
});

export default router;

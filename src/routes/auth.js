// routes/auth.js
import express from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import passport from "passport";

import User from "../models/User.js";
import OTP from "../models/OTP.js";
import { protect } from "../middleware/auth.js";
import { sendEmail } from "../utils/sendEmail.js";

const router = express.Router();

// JWT generator
const generateToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: "7d" });

// ✅ Render-safe IPv6 compatible rate limiter
const otpLimiter = rateLimit({
  windowMs: 30 * 1000, // 30s cooldown
  max: 1,
  message: { message: "Please wait 30 seconds before requesting a new OTP." },
  keyGenerator: (req) => req.body?.email || ipKeyGenerator(req),
});

// ================= REGISTER =================
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role, mobile } = req.body;
    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(400).json({ message: "User already exists" });

    const user = await User.create({ name, email, password, role, mobile });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id, user.role),
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ================= LOGIN =================
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
    if (!user) return res.status(400).json({ message: "Invalid email or password" });

    const isMatch = await user.matchPassword(password);
    if (!isMatch) return res.status(400).json({ message: "Invalid email or password" });

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id, user.role),
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ================= CURRENT USER =================
router.get("/me", protect, async (req, res) => {
  try {
    const me = await User.findById(req.user._id).select("-password");
    if (!me) return res.status(404).json({ message: "User not found" });
    res.json(me);
  } catch (err) {
    console.error("Fetch user error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ================= SEND OTP (Email Only) =================
router.post("/send-otp", otpLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email required" });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ message: "User not found" });

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    await OTP.create({
      email: user.email,
      otp: otpCode,
      purpose: "password-reset",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    const emailSent = await sendEmail(
      user.email,
      "OneStop Password Reset Code",
      `Hello ${user.name || "User"},\n\nYour OneStop password reset OTP is: ${otpCode}\nThis code is valid for 5 minutes.\n\n— OneStop Team`
    );

    if (!emailSent)
      return res.status(500).json({ message: "Failed to send OTP email" });

    res.json({ message: "OTP sent to your registered email ✅" });
  } catch (err) {
    console.error("send-otp error:", err);
    res.status(500).json({ message: "Failed to send OTP" });
  }
});

// ================= VERIFY OTP =================
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    const found = await OTP.findOne({ email, otp, purpose: "password-reset" });

    if (!found || found.expiresAt < new Date()) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    await OTP.deleteMany({ email, purpose: "password-reset" });
    res.json({ success: true, message: "OTP verified ✅" });
  } catch (err) {
    console.error("verify-otp error:", err);
    res.status(500).json({ message: "OTP verification failed" });
  }
});

// ================= RESET PASSWORD =================
router.put("/reset-password", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ message: "User not found" });

    user.password = password;
    await user.save();

    await OTP.deleteMany({ email, purpose: "password-reset" });

    res.json({ message: "Password reset successful ✅" });
  } catch (err) {
    console.error("reset-password error:", err);
    res.status(500).json({ message: "Error resetting password" });
  }
});

// ================= FORGOT PASSWORD (Reset Link) =================
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ message: "User not found" });

    const resetToken = crypto.randomBytes(20).toString("hex");
    user.resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex");
    user.resetPasswordExpire = Date.now() + 15 * 60 * 1000;
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
    const ok = await sendEmail(
      user.email,
      "Password Reset Link",
      `Reset your password at this link:\n${resetUrl}`,
      `<p>Reset your password:</p><p><a href="${resetUrl}">${resetUrl}</a></p>`
    );

    if (!ok) return res.status(500).json({ message: "Email could not be sent" });

    res.json({ message: "Reset link sent to email ✅" });
  } catch (err) {
    console.error("forgot-password error:", err);
    res.status(500).json({ message: "Email could not be sent" });
  }
});

export default router;

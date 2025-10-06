// routes/auth.js
import express from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import twilio from "twilio";
import rateLimit from "express-rate-limit";
import passport from "passport";

import User from "../models/User.js";
import OTP from "../models/OTP.js";
import { protect } from "../middleware/auth.js";
import { sendEmail } from "../utils/sendEmail.js";

const router = express.Router();

// JWT generator
const generateToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: "7d" });

// Twilio setup
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// OTP rate limiter (per email/IP)
const otpLimiter = rateLimit({
  windowMs: 30 * 1000, // 30s
  max: 1,
  message: { message: "Please wait 30 seconds before requesting a new OTP." },
  keyGenerator: (req) => req.body?.email || req.ip,
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
    res.status(500).json({ message: "Server error" });
  }
});

// ================= SEND OTP (Email + SMS) =================
router.post("/send-otp", otpLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ message: "User not found" });

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    await OTP.create({
      email: user.email,
      phone: user.mobile || null,
      otp: otpCode,
      purpose: "password-reset",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    // Email
    await sendEmail(
      user.email,
      "OneStop Password Reset Code",
      `Hello ${user.name},\n\nYour password reset OTP is: ${otpCode}\nThis code is valid for 5 minutes.`
    );

    // SMS (if mobile is present)
    if (user.mobile) {
      try {
        await client.messages.create({
          body: `Your OneStop password reset OTP is ${otpCode}. Valid for 5 minutes.`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: user.mobile.startsWith("+") ? user.mobile : `+91${user.mobile}`,
        });
      } catch (e) {
        console.warn("SMS failed:", e.message);
      }
    }

    res.json({ message: "OTP sent to your registered email and phone ✅" });
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

    res.json({ message: "Password reset successful ✅" });
  } catch (err) {
    console.error("reset-password error:", err);
    res.status(500).json({ message: "Error resetting password" });
  }
});

// ================= EMAIL RESET LINK (Fallback) =================
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
    await sendEmail(user.email, "Password Reset Link", `Reset your password:\n${resetUrl}`);

    res.json({ message: "Reset link sent to email ✅" });
  } catch (err) {
    console.error("forgot-password error:", err);
    res.status(500).json({ message: "Email could not be sent" });
  }
});

// ================= OAUTH (Google) =================
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: `${process.env.CLIENT_URL}/login`, session: true }),
  (req, res) => {
    const token = generateToken(req.user._id, req.user.role);
    return res.redirect(`${process.env.CLIENT_URL}/oauth-success?token=${token}`);
  }
);

// ================= OAUTH (GitHub) =================
router.get("/github", passport.authenticate("github", { scope: ["user:email"] }));

router.get(
  "/github/callback",
  passport.authenticate("github", { failureRedirect: `${process.env.CLIENT_URL}/login`, session: true }),
  (req, res) => {
    const token = generateToken(req.user._id, req.user.role);
    return res.redirect(`${process.env.CLIENT_URL}/oauth-success?token=${token}`);
  }
);

export default router;

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

// ================= JWT =================
const generateToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: "7d" });

// ================= Twilio (optional if configured) =================
const hasTwilio =
  !!process.env.TWILIO_ACCOUNT_SID &&
  !!process.env.TWILIO_AUTH_TOKEN &&
  !!process.env.TWILIO_PHONE_NUMBER;

const twilioClient = hasTwilio
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

// ================= Rate limit OTP =================
const otpLimiter = rateLimit({
  windowMs: 30 * 1000,
  max: 1,
  message: { message: "Please wait 30 seconds before requesting a new OTP." },
  keyGenerator: (req) => (req.body?.email || "").toLowerCase().trim() || req.ip,
});

// ================= REGISTER =================
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role, mobile } = req.body;
    const normEmail = (email || "").toLowerCase().trim();
    if (!normEmail) return res.status(400).json({ message: "Email required" });

    const exists = await User.findOne({ email: normEmail });
    if (exists) return res.status(400).json({ message: "User already exists" });

    const user = await User.create({ name, email: normEmail, password, role, mobile });

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
    const normEmail = (email || "").toLowerCase().trim();
    if (!normEmail) return res.status(400).json({ message: "Email required" });

    const user = await User.findOne({ email: normEmail }).select("+password");
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
    console.error("Me error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ================= SEND OTP (Email + SMS) =================
router.post("/send-otp", otpLimiter, async (req, res) => {
  try {
    const normEmail = (req.body?.email || "").toLowerCase().trim();
    if (!normEmail) return res.status(400).json({ message: "Email required" });

    const user = await User.findOne({ email: normEmail });
    if (!user) return res.status(404).json({ message: "User not found" });

    // Generate OTP
    const otpCode = crypto.randomInt(100000, 999999).toString();

    // Save OTP doc (5 min)
    await OTP.create({
      email: user.email,
      phone: user.mobile || null,
      otp: otpCode,
      purpose: "password-reset",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    // Parallel send
    const tasks = [
      sendEmail(
        user.email,
        "OneStop Password Reset Code",
        `Hello ${user.name || "User"},\n\nYour password reset OTP is: ${otpCode}\nThis code is valid for 5 minutes.\n\n— OneStop Team`
      ),
    ];

    if (hasTwilio && user.mobile) {
      const toNumber = user.mobile.startsWith("+") ? user.mobile : `+91${user.mobile}`;
      tasks.push(
        twilioClient.messages
          .create({
            body: `Your OneStop OTP is ${otpCode}. Valid for 5 minutes.`,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: toNumber,
          })
          .then(() => true)
          .catch((e) => {
            console.warn("SMS failed:", e.message);
            return false;
          })
      );
    }

    const results = await Promise.allSettled(tasks);
    const emailOk = results[0].status === "fulfilled" ? results[0].value === true : false;
    const smsOk = results[1] ? (results[1].status === "fulfilled" ? results[1].value === true : false) : false;

    console.log(`📩 Email sent: ${emailOk} | 📱 SMS sent: ${smsOk}`);

    // Build honest message
    let message = "";
    if (emailOk && smsOk) message = "OTP sent to your registered email and phone ✅";
    else if (emailOk) message = "OTP sent to your registered email ✅";
    else if (smsOk) message = "OTP sent to your registered phone ✅";
    else message = "OTP generated, but sending failed. Please try again in 30 seconds.";

    return res.json({ message, email: emailOk, sms: smsOk });
  } catch (err) {
    console.error("send-otp error:", err);
    res.status(500).json({ message: "Failed to send OTP" });
  }
});

// ================= VERIFY OTP =================
router.post("/verify-otp", async (req, res) => {
  try {
    const normEmail = (req.body?.email || "").toLowerCase().trim();
    const otp = (req.body?.otp || "").trim();

    if (!normEmail || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ message: "Email and 6-digit OTP are required" });
    }

    const found = await OTP.findOne({
      email: normEmail,
      otp,
      purpose: "password-reset",
      expiresAt: { $gt: new Date() },
    });

    if (!found) return res.status(400).json({ message: "Invalid or expired OTP" });

    // Invalidate all OTPs for this email/purpose
    await OTP.deleteMany({ email: normEmail, purpose: "password-reset" });

    res.json({ success: true, message: "OTP verified ✅" });
  } catch (err) {
    console.error("verify-otp error:", err);
    res.status(500).json({ message: "OTP verification failed" });
  }
});

// ================= RESET PASSWORD =================
router.put("/reset-password", async (req, res) => {
  try {
    const normEmail = (req.body?.email || "").toLowerCase().trim();
    const { password } = req.body;

    if (!normEmail || !password) return res.status(400).json({ message: "Email and password required" });

    const user = await User.findOne({ email: normEmail });
    if (!user) return res.status(404).json({ message: "User not found" });

    user.password = password; // hashed by pre-save hook
    await user.save();

    // Optional: clear any leftover OTPs
    await OTP.deleteMany({ email: normEmail, purpose: "password-reset" });

    res.json({ message: "Password reset successful ✅" });
  } catch (err) {
    console.error("reset-password error:", err);
    res.status(500).json({ message: "Error resetting password" });
  }
});

// ================= EMAIL RESET LINK (Fallback) =================
router.post("/forgot-password", async (req, res) => {
  try {
    const normEmail = (req.body?.email || "").toLowerCase().trim();
    if (!normEmail) return res.status(400).json({ message: "Email required" });

    const user = await User.findOne({ email: normEmail });
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
      `<p>Reset your password at this link:</p><p><a href="${resetUrl}">${resetUrl}</a></p>`
    );

    if (!ok) return res.status(500).json({ message: "Email could not be sent" });

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

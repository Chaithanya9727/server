import express from "express";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import passport from "passport";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import OTP from "../models/OTP.js";
import AuditLog from "../models/AuditLog.js";
import { protect } from "../middleware/auth.js";
import { authorize } from "../middleware/authorize.js";
import { sendEmail } from "../utils/sendEmail.js";

const router = express.Router();

/* =====================================================
 🔑 JWT Generator
===================================================== */
const generateToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: "7d" });

/* =====================================================
 🚫 Rate Limiters
===================================================== */
const otpLimiter = rateLimit({
  windowMs: 30 * 1000,
  max: 1,
  message: { message: "Please wait 30 seconds before requesting another OTP." },
  keyGenerator: (req) => req.body?.email || req.ip,
});

/* =====================================================
 🧑‍🎓 REGISTER - Candidate
===================================================== */
router.post("/register-candidate", async (req, res) => {
  try {
    const { name, email, password, mobile } = req.body;
    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(400).json({ message: "User already exists" });

    // Verify email OTP
    const verifiedOtp = await OTP.findOne({
      email: email.toLowerCase(),
      purpose: "email-verification",
      verified: true,
    });

    if (!verifiedOtp)
      return res
        .status(400)
        .json({ message: "Please verify your email before registering." });

    const user = await User.create({
      name,
      email,
      password,
      mobile,
      role: "candidate",
      allowedRoles: ["candidate"], // ✅ initialize allowed roles
    });

    await OTP.deleteMany({ email: email.toLowerCase(), purpose: "email-verification" });

    res.status(201).json({
      message: "Candidate registered successfully ✅",
      token: generateToken(user._id, user.role),
    });
  } catch (err) {
    console.error("Register candidate error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =====================================================
 👑 CREATE ADMIN (SuperAdmin Only)
===================================================== */
router.post("/create-admin", protect, authorize(["superadmin"]), async (req, res) => {
  try {
    const { name, email, password, mobile } = req.body;
    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(400).json({ message: "Admin already exists" });

    const admin = await User.create({
      name,
      email,
      password,
      mobile,
      role: "admin",
      allowedRoles: ["admin"], // ✅ add allowedRoles
    });

    await AuditLog.create({
      action: "CREATE_ADMIN",
      targetUser: admin._id,
      performedBy: req.user._id,
      details: `SuperAdmin created Admin (${admin.email})`,
    });

    await sendEmail(
      admin.email,
      "Admin Account Created - OneStop Hub",
      `Hello ${admin.name},\n\nYou have been added as an Admin.\nYour password: ${password}\nPlease log in and change it immediately.\n\n— OneStop Team`
    );

    res.status(201).json({ message: "Admin created successfully ✅" });
  } catch (err) {
    console.error("Create admin error:", err);
    res.status(500).json({ message: "Error creating admin" });
  }
});

/* =====================================================
 🔐 LOGIN (With Multi-Role Validation)
===================================================== */
router.post("/login", async (req, res) => {
  try {
    const { email, password, selectedRole } = req.body;

    if (!email || !password || !selectedRole) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // ✅ Normalize roles for comparison
    const normalizedSelectedRole = selectedRole.toLowerCase();
    const normalizedAllowedRoles = (user.allowedRoles || []).map((r) => r.toLowerCase());

    // ✅ Validate if selected role is authorized
    if (
      user.role.toLowerCase() !== normalizedSelectedRole &&
      !normalizedAllowedRoles.includes(normalizedSelectedRole)
    ) {
      return res.status(403).json({
        message: `You are registered as a ${user.role}. Please select '${user.role}' or another authorized role to log in.`,
        allowedRoles: user.allowedRoles,
      });
    }

    // ✅ Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // ✅ Generate JWT Token
    const token = generateToken(user._id, normalizedSelectedRole);

    // 🧾 Log successful login
    await AuditLog.create({
      action: "LOGIN",
      performedBy: user._id,
      targetUser: user._id,
      details: `User logged in as ${normalizedSelectedRole} (${user.email})`,
    });

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: normalizedSelectedRole,
      token,
      message: `Welcome back, ${user.name} 👋`,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =====================================================
 👤 ME (Authenticated User)
===================================================== */
router.get("/me", protect, async (req, res) => {
  try {
    const me = await User.findById(req.user._id).select("-password");
    res.json(me);
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

/* =====================================================
 🔁 PASSWORD RESET (OTP)
===================================================== */
router.post("/send-otp", otpLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ message: "User not found" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await OTP.create({
      email,
      otp,
      purpose: "password-reset",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    await sendEmail(
      user.email,
      "OneStop Password Reset",
      `Your password reset OTP is ${otp}\nValid for 5 minutes.`
    );

    res.json({ message: "OTP sent to your email ✅" });
  } catch (err) {
    console.error("send-otp error:", err);
    res.status(500).json({ message: "Failed to send OTP" });
  }
});

router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    const record = await OTP.findOne({ email, otp, purpose: "password-reset" });
    if (!record || record.expiresAt < new Date())
      return res.status(400).json({ message: "Invalid or expired OTP" });

    await OTP.deleteMany({ email, purpose: "password-reset" });
    res.json({ success: true, message: "OTP verified ✅" });
  } catch {
    res.status(500).json({ message: "Error verifying OTP" });
  }
});

router.put("/reset-password", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ message: "User not found" });

    user.password = password;
    await user.save();
    await OTP.deleteMany({ email, purpose: "password-reset" });

    res.json({ message: "Password reset successfully ✅" });
  } catch {
    res.status(500).json({ message: "Error resetting password" });
  }
});

/* =====================================================
 📧 EMAIL VERIFICATION
===================================================== */
router.post("/send-verification-otp", otpLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(400).json({ message: "User already registered" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await OTP.create({
      email: email.toLowerCase(),
      otp,
      purpose: "email-verification",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      verified: false,
    });

    await sendEmail(
      email,
      "Verify Your Email - OneStop Hub",
      `Your OneStop Hub verification code is: ${otp}\nValid for 5 minutes.`
    );

    res.json({ message: "Verification OTP sent ✅" });
  } catch {
    res.status(500).json({ message: "Error sending verification OTP" });
  }
});

router.post("/verify-verification-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    const record = await OTP.findOne({
      email: email.toLowerCase(),
      otp,
      purpose: "email-verification",
    });
    if (!record || record.expiresAt < new Date())
      return res.status(400).json({ message: "Invalid or expired OTP" });

    record.verified = true;
    await record.save();
    res.json({ success: true, message: "Email verified successfully ✅" });
  } catch {
    res.status(500).json({ message: "Error verifying email" });
  }
});

/* =====================================================
 🌐 OAUTH (Google & GitHub)
===================================================== */
function redirectWithToken(res, user) {
  const token = generateToken(user._id, user.role);
  const redirectUrl = `${process.env.CLIENT_URL}/oauth-success?token=${token}`;
  return res.redirect(redirectUrl);
}

router.get("/google", passport.authenticate("google", { scope: ["profile", "email"], session: false }));

router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${process.env.CLIENT_URL}/login?error=google_oauth_failed`,
  }),
  async (req, res) => {
    await AuditLog.create({
      action: "OAUTH_LOGIN",
      targetUser: req.user._id,
      performedBy: req.user._id,
      details: `User logged in via Google (${req.user.email})`,
    });
    redirectWithToken(res, req.user);
  }
);

router.get("/github", passport.authenticate("github", { scope: ["user:email"], session: false }));

router.get(
  "/github/callback",
  passport.authenticate("github", {
    session: false,
    failureRedirect: `${process.env.CLIENT_URL}/login?error=github_oauth_failed`,
  }),
  async (req, res) => {
    await AuditLog.create({
      action: "OAUTH_LOGIN",
      targetUser: req.user._id,
      performedBy: req.user._id,
      details: `User logged in via GitHub (${req.user.email})`,
    });
    redirectWithToken(res, req.user);
  }
);

export default router;

// src/server.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import http from "http";
import session from "express-session";
import passport from "./config/passport.js";
import connectDB from "./db.js";
import initSocket from "./socket.js";

/* =====================================================
   🧩 IMPORT ROUTES
===================================================== */

// 🔑 Authentication & Core Users
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/userRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import userActivityRoutes from "./routes/userActivity.js";

// 📚 Resources & Communication
import resourceRoutes from "./routes/resourceRoutes.js";
import contactRoutes from "./routes/contactRoutes.js";
import noticeRoutes from "./routes/noticeRoutes.js";
import eventsRoutes from "./routes/events.js";
import chatRoutes from "./routes/chat.js";
import messageRoutes from "./routes/messageRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import mentorshipRoutes from "./routes/mentorshipRoutes.js";

// 🎓 Mentorship
import mentorRoutes from "./routes/mentorRoutes.js";

// 💼 Recruiter System
import recruiterRoutes from "./routes/recruiterRoutes.js";         
import recruiterPanelRoutes from "./routes/rpanel.js";                    // 🔥 FIXED
import recruiterAnalyticsRoutes from "./routes/recruiterAnalyticsRoutes.js";

// 👨‍💼 Admin Recruiter & Job Management
import adminRecruiterRoutes from "./routes/adminRecruiterRoutes.js";
import adminJobRoutes from "./routes/adminJobRoutes.js";

// 🌐 Public Jobs
import jobPublicRoutes from "./routes/jobPublicRoutes.js";

// 👨‍🎓 Candidate Features
import candidateRoutes from "./routes/candidateRoutes.js";

// 📊 Admin Insights & Analytics
import adminInsightsRoutes from "./routes/adminInsightsRoutes.js";
import adminAnalyticsRoutes from "./routes/adminAnalyticsRoutes.js";

// 🧾 Logs & Stats
import statsRoutes from "./routes/stats.js";
import activityRoutes from "./routes/activity.js";
import auditRoutes from "./routes/auditRoutes.js";

/* =====================================================
   ⚙️ INITIAL SETUP
===================================================== */

dotenv.config();
await connectDB();

const app = express();
app.set("trust proxy", 1);

/* =====================================================
   🛡️ CORS CONFIG
===================================================== */

const allowedOrigins = ["http://localhost:5173"];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) callback(null, true);
      else callback(new Error(`Not allowed by CORS: ${origin}`));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
  })
);

/* =====================================================
   ⚙️ CORE MIDDLEWARE
===================================================== */

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "onestop_session_secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

/* =====================================================
   🚀 ROUTE MOUNTING (CLEANED, NO DUPLICATES)
===================================================== */

// 🔐 Auth & Users
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/useractivity", userActivityRoutes);

// 📚 Resources & Communication
app.use("/api/resources", resourceRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/notices", noticeRoutes);
app.use("/api/events", eventsRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/notifications", notificationRoutes);

// 🎓 Mentor System
app.use("/api/mentor", mentorRoutes);
app.use("/api/mentorship", mentorshipRoutes); // New module

// 🧠 General Analytics & Logs
app.use("/api/stats", statsRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/admin", adminInsightsRoutes);
app.use("/api/audit", auditRoutes);

// 💼 Recruiter System (OLD recruiter CRUD)
app.use("/api/recruiter", recruiterRoutes);

// ⭐ NEW FIXED RECRUITER PANEL MODULE
app.use("/api/rpanel", recruiterPanelRoutes);                // ✔ overview, profile, jobs, applications
app.use("/api/rpanel/analytics", recruiterAnalyticsRoutes); // ✔ analytics only

// 👨‍💼 Admin Recruiter & Admin Job Management
app.use("/api/admin", adminRecruiterRoutes);
app.use("/api/admin", adminJobRoutes);

// 🧍‍♂️ Candidate System
app.use("/api/candidate", candidateRoutes);

// 🌐 Public Jobs
// app.use("/api/jobs", jobPublicRoutes);

// 📊 Admin Analytics
app.use("/api/admin/analytics", adminAnalyticsRoutes);

// 🏆 Contests & Hackathons
import contestRoutes from "./routes/contestRoutes.js";
import jobRoutes from "./routes/jobRoutes.js"; // New Job Routes
app.use("/api", contestRoutes);
app.use("/api", jobRoutes);

// 🤖 AI/ATS Resume Analyzer & Mock Interview
import atsRoutes from "./routes/atsRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
app.use("/api/ats", atsRoutes);
app.use("/api/ai", aiRoutes);

// 🌍 Community Feed
import feedRoutes from "./routes/feedRoutes.js";
app.use("/api/feed", feedRoutes);

// 🚀 Project Showcase
import projectRoutes from "./routes/projectRoutes.js";
app.use("/api/projects", projectRoutes);

// 📝 Assessment/Quiz Platform
import assessmentRoutes from "./routes/assessmentRoutes.js";
app.use("/api/assessments", assessmentRoutes);

/* =====================================================
   🧭 HEALTH CHECK
===================================================== */

app.get("/", (_req, res) => {
  res.status(200).json({
    message: "🚀 OneStop Hub Backend API running successfully!",
    environment: process.env.NODE_ENV || "development",
    version: "v2.0",
  });
});

/* =====================================================
   ❗ 404 HANDLER
===================================================== */

app.use((req, res, next) => {
  if (req.method === "OPTIONS") return res.sendStatus(200);
  const err = new Error(`Route not found: ${req.originalUrl}`);
  err.status = 404;
  next(err);
});

/* =====================================================
   💥 GLOBAL ERROR HANDLER
===================================================== */

app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  const message =
    err.message || (status === 404 ? "Not Found" : "Internal Server Error");

  res.status(status).json({
    message,
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
});

/* =====================================================
   ⚡ SERVER + SOCKET
===================================================== */

const server = http.createServer(app);
initSocket(server);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`✅ OneStop Hub Server running on port ${PORT}`);
});

export default app;

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
   🧩 IMPORT ROUTE MODULES
===================================================== */

// 🔑 Core Auth & Users
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/userRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import userActivityRoutes from "./routes/userActivity.js";

// 🧾 Resources & Communication
import resourceRoutes from "./routes/resourceRoutes.js";
import contactRoutes from "./routes/contactRoutes.js";
import noticeRoutes from "./routes/noticeRoutes.js";
import eventsRoutes from "./routes/events.js";
import chatRoutes from "./routes/chat.js";
import messageRoutes from "./routes/messageRoutes.js";
import internalMailRoutes from "./routes/internalMail.js";
import notificationRoutes from "./routes/notificationRoutes.js";

// 🎓 Mentorship
import mentorRoutes from "./routes/mentorRoutes.js";

// 💼 Recruiter & Admin Job Management
import recruiterRoutes from "./routes/recruiterRoutes.js";     
import recruiterPanelRoutes from "./routes/recruiterPanelRoutes.js"; // ✅ added
import adminRecruiterRoutes from "./routes/adminRecruiterRoutes.js";
import jobPublicRoutes from "./routes/jobPublicRoutes.js";

import adminJobRoutes from "./routes/adminJobRoutes.js";

// 👨‍🎓 Candidate Features & Admin Insights
import candidateRoutes from "./routes/candidateRoutes.js";
import adminInsightsRoutes from "./routes/adminInsightsRoutes.js";

// 📊 Analytics & Activity
import statsRoutes from "./routes/stats.js";
import activityRoutes from "./routes/activity.js";

// 🆕 Recruiter Analytics (optional module)
import recruiterAnalyticsRoutes from "./routes/recruiterAnalyticsRoutes.js";
import adminAnalyticsRoutes from "./routes/adminAnalyticsRoutes.js";

/* =====================================================
   ⚙️ INITIAL SETUP
===================================================== */
dotenv.config();
await connectDB();

const app = express();
app.set("trust proxy", 1);

/* =====================================================
   🛡️ CORS CONFIGURATION
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
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

/* =====================================================
   🚀 ROUTES
===================================================== */

// 🔑 Auth & User Management
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
app.use("/api/mail", internalMailRoutes);
app.use("/api/notifications", notificationRoutes);

// 🎓 Mentorship
app.use("/api/mentor", mentorRoutes);

// 🧠 Analytics, Stats & Insights
app.use("/api/stats", statsRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/admin", adminInsightsRoutes);

// 💼 Recruiter & Job System
app.use("/api/recruiter", recruiterRoutes);
app.use("/api/rpanel", recruiterPanelRoutes); // ✅ recruiter settings + overview routes
app.use("/api/admin", adminRecruiterRoutes);
app.use("/api/jobs", jobPublicRoutes);
app.use("/api/admin", adminJobRoutes);
app.use("/api/rpanel", recruiterPanelRoutes);


// 👨‍🎓 Candidate Features
app.use("/api/candidate", candidateRoutes);

// 🆕 Recruiter Analytics (optional dedicated module)
app.use("/api/recruiter-analytics", recruiterAnalyticsRoutes);
app.use("/api/rpanel", recruiterAnalyticsRoutes);
app.use("/api/admin", adminAnalyticsRoutes);

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

  const payload =
    process.env.NODE_ENV === "production"
      ? { message }
      : { message, stack: err.stack };

  res.status(status).json(payload);
});

/* =====================================================
   ⚡ SERVER & SOCKET INITIALIZATION
===================================================== */
const server = http.createServer(app);
initSocket(server); // initializes and links Socket.io

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`✅ OneStop Hub Server running on port ${PORT}`);
});

export default app;

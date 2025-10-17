// src/index.js
import express from "express";
import dotenv from "dotenv";
import connectDB from "./db.js";
import cors from "cors";
import http from "http";
import session from "express-session";
import passport from "./config/passport.js";
import initSocket from "./socket.js";

// ✅ Import all routes
import authRoutes from "./routes/auth.js";
import resourceRoutes from "./routes/resourceRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import contactRoutes from "./routes/contactRoutes.js";
import noticeRoutes from "./routes/noticeRoutes.js";
import eventsRoutes from "./routes/events.js";
import activityRoutes from "./routes/activity.js";
import statsRoutes from "./routes/stats.js";
import notificationsRoutes from "./routes/notificationRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import userActivityRoutes from "./routes/userActivity.js";
import chatRoutes from "./routes/chat.js";
import messageRoutes from "./routes/messageRoutes.js";
import mentorRoutes from "./routes/mentorRoutes.js";

dotenv.config();
connectDB();

const app = express();
app.set("trust proxy", 1); // for secure cookies on HTTPS proxies

/* =====================================================
   🛡️ CORS CONFIGURATION
===================================================== */
const allowedOrigins = [
  "http://localhost:5173",
  // "https://onestop-frontend.netlify.app", // Uncomment when deploying frontend
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Not allowed by CORS: ${origin}`));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
  })
);

/* =====================================================
   ⚙️ MIDDLEWARE SETUP
===================================================== */
app.use(express.json({ limit: "10mb" })); // handle large JSON uploads safely

app.use(
  session({
    secret: process.env.SESSION_SECRET || "onestop_session_secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production", // true only in HTTPS
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

/* =====================================================
   🚀 API ROUTES
===================================================== */
app.use("/api/auth", authRoutes);
app.use("/api/resources", resourceRoutes);
app.use("/api/users", userRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/notices", noticeRoutes);
app.use("/api/events", eventsRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/useractivity", userActivityRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/mentor", mentorRoutes);
app.use("/api/audit", activityRoutes);

/* =====================================================
   🧭 ROOT ROUTE + HEALTH CHECK
===================================================== */
app.get("/", (_req, res) => {
  res.status(200).json({
    message: "🚀 OneStop Backend API running successfully!",
    environment: process.env.NODE_ENV || "development",
  });
});

/* =====================================================
   ⚡ SERVER & SOCKET INITIALIZATION
===================================================== */
const server = http.createServer(app);
initSocket(server);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () =>
  console.log(`✅ Server & Socket running on port ${PORT}`)
);

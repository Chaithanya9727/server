import express from "express";
import { protect } from "../middleware/auth.js";
import { authorize } from "../middleware/authorize.js";
import {
  getMentors,
  getMentorById,
  updateMentorSettings,
  bookSession,
  reviewSession,
  getMySessions,
  updateSessionStatus
} from "../controllers/mentorshipController.js";

const router = express.Router();

// 📌 Get All Approved Mentors (Public/Protected)
router.get("/list", protect, getMentors);

// 📌 Get Specific Mentor Details (Public/Protected)
router.get("/:id", protect, getMentorById);

/* ============================
   📅 Availability & Services
   ============================ */

// 📌 Update Mentor Services & Availability (Mentor Only)
router.put("/settings", protect, authorize(["mentor"]), updateMentorSettings);

/* ============================
   🤝 Booking Sessions
   ============================ */

// 📌 Book a Session (Candidate -> Mentor)
router.post("/book", protect, authorize(["candidate"]), bookSession);

// 📌 Submit Review (Mentee -> Mentor)
router.post("/sessions/:id/review", protect, reviewSession);

// 📌 Get My Sessions (As Mentor or Mentee)
router.get("/sessions/my", protect, getMySessions);

// 📌 Update Session Status (Mentor: Confirm/Cancel/Complete)
router.patch("/sessions/:id/status", protect, authorize(["mentor", "superadmin"]), updateSessionStatus);

export default router;

import express from "express";
import {
  applyForMentor,
  getMentorStatus,
  getMentorProfile,
  updateMentorProfile,
  getMentees,
  giveFeedback,
  getMentorRequests,
  approveMentor,
  rejectMentor,
} from "../controllers/mentorController.js";

import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

// 🎓 Candidate actions
router.post("/apply", protect, applyForMentor);
router.get("/status", protect, getMentorStatus);

// 👨‍🏫 Mentor actions
router.get("/profile", protect, getMentorProfile);
router.put("/profile", protect, updateMentorProfile);
router.get("/mentees", protect, authorize("mentor"), getMentees);
router.post("/feedback/:studentId", protect, authorize("mentor"), giveFeedback);

// 🧩 Admin actions
router.get("/requests", protect, authorize("admin", "superadmin"), getMentorRequests);
router.put("/approve/:id", protect, authorize("admin", "superadmin"), approveMentor);
router.put("/reject/:id", protect, authorize("admin", "superadmin"), rejectMentor);

export default router;

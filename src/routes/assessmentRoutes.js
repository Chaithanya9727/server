import express from "express";
import {
  createAssessment,
  getAssessments,
  getAssessment,
  startAttempt,
  saveAnswer,
  submitAssessment,
  reportTabSwitch,
  getMyAttempts,
  getAttemptResult
} from "../controllers/assessmentController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

// 📝 Assessment Management (Recruiter/Admin)
router.post("/", protect, authorize("recruiter", "admin", "superadmin"), createAssessment);

// 📋 Browse & Access
router.get("/", protect, getAssessments);
router.get("/:id", protect, getAssessment);

// 🎯 Taking Assessment
router.post("/:id/start", protect, startAttempt);
router.put("/attempt/:attemptId/answer", protect, saveAnswer);
router.post("/attempt/:attemptId/submit", protect, submitAssessment);
router.post("/attempt/:attemptId/tab-switch", protect, reportTabSwitch);

// 📊 Results & History
router.get("/my/attempts", protect, getMyAttempts);
router.get("/attempt/:attemptId/result", protect, getAttemptResult);

export default router;

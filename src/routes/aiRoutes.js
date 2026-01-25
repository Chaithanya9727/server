import express from "express";
import { 
  generateQuestions, 
  analyzeAnswer, 
  chatWithAI,
  generateJobDescription,
  generateCoverLetter,
  checkJobEligibility
} from "../controllers/aiController.js";

const router = express.Router();

// Interview Routes
router.post("/interview/questions", generateQuestions);
router.post("/interview/analyze", analyzeAnswer);
router.post("/chat", chatWithAI);

// New AI Features
router.post("/job-description", generateJobDescription);
router.post("/cover-letter", generateCoverLetter);
router.post("/job-eligibility", checkJobEligibility);

export default router;

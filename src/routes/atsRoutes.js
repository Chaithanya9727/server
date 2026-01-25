import express from "express";
import multer from "multer";
import { analyzeResume } from "../controllers/atsController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// Local upload for temporary processing (scan & delete) - don't need Cloudinary for this
const upload = multer({ dest: "uploads/" });

router.post("/analyze", protect, upload.single("resume"), analyzeResume);

export default router;

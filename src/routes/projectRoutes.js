import express from "express";
import { protect } from "../middleware/auth.js";
import { 
  getProjects, 
  createProject, 
  likeProject 
} from "../controllers/projectController.js";

const router = express.Router();

router.get("/", getProjects); // Public
router.post("/", protect, createProject);
router.put("/:id/like", protect, likeProject);

export default router;

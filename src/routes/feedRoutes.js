import express from "express";
import { protect } from "../middleware/auth.js";
import { 
  getFeed, 
  createPost, 
  deletePost,
  toggleLike, 
  addComment,
  deleteComment
} from "../controllers/feedController.js";

const router = express.Router();

router.get("/", protect, getFeed);
router.post("/", protect, createPost);
router.delete("/:id", protect, deletePost);
router.put("/:id/like", protect, toggleLike);
router.post("/:id/comment", protect, addComment);
router.delete("/:id/comment/:commentId", protect, deleteComment);

export default router;

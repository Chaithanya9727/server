import express from "express";
import { protect } from "../middleware/auth.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import mongoose from "mongoose";

const router = express.Router();

/**
 * ✅ Start or get conversation with another user
 */
router.post("/start/:userId", protect, async (req, res) => {
  try {
    const me = req.user._id.toString();
    const other = req.params.userId;

    if (me === other) {
      return res.status(400).json({ message: "Cannot chat with yourself" });
    }

    const pair = [me, other].sort();

    let conv = await Conversation.findOne({
      participants: { $all: pair, $size: 2 },
    }).populate("participants", "name email role avatar lastSeen");

    if (!conv) {
      conv = await Conversation.create({
        participants: pair.map(id => new mongoose.Types.ObjectId(id)),
      });
      conv = await Conversation.findById(conv._id).populate(
        "participants",
        "name email role avatar lastSeen"
      );
    }

    res.json(conv);
  } catch (err) {
    console.error("Error starting conversation:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * ✅ List all conversations for current user
 */
router.get("/conversations", protect, async (req, res) => {
  try {
    const me = req.user._id;
    const list = await Conversation.find({ participants: me })
      .sort({ lastMessageAt: -1 })
      .populate("participants", "name email role avatar lastSeen");
    res.json(list);
  } catch (err) {
    console.error("Error fetching conversations:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * ✅ List all registered users (for starting chat)
 */
router.get("/users", protect, async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user._id } }).select(
      "name email role avatar"
    );
    res.json(users);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * ✅ Messages in a conversation (with pagination)
 */
router.get("/:conversationId/messages", protect, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { before, limit = 20 } = req.query;

    const conv = await Conversation.findById(conversationId);
    if (!conv) return res.status(404).json({ message: "Conversation not found" });

    if (!conv.participants.some(p => p.toString() === req.user._id.toString())) {
      return res.status(403).json({ message: "Not a participant" });
    }

    const query = { conversation: conversationId };
    if (before) query.createdAt = { $lt: new Date(before) };

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    res.json({ messages: messages.reverse() });
  } catch (err) {
    console.error("Error fetching messages:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;

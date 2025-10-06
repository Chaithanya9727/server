import express from "express";
import Contact from "../models/Contact.js";
import { protect } from "../middleware/auth.js";
import { authorize } from "../middleware/authorize.js";
import { sendEmail } from "../utils/sendEmail.js";
import AuditLog from "../models/AuditLog.js";

const router = express.Router();

// =====================================================
// @route   POST /api/contact
// @desc    Public → send message
// @access  Public
// =====================================================
router.post("/", async (req, res) => {
  try {
    const { name, email, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ message: "All fields required" });
    }

    const newMsg = await Contact.create({ name, email, message });
    res.status(201).json(newMsg);
  } catch (err) {
    console.error("Error saving contact message:", err);
    res.status(500).json({ message: "Error saving contact message" });
  }
});

// =====================================================
// @route   GET /api/contact
// @desc    Admin → view all messages
// @access  Private/Admin
// =====================================================
router.get("/", protect, authorize(["admin"]), async (req, res) => {
  try {
    const msgs = await Contact.find()
      .populate("replies.repliedBy", "name email")
      .sort({ createdAt: -1 });
    res.json(msgs);
  } catch (err) {
    console.error("Error fetching messages:", err);
    res.status(500).json({ message: "Error fetching messages" });
  }
});

// =====================================================
// @route   POST /api/contact/:id/reply
// @desc    Admin → add reply to a message (stacked replies)
// @access  Private/Admin
// =====================================================
router.post("/:id/reply", protect, authorize(["admin"]), async (req, res) => {
  try {
    const { reply } = req.body;
    if (!reply) return res.status(400).json({ message: "Reply text is required" });

    const msg = await Contact.findById(req.params.id);
    if (!msg) return res.status(404).json({ message: "Message not found" });

    msg.replies.push({
      text: reply,
      repliedBy: req.user._id,
      repliedAt: new Date(),
    });

    await msg.save();

    // ✅ send email notification (optional)
    await sendEmail(
      msg.email,
      `Reply to your message: ${msg.message.slice(0, 30)}...`,
      `Hello ${msg.name},\n\n${reply}\n\n- OneStop Team`
    );

    // ✅ log action
    await AuditLog.create({
      action: "REPLY_MESSAGE",
      performedBy: req.user._id,
      details: `Replied to contact message from ${msg.email} → "${reply}"`,
    });

    res.json({ message: "Reply added ✅" });
  } catch (err) {
    console.error("Reply error:", err);
    res.status(500).json({ message: "Error sending reply" });
  }
});

// =====================================================
// @route   DELETE /api/contact/:id/reply/:replyId
// @desc    Admin → delete a specific reply
// @access  Private/Admin
// =====================================================
router.delete("/:id/reply/:replyId", protect, authorize(["admin"]), async (req, res) => {
  try {
    const { id, replyId } = req.params;

    const msg = await Contact.findById(id);
    if (!msg) return res.status(404).json({ message: "Message not found" });

    msg.replies = msg.replies.filter(r => r._id.toString() !== replyId);
    await msg.save();

    // ✅ log action
    await AuditLog.create({
      action: "DELETE_REPLY",
      performedBy: req.user._id,
      details: `Deleted reply ${replyId} from message ${id}`,
    });

    res.json({ message: "Reply deleted ❌" });
  } catch (err) {
    console.error("Delete reply error:", err);
    res.status(500).json({ message: "Error deleting reply" });
  }
});

// =====================================================
// @route   DELETE /api/contact/:id
// @desc    Admin → delete entire message
// @access  Private/Admin
// =====================================================
router.delete("/:id", protect, authorize(["admin"]), async (req, res) => {
  try {
    await Contact.findByIdAndDelete(req.params.id);

    // ✅ log action
    await AuditLog.create({
      action: "DELETE_MESSAGE",
      performedBy: req.user._id,
      details: `Deleted contact message with id ${req.params.id}`,
    });

    res.json({ message: "Message deleted ❌" });
  } catch (err) {
    console.error("Error deleting message:", err);
    res.status(500).json({ message: "Error deleting message" });
  }
});

export default router;

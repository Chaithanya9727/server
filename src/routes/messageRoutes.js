import express from "express";
import { protect } from "../middleware/auth.js";
import { authorize } from "../middleware/authorize.js";
import Message from "../models/Message.js";
import AuditLog from "../models/AuditLog.js";

const router = express.Router();

/* =====================================================
   💬 MESSAGES API (For Admin + SuperAdmin)
===================================================== */

// ✅ Fetch all messages (Admin + SuperAdmin)
router.get("/", protect, authorize(["admin", "superadmin"]), async (req, res) => {
  try {
    const { search = "", page = 1, limit = 20 } = req.query;
    const q = {};

    if (search) {
      q.$or = [
        { body: { $regex: search, $options: "i" } },
        // filter by user id/name in populated fields below
      ];
    }

    const total = await Message.countDocuments(q);
    const messages = await Message.find(q)
      .populate("from", "name email role")
      .populate("to", "name email role")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({
      messages,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("Fetch messages error:", err);
    res.status(500).json({ message: "Error fetching messages" });
  }
});

/* =====================================================
   📨 Send a message (Any logged-in user)
===================================================== */
router.post("/", protect, async (req, res) => {
  try {
    const { to, body, conversation } = req.body;

    if (!to || !body)
      return res.status(400).json({ message: "Recipient and body required" });

    const msg = await Message.create({
      conversation,
      from: req.user._id,
      to,
      body,
    });

    // 🔏 Log message send
    await AuditLog.create({
      action: "SEND_MESSAGE",
      performedBy: req.user._id,
      targetUser: to,
      details: `Message sent from ${req.user._id} to ${to}`,
    });

    res.status(201).json(msg);
  } catch (err) {
    console.error("Send message error:", err);
    res.status(500).json({ message: "Error sending message" });
  }
});

/* =====================================================
   ❌ Delete message (Admin + SuperAdmin)
===================================================== */
router.delete("/:id", protect, authorize(["admin", "superadmin"]), async (req, res) => {
  try {
    const msg = await Message.findById(req.params.id);
    if (!msg) return res.status(404).json({ message: "Message not found" });

    await AuditLog.create({
      action: "DELETE_MESSAGE",
      performedBy: req.user._id,
      targetUser: msg.to,
      details: `Deleted message ${msg._id}`,
    });

    await msg.deleteOne();
    res.json({ message: "Message deleted successfully ❌" });
  } catch (err) {
    console.error("Delete message error:", err);
    res.status(500).json({ message: "Error deleting message" });
  }
});

/* =====================================================
   🚮 Bulk Delete (SuperAdmin only)
===================================================== */
router.delete("/bulk/all", protect, authorize(["superadmin"]), async (req, res) => {
  try {
    const count = await Message.countDocuments();
    await Message.deleteMany({});

    await AuditLog.create({
      action: "DELETE_ALL_MESSAGES",
      performedBy: req.user._id,
      details: `SuperAdmin deleted all ${count} messages`,
    });

    res.json({ message: `Deleted all ${count} messages ✅` });
  } catch (err) {
    console.error("Bulk delete messages error:", err);
    res.status(500).json({ message: "Error bulk deleting messages" });
  }
});

export default router;

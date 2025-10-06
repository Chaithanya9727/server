import express from "express";
import Contact from "../models/Contact.js";  // your Contact model (name, email, message, createdAt)
import { protect, authorize } from "../middleware/auth.js";
import AuditLog from "../models/AuditLog.js";

const router = express.Router();

// 📩 Public → Submit a contact message
router.post("/", async (req, res) => {
  try {
    const { name, email, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ message: "All fields required" });
    }

    const newMsg = await Contact.create({ name, email, message });
    res.status(201).json(newMsg);
  } catch (err) {
    console.error("Contact form error:", err);
    res.status(500).json({ message: "Error submitting message" });
  }
});

// 📩 Admin → Get all messages
router.get("/", protect, authorize(["admin"]), async (req, res) => {
  try {
    const messages = await Contact.find().sort({ createdAt: -1 });
    res.json(messages);
  } catch (err) {
    console.error("Fetch messages error:", err);
    res.status(500).json({ message: "Error fetching messages" });
  }
});

// ❌ Admin → Delete a message
router.delete("/:id", protect, authorize(["admin"]), async (req, res) => {
  try {
    const { id } = req.params;
    const msg = await Contact.findById(id);
    if (!msg) return res.status(404).json({ message: "Message not found" });

    await msg.deleteOne();

    // 🔏 Audit log
    try {
      await AuditLog.create({
        action: "DELETE_MESSAGE",
        performedBy: req.user._id,
        details: `Deleted message from ${msg.name} (${msg.email})`,
      });
    } catch (e) {
      console.error("AuditLog (DELETE_MESSAGE) failed:", e.message);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("Delete message error:", err);
    res.status(500).json({ message: "Error deleting message" });
  }
});

export default router;

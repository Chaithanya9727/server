import express from "express";
import Contact from "../models/Contact.js";
import { protect } from "../middleware/auth.js";
import { authorize } from "../middleware/authorize.js";
import { sendEmail } from "../utils/sendEmail.js";
import AuditLog from "../models/AuditLog.js";

const router = express.Router();

/* =====================================================
   🌐 PUBLIC — Send a contact message
===================================================== */
router.post("/", async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Save to MongoDB
    const newMsg = await Contact.create({
      name,
      email,
      subject,
      message,
      createdAt: new Date(),
    });

    // ✉️ Send notification email to admin
    await sendEmail(
      process.env.EMAIL_USER,
      `📩 New Contact Message from ${name}`,
      `From: ${name} <${email}>\n\nSubject: ${subject}\n\nMessage:\n${message}`
    );

    // 🤖 Auto-reply to sender
    await sendEmail(
      email,
      `Thanks for contacting OneStop Hub!`,
      `Hi ${name},\n\nWe've received your message regarding "${subject}".\nOur team will get back to you soon.\n\nBest regards,\nThe OneStop Hub Team`
    );

    res.status(201).json({
      success: true,
      message: "Message sent successfully! Our team will contact you soon.",
      data: newMsg,
    });
  } catch (err) {
    console.error("Error in contact form submission:", err);
    res.status(500).json({
      success: false,
      message: "Unable to send your message. Please try again later.",
    });
  }
});

/* =====================================================
   🔒 ADMIN — Get all contact messages
===================================================== */
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

/* =====================================================
   🔒 ADMIN — Reply to a message
===================================================== */
router.post("/:id/reply", protect, authorize(["admin"]), async (req, res) => {
  try {
    const { reply } = req.body;
    if (!reply)
      return res.status(400).json({ message: "Reply text is required" });

    const msg = await Contact.findById(req.params.id);
    if (!msg) return res.status(404).json({ message: "Message not found" });

    msg.replies.push({
      text: reply,
      repliedBy: req.user._id,
      repliedAt: new Date(),
    });

    await msg.save();

    // ✉️ Email reply to sender
    await sendEmail(
      msg.email,
      `Response from OneStop Hub`,
      `Hello ${msg.name},\n\n${reply}\n\n– OneStop Hub Team`
    );

    // 🧾 Log action
    await AuditLog.create({
      action: "REPLY_MESSAGE",
      performedBy: req.user._id,
      details: `Replied to contact message from ${msg.email}`,
    });

    res.json({ message: "Reply sent successfully ✅" });
  } catch (err) {
    console.error("Error sending reply:", err);
    res.status(500).json({ message: "Error sending reply" });
  }
});

/* =====================================================
   🔒 ADMIN — Delete a specific reply
===================================================== */
router.delete("/:id/reply/:replyId", protect, authorize(["admin"]), async (req, res) => {
  try {
    const { id, replyId } = req.params;
    const msg = await Contact.findById(id);
    if (!msg) return res.status(404).json({ message: "Message not found" });

    msg.replies = msg.replies.filter(r => r._id.toString() !== replyId);
    await msg.save();

    await AuditLog.create({
      action: "DELETE_REPLY",
      performedBy: req.user._id,
      details: `Deleted reply ${replyId} from message ${id}`,
    });

    res.json({ message: "Reply deleted successfully ❌" });
  } catch (err) {
    console.error("Error deleting reply:", err);
    res.status(500).json({ message: "Error deleting reply" });
  }
});

/* =====================================================
   🔒 ADMIN — Delete entire message
===================================================== */
router.delete("/:id", protect, authorize(["admin"]), async (req, res) => {
  try {
    await Contact.findByIdAndDelete(req.params.id);

    await AuditLog.create({
      action: "DELETE_MESSAGE",
      performedBy: req.user._id,
      details: `Deleted contact message ${req.params.id}`,
    });

    res.json({ message: "Message deleted successfully ❌" });
  } catch (err) {
    console.error("Error deleting message:", err);
    res.status(500).json({ message: "Error deleting message" });
  }
});

export default router;

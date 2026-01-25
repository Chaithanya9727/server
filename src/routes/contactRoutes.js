import express from "express";
import Contact from "../models/Contact.js";
import User from "../models/User.js";
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

    // 🕵️ Find SuperAdmins to notify
    const superAdmins = await User.find({ role: "superadmin" }).select("email");
    const superAdminEmails = superAdmins.map(u => u.email).filter(e => e);

    // ✉️ Send notification email to all superadmins
    if (superAdminEmails.length > 0) {
      await sendEmail(
        superAdminEmails, // Array of emails
        `📩 New Feedback/Contact from ${name}`,
        `From: ${name} <${email}>\n\nSubject: ${subject}\n\nMessage:\n${message}\n\n(Sent via OneStop Hub Contact Form)`
      );
    } else {
       // Fallback to Env Email user if no superadmin found in DB
       await sendEmail(
        process.env.EMAIL_USER,
        `📩 New Feedback/Contact from ${name}`,
        `From: ${name} <${email}>\n\nSubject: ${subject}\n\nMessage:\n${message}`
      );
    }

    // 🤖 Auto-reply to sender
    await sendEmail(
      email,
      `We received your feedback - OneStop Hub`,
      `Hi ${name},\n\nThank you for reaching out! We've received your feedback/message regarding "${subject}".\nOur SuperAdmin team has been notified and will review it smoothly.\n\nBest regards,\nThe OneStop Hub Team`
    );

    res.status(201).json({
      success: true,
      message: "Feedback sent successfully to SuperAdmins!",
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

/* =====================================================
   🔒 ADMIN — Bulk Delete messages
===================================================== */
router.post("/bulk/delete", protect, authorize(["superadmin"]), async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "No IDs provided" });
    }

    await Contact.deleteMany({ _id: { $in: ids } });

    await AuditLog.create({
      action: "BULK_DELETE_MESSAGES",
      performedBy: req.user._id,
      details: `Deleted ${ids.length} contact messages`,
    });

    res.json({ message: `Deleted ${ids.length} messages successfully ✅` });
  } catch (err) {
    console.error("Error bulk deleting messages:", err);
    res.status(500).json({ message: "Error deleting messages" });
  }
});

export default router;

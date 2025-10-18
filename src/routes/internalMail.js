// routes/internalMail.js
import express from "express";
import InternalMail from "../models/InternalMail.js";
import User from "../models/User.js";
import { protect } from "../middleware/auth.js";
import { authorize } from "../middleware/authorize.js";
import { sendEmail } from "../utils/sendEmail.js";

const router = express.Router();

/**
 * POST /api/mail/send
 * Body:
 *  {
 *    toEmails?: string[]       // explicit email list
 *    toRole?: "admin" | "superadmin", // OR send to all admins/superadmins
 *    subject: string,
 *    message: string,
 *    priority?: "Low" | "Normal" | "High"
 *  }
 */
router.post(
  "/send",
  protect,
  authorize(["admin", "superadmin"]),
  async (req, res) => {
    try {
      const { toEmails = [], toRole, subject, message, priority = "Normal" } =
        req.body;

      if (!subject || !message) {
        return res.status(400).json({ message: "Subject and message are required" });
      }

      // Resolve recipients
      let recipients = [];
      if (toRole) {
        // send to all users with that role
        const users = await User.find({
          role: toRole,
        }).select("_id email name");
        recipients = users.map((u) => ({
          id: u._id,
          email: u.email,
          name: u.name,
        }));
      }

      // add explicit emails (dedupe)
      if (Array.isArray(toEmails) && toEmails.length) {
        const existing = new Set(recipients.map((r) => r.email.toLowerCase()));
        toEmails
          .filter(Boolean)
          .map((e) => String(e).trim().toLowerCase())
          .forEach((em) => {
            if (!existing.has(em)) recipients.push({ email: em });
          });
      }

      // safety
      recipients = recipients.filter((r) => r.email);
      if (recipients.length === 0) {
        return res
          .status(400)
          .json({ message: "No recipients resolved (role or emails required)" });
      }

      // Send emails + create records
      const created = [];
      for (const r of recipients) {
        // email out
        await sendEmail(
          r.email,
          subject,
          `
${message}

— Sent by ${req.user.name} (${req.user.email})
Priority: ${priority}
`.trim()
        );

        // store record
        created.push(
          await InternalMail.create({
            from: req.user._id,
            toUser: r.id ?? undefined,
            toEmail: r.email,
            subject,
            message,
            priority,
          })
        );
      }

      res.status(201).json({
        success: true,
        sent: created.length,
        message: `Mail sent to ${created.length} recipient(s).`,
      });
    } catch (err) {
      console.error("InternalMail send error:", err);
      res.status(500).json({ message: "Failed to send mail" });
    }
  }
);

/**
 * GET /api/mail?box=inbox|sent
 * inbox (default): toEmail == current user's email
 * sent: from == current user
 */
router.get("/", protect, authorize(["admin", "superadmin"]), async (req, res) => {
  try {
    const box = (req.query.box || "inbox").toLowerCase();
    let query;

    if (box === "sent") {
      query = { from: req.user._id };
    } else {
      query = { toEmail: req.user.email };
    }

    const items = await InternalMail.find(query)
      .populate("from", "name email")
      .populate("toUser", "name email")
      .sort({ createdAt: -1 });

    res.json({ box, items });
  } catch (err) {
    console.error("InternalMail list error:", err);
    res.status(500).json({ message: "Failed to load mail" });
  }
});

/**
 * GET /api/mail/recipients?role=admin|superadmin|all&q=search
 * returns small list for UI select
 */
router.get(
  "/recipients",
  protect,
  authorize(["admin", "superadmin"]),
  async (req, res) => {
    try {
      const { role, q } = req.query;

      const filter = {};
      if (role && role !== "all") filter.role = role;

      if (q) {
        // simple search by name/email
        filter.$or = [
          { name: { $regex: q, $options: "i" } },
          { email: { $regex: q, $options: "i" } },
        ];
      }

      const users = await User.find(filter)
        .select("_id name email role")
        .limit(50)
        .sort({ role: 1, name: 1 });

      res.json(users);
    } catch (err) {
      console.error("Recipients error:", err);
      res.status(500).json({ message: "Failed to load recipients" });
    }
  }
);

/** Mark read */
router.patch(
  "/:id/read",
  protect,
  authorize(["admin", "superadmin"]),
  async (req, res) => {
    try {
      const mail = await InternalMail.findById(req.params.id);
      if (!mail) return res.status(404).json({ message: "Mail not found" });

      // only recipient can mark read
      if (mail.toEmail?.toLowerCase() !== req.user.email.toLowerCase()) {
        return res.status(403).json({ message: "Not allowed" });
      }

      mail.readAt = new Date();
      await mail.save();
      res.json({ message: "Marked as read" });
    } catch (err) {
      console.error("Mark read error:", err);
      res.status(500).json({ message: "Failed to mark read" });
    }
  }
);

/** Delete (sender can delete from 'sent', recipient can delete from 'inbox') */
router.delete(
  "/:id",
  protect,
  authorize(["admin", "superadmin"]),
  async (req, res) => {
    try {
      const mail = await InternalMail.findById(req.params.id);
      if (!mail) return res.status(404).json({ message: "Mail not found" });

      const isSender = String(mail.from) === String(req.user._id);
      const isRecipient =
        mail.toEmail?.toLowerCase() === req.user.email.toLowerCase();

      if (!isSender && !isRecipient) {
        return res.status(403).json({ message: "Not allowed" });
      }

      await mail.deleteOne();
      res.json({ message: "Mail deleted" });
    } catch (err) {
      console.error("Delete mail error:", err);
      res.status(500).json({ message: "Failed to delete mail" });
    }
  }
);

export default router;

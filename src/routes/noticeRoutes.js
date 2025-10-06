import express from "express";
import Notice from "../models/Notice.js";
import { protect, authorize } from "../middleware/auth.js";
import AuditLog from "../models/AuditLog.js";

const router = express.Router();

// 📌 Public → fetch all notices (with search, filters, pagination)
router.get("/", async (req, res) => {
  try {
    const {
      search = "",
      audience = "all",
      pinned = false,
      page = 1,
      limit = 6,
    } = req.query;

    const query = {};

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { body: { $regex: search, $options: "i" } },
      ];
    }

    if (audience !== "all") {
      query.audience = audience;
    }

    if (pinned === "true") {
      query.pinned = true;
    }

    const total = await Notice.countDocuments(query);

    const notices = await Notice.find(query)
      .populate("createdBy", "name email")
      .sort({ pinned: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({
      notices,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("Notice fetch error:", err);
    res.status(500).json({ message: "Error fetching notices" });
  }
});

// 📌 Admin → create notice
router.post("/", protect, authorize("admin"), async (req, res) => {
  try {
    const { title, body, audience, pinned, attachment } = req.body;
    if (!title || !body) {
      return res.status(400).json({ message: "Title and body are required" });
    }

    const notice = await Notice.create({
      title,
      body,
      audience,
      pinned,
      attachment,
      createdBy: req.user._id,
    });

    // 🔏 Audit: CREATE_NOTICE
    await AuditLog.create({
      action: "CREATE_NOTICE",
      targetUser: req.user._id,
      performedBy: req.user._id,
      details: `Created notice "${title}" (id: ${notice._id})`,
    });

    res.status(201).json(notice);
  } catch (err) {
    console.error("Create notice error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// 📌 Admin → update notice
router.put("/:id", protect, authorize("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const notice = await Notice.findById(id);
    if (!notice) return res.status(404).json({ message: "Notice not found" });

    const before = {
      title: notice.title,
      body: notice.body,
      audience: notice.audience,
      pinned: notice.pinned,
      attachment: notice.attachment || null,
    };

    // apply changes
    notice.title = req.body.title ?? notice.title;
    notice.body = req.body.body ?? notice.body;
    notice.audience = req.body.audience ?? notice.audience;
    notice.pinned = req.body.pinned ?? notice.pinned;
    notice.attachment =
      req.body.attachment !== undefined ? req.body.attachment : notice.attachment;

    await notice.save();

    // audit: diff check
    const after = {
      title: notice.title,
      body: notice.body,
      audience: notice.audience,
      pinned: notice.pinned,
      attachment: notice.attachment || null,
    };

    const changes = [];
    for (const k of Object.keys(after)) {
      if (String(after[k] || "") !== String(before[k] || "")) {
        if (k === "attachment") {
          if (!before[k] && after[k]) {
            changes.push(`Attachment added: ${after[k]}`);
          } else if (before[k] && !after[k]) {
            changes.push("Attachment removed");
          } else {
            changes.push(`Attachment replaced: ${before[k]} → ${after[k]}`);
          }
        } else {
          changes.push(`${k}: "${before[k]}" → "${after[k]}"`);
        }
      }
    }

    await AuditLog.create({
      action: "UPDATE_NOTICE",
      targetUser: req.user._id,
      performedBy: req.user._id,
      details:
        changes.length > 0
          ? `Updated notice (id: ${notice._id}) — ${changes.join(", ")}`
          : `Notice (id: ${notice._id}) saved with no field changes`,
    });

    res.json(notice);
  } catch (err) {
    console.error("Update notice error:", err);
    res.status(500).json({ message: "Error updating notice" });
  }
});

// 📌 Admin → delete notice
router.delete("/:id", protect, authorize("admin"), async (req, res) => {
  try {
    const notice = await Notice.findById(req.params.id);
    if (!notice) return res.status(404).json({ message: "Notice not found" });

    const snapshot = { title: notice.title };

    await notice.deleteOne();

    // 🔏 Audit: DELETE_NOTICE
    await AuditLog.create({
      action: "DELETE_NOTICE",
      targetUser: req.user._id,
      performedBy: req.user._id,
      details: `Deleted notice "${snapshot.title}" (id: ${notice._id})`,
    });

    res.json({ message: "Notice deleted successfully ❌" });
  } catch (err) {
    console.error("Delete notice error:", err);
    res.status(500).json({ message: "Error deleting notice" });
  }
});

export default router;

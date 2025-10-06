import express from "express";
import AuditLog from "../models/AuditLog.js";
import { protect, isAdmin } from "../middleware/auth.js";

const router = express.Router();

// 📌 Get admin/system logs with search, filters, pagination
router.get("/", protect, isAdmin, async (req, res) => {
  try {
    let {
      page = 1,
      limit = 10,
      search = "",
      action = "all",
      admin = "",
      user = "",
    } = req.query;

    page = Number(page);
    limit = Number(limit);

    const query = {};

    // ✅ Action filter
    if (action !== "all") {
      query.action = action;
    }

    // ✅ Global search (action + details text)
    if (search) {
      query.$or = [
        { action: { $regex: search, $options: "i" } },
        { details: { $regex: search, $options: "i" } },
      ];
    }

    // ✅ Admin filter (by name/email)
    if (admin && admin !== "all") {
      query.$or = [
        { "performedBy.name": { $regex: admin, $options: "i" } },
        { "performedBy.email": { $regex: admin, $options: "i" } },
      ];
    }

    // ✅ User filter (exact ObjectId match from dropdown)
    if (user && user !== "all") {
      query.performedBy = user;
    }

    const total = await AuditLog.countDocuments(query);

    const logs = await AuditLog.find(query)
      .populate("performedBy", "name email role")
      .populate("targetUser", "name email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      logs,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("Error fetching logs:", err);
    res.status(500).json({ message: "Failed to fetch logs" });
  }
});

export default router;

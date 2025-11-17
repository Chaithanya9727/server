import express from "express";
import AuditLog from "../models/AuditLog.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

/* =====================================================
   📋 GET AUDIT LOGS (Admins + SuperAdmin)
===================================================== */
router.get("/", protect, authorize("admin", "superadmin"), async (req, res) => {
  try {
    let { page = 1, limit = 10, search = "", action = "all", user = "all" } = req.query;

    page = Math.max(1, Number(page) || 1);
    limit = Math.min(100, Math.max(1, Number(limit) || 10));

    const query = {};

    if (action !== "all") query.action = action;

    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { action: { $regex: escaped, $options: "i" } },
        { details: { $regex: escaped, $options: "i" } },
      ];
    }

    if (user !== "all") query.performedBy = user;

    const total = await AuditLog.countDocuments(query);

    const logs = await AuditLog.find(query)
      .populate("performedBy", "name email role")
      .populate("targetUser", "name email role")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

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

/* =====================================================
   📄 EXPORT CSV
===================================================== */
router.get("/export/csv", protect, authorize("admin", "superadmin"), async (req, res) => {
  try {
    const logs = await AuditLog.find()
      .populate("performedBy", "name email role")
      .populate("targetUser", "name email role")
      .sort({ createdAt: -1 });

    if (!logs.length) {
      return res.status(404).json({ message: "No logs found" });
    }

    const header = "Action,Performed By,Target User,Details,Date\n";
    const rows = logs
      .map((log) => {
        const performer = log.performedBy
          ? `${log.performedBy.name} (${log.performedBy.email})`
          : "System";

        const target = log.targetUser
          ? `${log.targetUser.name} (${log.targetUser.email})`
          : "-";

        return `"${log.action}","${performer}","${target}","${log.details || "-"}","${new Date(
          log.createdAt
        ).toLocaleString()}"`;
      })
      .join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=audit_logs.csv");

    res.send(header + rows);
  } catch (err) {
    console.error("CSV export error:", err);
    res.status(500).json({ message: "Failed to export logs" });
  }
});

/* =====================================================
   🗑️ BULK DELETE SELECTED LOGS (SuperAdmin Only)
===================================================== */
router.delete("/bulk", protect, authorize("superadmin"), async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ message: "Invalid IDs" });
    }

    const result = await AuditLog.deleteMany({ _id: { $in: ids } });

    res.json({
      message: `Deleted ${result.deletedCount} logs`,
    });
  } catch (err) {
    console.error("Bulk delete error:", err);
    res.status(500).json({ message: "Failed to delete logs" });
  }
});

/* =====================================================
   ⚠️ BULK DELETE FILTERED LOGS
===================================================== */
router.delete("/bulk/all", protect, authorize("superadmin"), async (req, res) => {
  try {
    const { search = "", action = "all", user = "all" } = req.query;

    const query = {};

    if (action !== "all") query.action = action;

    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { action: { $regex: escaped, $options: "i" } },
        { details: { $regex: escaped, $options: "i" } },
      ];
    }

    if (user !== "all") query.performedBy = user;

    const result = await AuditLog.deleteMany(query);

    res.json({
      message: `Deleted ${result.deletedCount} logs`,
    });
  } catch (err) {
    console.error("Bulk all delete error:", err);
    res.status(500).json({ message: "Failed to delete filtered logs" });
  }
});

export default router;

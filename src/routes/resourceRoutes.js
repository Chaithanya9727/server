import express from "express";
import Resource from "../models/Resource.js";
import { protect } from "../middleware/auth.js";
import { authorize } from "../middleware/authorize.js";
import multer from "multer";
import cloudinary from "../utils/cloudinary.js";
import fs from "fs";
import AuditLog from "../models/AuditLog.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// 📌 GET: Public → fetch resources
router.get("/", async (req, res) => {
  try {
    let { search = "", type = "all", page = 1, limit = 6 } = req.query;
    page = Number(page);
    limit = Number(limit);

    const query = {};
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }
    if (type !== "all") query.type = type;

    const total = await Resource.countDocuments(query);
    const resources = await Resource.find(query)
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      resources,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("Fetch resources error:", err);
    res.status(500).json({ message: "Error fetching resources" });
  }
});

// 📌 Upload file (candidate/Admin/SuperAdmin)
router.post(
  "/upload",
  protect,
  authorize(["candidate", "admin", "superadmin"]),
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });

      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "onestop_resources",
        resource_type: "auto",
      });

      fs.unlinkSync(req.file.path);

      await AuditLog.create({
        action: "UPLOAD_RESOURCE_FILE",
        performedBy: req.user._id,
        details: `Uploaded file "${req.file.originalname}" → ${result.secure_url}`,
      });

      res.json({ url: result.secure_url });
    } catch (err) {
      console.error("Cloudinary upload error:", err);
      res.status(500).json({ message: "Upload failed" });
    }
  }
);

// 📌 Create resource (candidate/Admin/SuperAdmin)
router.post("/", protect, authorize(["candidate", "admin", "superadmin"]), upload.single("file"), async (req, res) => {
  try {
    const { title, description, type, url } = req.body;
    if (!title) return res.status(400).json({ message: "Title is required" });

    let resourceUrl = url;
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "onestop_resources",
        resource_type: "auto",
      });
      resourceUrl = result.secure_url;
      fs.unlinkSync(req.file.path);
    }

    const resource = await Resource.create({
      title,
      description,
      type,
      url: resourceUrl,
      createdBy: req.user._id,
    });

    await AuditLog.create({
      action: "CREATE_RESOURCE",
      performedBy: req.user._id,
      details: `Created resource "${title}" (id: ${resource._id})`,
    });

    res.status(201).json(resource);
  } catch (err) {
    console.error("Create resource error:", err);
    res.status(500).json({ message: "Error creating resource" });
  }
});

// 📌 Update resource (Owner/Admin/SuperAdmin)
router.put("/:id", protect, authorize(["candidate", "admin", "superadmin"]), upload.single("file"), async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id);
    if (!resource) return res.status(404).json({ message: "Resource not found" });

    if (
      resource.createdBy.toString() !== req.user._id.toString() &&
      req.user.role !== "admin" &&
      req.user.role !== "superadmin"
    ) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const { title, description, type, url } = req.body;
    const before = { ...resource._doc };

    resource.title = title ?? resource.title;
    resource.description = description ?? resource.description;
    resource.type = type ?? resource.type;

    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "onestop_resources",
        resource_type: "auto",
      });
      resource.url = result.secure_url;
      fs.unlinkSync(req.file.path);
    } else if (url) {
      resource.url = url;
    }

    await resource.save();

    await AuditLog.create({
      action: "UPDATE_RESOURCE",
      performedBy: req.user._id,
      details: `Updated resource (id: ${resource._id}) — title: "${before.title}" → "${resource.title}"`,
    });

    res.json(resource);
  } catch (err) {
    console.error("Update resource error:", err);
    res.status(500).json({ message: "Error updating resource" });
  }
});

// 📌 Delete resource (Admin + SuperAdmin)
router.delete("/:id", protect, authorize(["admin", "superadmin"]), async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id);
    if (!resource) return res.status(404).json({ message: "Resource not found" });

    const snapshot = {
      title: resource.title,
      url: resource.url,
      owner: resource.createdBy,
    };

    await resource.deleteOne();

    await AuditLog.create({
      action: "DELETE_RESOURCE",
      performedBy: req.user._id,
      targetUser: snapshot.owner,
      details: `Deleted resource "${snapshot.title}" (id: ${resource._id})`,
    });

    res.json({ message: "Resource deleted" });
  } catch (err) {
    console.error("Delete resource error:", err);
    res.status(500).json({ message: "Error deleting resource" });
  }
});

// 📌 Bulk delete all resources (SuperAdmin only)
router.delete("/bulk/all", protect, authorize(["superadmin"]), async (req, res) => {
  try {
    const count = await Resource.countDocuments();
    await Resource.deleteMany({});
    await AuditLog.create({
      action: "DELETE_ALL_RESOURCES",
      performedBy: req.user._id,
      details: `SuperAdmin deleted all ${count} resources`,
    });
    res.json({ message: `Deleted all ${count} resources ✅` });
  } catch (err) {
    res.status(500).json({ message: "Error bulk deleting resources" });
  }
});

export default router;

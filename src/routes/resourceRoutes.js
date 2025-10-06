import express from "express";
import Resource from "../models/Resource.js";
import { protect } from "../middleware/auth.js";
import { authorize } from "../middleware/authorize.js";
import multer from "multer";
import cloudinary from "../utils/cloudinary.js";
import fs from "fs";
import AuditLog from "../models/AuditLog.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" }); // temp storage

// =====================================================
// 📌 GET: Public → fetch resources with search + filter + pagination
// =====================================================
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
    if (type !== "all") {
      query.type = type;
    }

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

// =====================================================
// 📌 POST: Upload file → Cloudinary (students/admins)
// =====================================================
router.post(
  "/upload",
  protect,
  authorize(["student", "admin"]),
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "onestop_resources",
        resource_type: "auto",
      });

      // cleanup local temp file
      fs.unlinkSync(req.file.path);

      // 🔏 log upload
      try {
        await AuditLog.create({
          action: "UPLOAD_RESOURCE_FILE",
          performedBy: req.user._id,
          details: `Uploaded file "${req.file.originalname}" → ${result.secure_url}`,
        });
      } catch (e) {
        console.error("AuditLog (UPLOAD_RESOURCE_FILE) failed:", e.message);
      }

      res.json({ url: result.secure_url });
    } catch (err) {
      console.error("Cloudinary upload error:", err);
      res.status(500).json({ message: "Upload failed" });
    }
  }
);

// =====================================================
// 📌 POST: Create resource (students/admins)
// =====================================================
router.post(
  "/",
  protect,
  authorize(["student", "admin"]),
  upload.single("file"),
  async (req, res) => {
    try {
      const { title, description, type, url } = req.body;
      if (!title) return res.status(400).json({ message: "Title is required" });

      let resourceUrl = url;

      // If file is uploaded → Cloudinary
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

      // 🔏 log creation
      try {
        await AuditLog.create({
          action: "CREATE_RESOURCE",
          performedBy: req.user._id,
          details: `Created resource "${title}" (id: ${resource._id})`,
        });
      } catch (e) {
        console.error("AuditLog (CREATE_RESOURCE) failed:", e.message);
      }

      res.status(201).json(resource);
    } catch (err) {
      console.error("Create resource error:", err);
      res.status(500).json({ message: "Error creating resource" });
    }
  }
);

// =====================================================
// 📌 PUT: Update resource (owner or admin)
// =====================================================
router.put(
  "/:id",
  protect,
  authorize(["student", "admin"]),
  upload.single("file"),
  async (req, res) => {
    try {
      const resource = await Resource.findById(req.params.id);
      if (!resource) return res.status(404).json({ message: "Resource not found" });

      if (
        resource.createdBy.toString() !== req.user._id.toString() &&
        req.user.role !== "admin"
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

      // 🔏 log update
      try {
        await AuditLog.create({
          action: "UPDATE_RESOURCE",
          performedBy: req.user._id,
          details: `Updated resource (id: ${resource._id}) — title: "${before.title}" → "${resource.title}"`,
        });
      } catch (e) {
        console.error("AuditLog (UPDATE_RESOURCE) failed:", e.message);
      }

      res.json(resource);
    } catch (err) {
      console.error("Update resource error:", err);
      res.status(500).json({ message: "Error updating resource" });
    }
  }
);

// =====================================================
// 📌 DELETE: Delete resource (admin only)
// =====================================================
router.delete("/:id", protect, authorize(["admin"]), async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id);
    if (!resource) return res.status(404).json({ message: "Resource not found" });

    const snapshot = {
      title: resource.title,
      url: resource.url,
      owner: resource.createdBy,
    };

    await resource.deleteOne();

    // 🔏 log deletion
    try {
      await AuditLog.create({
        action: "DELETE_RESOURCE",
        performedBy: req.user._id,
        targetUser: snapshot.owner,
        details: `Deleted resource "${snapshot.title}" (id: ${resource._id})`,
      });
    } catch (e) {
      console.error("AuditLog (DELETE_RESOURCE) failed:", e.message);
    }

    res.json({ message: "Resource deleted" });
  } catch (err) {
    console.error("Delete resource error:", err);
    res.status(500).json({ message: "Error deleting resource" });
  }
});

export default router;

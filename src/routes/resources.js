import express from "express";
import Resource from "../models/Resource.js";
import { protect, authorize } from "../middleware/auth.js";
import cloudinary from "../utils/cloudinary.js";
import multer from "multer";
import AuditLog from "../models/AuditLog.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" }); // temporary storage

// 📌 Upload file → Cloudinary (students/admins)
router.post(
  "/upload",
  protect,
  authorize(["student", "admin"]),   // ✅ FIXED
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "studyhub/resources",
        resource_type: "auto", // pdf, docs, images, etc.
      });

      // 🔏 AUDIT: file upload for resources
      try {
        await AuditLog.create({
          action: "UPLOAD_RESOURCE_FILE",
          performedBy: req.user._id,
          details: `Uploaded "${req.file.originalname}" → ${result.secure_url}`,
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

// 📌 Public → everyone can view (with search + filter + pagination)
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
    console.error("Resource fetch error:", err);
    res.status(500).json({ message: "Error fetching resources" });
  }
});

// 📌 Students + Admins → create resource
router.post("/", protect, authorize(["student", "admin"]), async (req, res) => {
  try {
    const { title, description, type, url } = req.body;
    if (!title) return res.status(400).json({ message: "Title is required" });

    const doc = await Resource.create({
      title,
      description,
      type,
      url,
      user: req.user._id,
    });

    // 🔏 AUDIT: create resource
    try {
      await AuditLog.create({
        action: "CREATE_RESOURCE",
        performedBy: req.user._id,
        details: `Created resource "${title}" (id: ${doc._id})`,
      });
    } catch (e) {
      console.error("AuditLog (CREATE_RESOURCE) failed:", e.message);
    }

    res.status(201).json(doc);
  } catch (err) {
    console.error("Create resource error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// 📌 Students + Admins → update (own) | Admin → update any
router.put("/:id", protect, authorize(["student", "admin"]), async (req, res) => {
  try {
    const { id } = req.params;
    const resource = await Resource.findById(id);
    if (!resource) return res.status(404).json({ message: "Not found" });

    if (
      resource.user.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ message: "Not allowed" });
    }

    const before = {
      title: resource.title,
      description: resource.description,
      type: resource.type,
      url: resource.url,
    };

    resource.title = req.body.title ?? resource.title;
    resource.description = req.body.description ?? resource.description;
    resource.type = req.body.type ?? resource.type;
    resource.url = req.body.url ?? resource.url;

    await resource.save();

    // 🔏 AUDIT: update resource
    try {
      const after = {
        title: resource.title,
        description: resource.description,
        type: resource.type,
        url: resource.url,
      };
      const changed = Object.keys(after)
        .filter((k) => String(after[k]) !== String(before[k]))
        .map((k) => `${k}: "${before[k] ?? ""}" → "${after[k] ?? ""}"`)
        .join(", ");

      await AuditLog.create({
        action: "UPDATE_RESOURCE",
        performedBy: req.user._id,
        details:
          changed && changed.length
            ? `Updated resource (id: ${resource._id}) — ${changed}`
            : `Updated resource (id: ${resource._id}) — no field changes`,
      });
    } catch (e) {
      console.error("AuditLog (UPDATE_RESOURCE) failed:", e.message);
    }

    res.json(resource);
  } catch (err) {
    console.error("Update resource error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// 📌 Admin only → delete
router.delete("/:id", protect, authorize(["admin"]), async (req, res) => {
  try {
    const { id } = req.params;
    const resource = await Resource.findById(id);
    if (!resource) return res.status(404).json({ message: "Not found" });

    const snapshot = {
      title: resource.title,
      url: resource.url,
      owner: resource.user,
    };

    await resource.deleteOne();

    // 🔏 AUDIT: delete resource
    try {
      await AuditLog.create({
        action: "DELETE_RESOURCE",
        performedBy: req.user._id,
        targetUser: snapshot.owner,
        details: `Deleted resource "${snapshot.title}" (id: ${id})`,
      });
    } catch (e) {
      console.error("AuditLog (DELETE_RESOURCE) failed:", e.message);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("Delete resource error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;

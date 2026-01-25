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
    let { search = "", type = "all", page = 1, limit = 6, status, filter } = req.query;
    page = Number(page);
    limit = Number(limit);

    const query = {};
    
    // Status Logic:
    // 1. If filter="my" (and user is logged in context? - we assume public route might not have user unless middleware runs? 
    //    Actually this route is public, so no req.user unless we optionally attach it. 
    //    But normally 'my uploads' is fetched where token IS sent.
    //    However, for security, "my" filter usually implies we act on req.user._id.
    //    Since this is a public route, we can't rely on req.user unless we use 'protect' middleware.
    //    But the route isn't protected. 
    //    The frontend filters 'my' client side? No, we want server side.
    //    Let's handle the default case:
    
    if (status) {
        query.status = status;
    } else if (filter !== "my") {
        // Default to approved only if NOT looking for "my" uploads
        query.status = "approved";
    }
    // If filter == "my", we don't enforce status="approved" by default, so we can see pending.
    
    // If searching
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }
    if (type !== "all") query.type = type;

    const total = await Resource.countDocuments(query);
    const resources = await Resource.find(query)
      .populate("createdBy", "name email role")
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

// 📌 PATCH: Update Status (Approve/Reject) - Admin Only
router.patch("/:id/status", protect, authorize(["admin", "superadmin"]), async (req, res) => {
  try {
    const { status } = req.body; // 'approved' or 'rejected'
    const resource = await Resource.findById(req.params.id);
    if (!resource) return res.status(404).json({ message: "Resource not found" });

    resource.status = status;
    await resource.save();

    await AuditLog.create({
      action: "UPDATE_RESOURCE_STATUS",
      performedBy: req.user._id,
      details: `Resource "${resource.title}" status changed to ${status}`,
    });

    res.json(resource);
  } catch (err) {
    res.status(500).json({ message: "Error updating status" });
  }
});

// 📌 Upload file (candidate/Admin/SuperAdmin)
router.post(
  "/upload",
  protect,
  authorize(["candidate", "admin", "superadmin", "recruiter", "mentor"]),
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
router.post("/", protect, authorize(["candidate", "admin", "superadmin", "recruiter", "mentor"]), upload.single("file"), async (req, res) => {
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

    // Auto-approve if Admin/SuperAdmin/Mentor? 
    // Requirement: "resources by candidates should approve superadmin"
    // So candidates/recruiters -> pending. Admin/SuperAdmin -> approved.
    const isAutoApproved = ["admin", "superadmin"].includes(req.user.role);

    const resource = await Resource.create({
      title,
      description,
      type,
      url: resourceUrl,
      status: isAutoApproved ? "approved" : "pending",
      createdBy: req.user._id,
    });

    await AuditLog.create({
      action: "CREATE_RESOURCE",
      performedBy: req.user._id,
      details: `Created resource "${title}" (id: ${resource._id}) - Status: ${resource.status}`,
    });

    res.status(201).json(resource);
  } catch (err) {
    console.error("Create resource error:", err);
    res.status(500).json({ message: "Error creating resource" });
  }
});

// 📌 Update resource (Owner/Admin/SuperAdmin)
router.put("/:id", protect, authorize(["candidate", "admin", "superadmin", "recruiter", "mentor"]), upload.single("file"), async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id);
    if (!resource) return res.status(404).json({ message: "Resource not found" });

    if (
      resource.createdBy.toString() !== req.user._id.toString() &&
      !["admin", "superadmin"].includes(req.user.role)
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

// 📌 GET: Search Videos (YouTube API / Mock)
router.get("/videos", async (req, res) => {
  try {
    const { search = "programming" } = req.query;
    const apiKey = process.env.YOUTUBE_API_KEY;

    // 1️⃣ MOCK DATA (If no API key or explicitly requested)
    if (!apiKey) {
      console.log("⚠️ No YOUTUBE_API_KEY found. Returning mock videos.");
      return res.json([
        {
          id: "mock-1",
          videoId: "SqcY0GlETPk",
          title: "React Tutorial for Beginners",
          description: "Learn React JS in this full course for beginners.",
          thumbnail: "https://img.youtube.com/vi/SqcY0GlETPk/mqdefault.jpg",
          channel: "Programming with Mosh",
        },
        {
          id: "mock-2",
          videoId: "PkZNo7MFNFg",
          title: "Learn JavaScript - Full Course for Beginners",
          description: "This complete JavaScript course will teach you everything...",
          thumbnail: "https://img.youtube.com/vi/PkZNo7MFNFg/mqdefault.jpg",
          channel: "freeCodeCamp.org",
        },
        {
          id: "mock-3",
          videoId: "ZVBjSCTu+vU",
          title: "Data Structures and Algorithms in Python",
          description: "Full Tutorial for Beginners...",
          thumbnail: "https://img.youtube.com/vi/pkYVOmU3MgA/mqdefault.jpg",
          channel: "Amigoscode",
        },
        {
          id: "mock-4",
          videoId: "W6NZfCO5SIk",
          title: "JavaScript Tutorial for Beginners: Learn JavaScript in 1 Hour",
          description: "Watch this JavaScript tutorial for beginners to learn JavaScript basics in one hour.",
          thumbnail: "https://img.youtube.com/vi/W6NZfCO5SIk/mqdefault.jpg",
          channel: "Programming with Mosh",
        },
        {
            id: "mock-5",
            videoId: "bMknfKXIFA8",
            title: "React Course - Beginner's Tutorial for React JavaScript Library [2022]",
            description: "React is one of the most popular JavaScript libraries for building user interfaces.",
            thumbnail: "https://img.youtube.com/vi/bMknfKXIFA8/mqdefault.jpg",
            channel: "freeCodeCamp.org",
        },
        {
            id: "mock-6",
            videoId: "jBOy6cZ2cBE",
            title: "Web Development Full Course - 10 Hours | Learn Web Development",
            description: "Web development full course for beginners.",
            thumbnail: "https://img.youtube.com/vi/jBOy6cZ2cBE/mqdefault.jpg",
            channel: "Edureka",
        }
      ].filter(v => v.title.toLowerCase().includes(search.toLowerCase()) || search === "programming"));
    }

    // 2️⃣ REAL YOUTUBE API
    // categoryId 27 = Education
    // We also append "study education" to the query to be extra strict
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=12&q=${encodeURIComponent(
        search + " education study tutorial"
      )}&type=video&videoCategoryId=27&key=${apiKey}`
    );
    const data = await response.json();

    if (!data.items) {
      throw new Error("YouTube API limit reached or invalid key");
    }

    const videos = data.items.map((item) => ({
      id: item.id.videoId,
      videoId: item.id.videoId,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnail: item.snippet.thumbnails.medium.url,
      channel: item.snippet.channelTitle,
    }));

    res.json(videos);
  } catch (err) {
    console.error("Video search error:", err.message);
    // Fallback on error
    res.json([]);
  }
});

export default router;


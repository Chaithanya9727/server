import express from "express";
import Event from "../models/Event.js";
import { protect } from "../middleware/auth.js";
import { authorize } from "../middleware/authorize.js";
import AuditLog from "../models/AuditLog.js";

const router = express.Router();

// ➕ Create Event (Admin + SuperAdmin)
router.post("/", protect, authorize(["admin", "superadmin"]), async (req, res) => {
  try {
    const { title, description, date, location } = req.body;
    const event = await Event.create({
      title,
      description,
      date,
      location,
      createdBy: req.user._id,
    });

    await AuditLog.create({
      action: "CREATE_EVENT",
      performedBy: req.user._id,
      details: `Created event "${title}" on ${date} at ${location}`,
    });

    res.status(201).json(event);
  } catch (err) {
    console.error("Create event error:", err);
    res.status(500).json({ message: "Error creating event" });
  }
});

// 📌 Get Events (Public)
router.get("/", async (req, res) => {
  try {
    const { search = "", page = 1, limit = 6 } = req.query;
    const query = search ? { title: { $regex: search, $options: "i" } } : {};

    const total = await Event.countDocuments(query);
    const events = await Event.find(query)
      .sort({ date: 1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({
      events,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("Fetch events error:", err);
    res.status(500).json({ message: "Error fetching events" });
  }
});

// ✏️ Update Event (Admin + SuperAdmin)
router.put("/:id", protect, authorize(["admin", "superadmin"]), async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: "Event not found" });

    const before = {
      title: event.title,
      description: event.description,
      date: event.date,
      location: event.location,
    };

    event.title = req.body.title ?? event.title;
    event.description = req.body.description ?? event.description;
    event.date = req.body.date ?? event.date;
    event.location = req.body.location ?? event.location;

    await event.save();

    const after = {
      title: event.title,
      description: event.description,
      date: event.date,
      location: event.location,
    };

    const changes = Object.keys(after)
      .filter((k) => String(after[k]) !== String(before[k]))
      .map((k) => `${k}: "${before[k]}" → "${after[k]}"`)
      .join(", ");

    await AuditLog.create({
      action: "UPDATE_EVENT",
      performedBy: req.user._id,
      details: changes || `Event (id: ${event._id}) updated with no changes`,
    });

    res.json(event);
  } catch (err) {
    console.error("Update event error:", err);
    res.status(500).json({ message: "Error updating event" });
  }
});

// ❌ Delete Event (Admin + SuperAdmin)
router.delete("/:id", protect, authorize(["admin", "superadmin"]), async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: "Event not found" });

    await event.deleteOne();

    await AuditLog.create({
      action: "DELETE_EVENT",
      performedBy: req.user._id,
      details: `Deleted event "${event.title}" (id: ${event._id})`,
    });

    res.json({ message: "Event deleted successfully" });
  } catch (err) {
    console.error("Delete event error:", err);
    res.status(500).json({ message: "Error deleting event" });
  }
});

// 🧹 Bulk Delete All Events (SuperAdmin only)
router.delete("/bulk/all", protect, authorize(["superadmin"]), async (req, res) => {
  try {
    const count = await Event.countDocuments();
    await Event.deleteMany({});
    await AuditLog.create({
      action: "DELETE_ALL_EVENTS",
      performedBy: req.user._id,
      details: `SuperAdmin deleted all ${count} events`,
    });
    res.json({ message: `Deleted all ${count} events ✅` });
  } catch (err) {
    console.error("Bulk delete events error:", err);
    res.status(500).json({ message: "Error bulk deleting events" });
  }
});

export default router;

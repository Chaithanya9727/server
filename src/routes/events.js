// routes/events.js
import express from "express";
import {
  createEvent,
  getEvents,
  getEventById,
  updateEvent,
  deleteEvent,
  registerForEvent,
  uploadSubmission,
  evaluateSubmission,
  getLeaderboard,
  listSubmissionsForEvent,
  listMyRegistrations,
  eventAdminMetrics,
  upload,
} from "../controllers/eventController.js";

import { protect } from "../middleware/auth.js";
import { authorize } from "../middleware/authorize.js";
import { getEventRegistrations } from "../controllers/registrationController.js";
import AuditLog from "../models/AuditLog.js";
import Event from "../models/Event.js";

const router = express.Router();

/* =====================================================
   📊 REGISTRATIONS (Unstop-Style Admin Panel)
===================================================== */

/**
 * @route   GET /api/events/:eventId/registrations
 * @desc    Paginated list of all participants for a specific event
 * @access  Admin / Mentor / SuperAdmin
 */
router.get(
  "/:eventId/registrations",
  protect,
  authorize(["admin", "mentor", "superadmin"]),
  getEventRegistrations
);

/* =====================================================
   🧱 EVENT CRUD & PUBLIC ROUTES
===================================================== */

/**
 * @route   POST /api/events
 * @desc    Create new event
 * @access  Admin / Mentor / SuperAdmin
 */
router.post(
  "/",
  protect,
  authorize(["admin", "mentor", "superadmin"]),
  upload.single("cover"), // optional banner image
  createEvent
);

/**
 * @route   GET /api/events
 * @desc    Public event listing with optional filters
 * @access  Public
 */
router.get("/", getEvents);

/**
 * @route   GET /api/events/:id
 * @desc    Get single event details
 * @access  Public
 */
router.get("/:id", getEventById);

/**
 * @route   PUT /api/events/:id
 * @desc    Update event details
 * @access  Admin / Mentor / SuperAdmin
 */
router.put(
  "/:id",
  protect,
  authorize(["admin", "mentor", "superadmin"]),
  upload.single("cover"),
  updateEvent
);

/**
 * @route   DELETE /api/events/:id
 * @desc    Delete event
 * @access  Admin / Mentor / SuperAdmin
 */
router.delete(
  "/:id",
  protect,
  authorize(["admin", "mentor", "superadmin"]),
  deleteEvent
);

/* =====================================================
   🎟️ REGISTRATION & SUBMISSION FLOW
===================================================== */

/**
 * @route   POST /api/events/:id/register
 * @desc    Register a user/team for the event
 * @access  Logged-in users
 */
router.post("/:id/register", protect, registerForEvent);

/**
 * @route   POST /api/events/:id/submit
 * @desc    Submit a project or file for an event
 * @access  Registered users
 */
router.post("/:id/submit", protect, upload.single("file"), uploadSubmission);

/**
 * @route   POST /api/events/:id/evaluate
 * @desc    Admin/Mentor/SuperAdmin evaluates a participant
 * @access  Admin / Mentor / SuperAdmin
 */
router.post(
  "/:id/evaluate",
  protect,
  authorize(["admin", "mentor", "superadmin"]),
  evaluateSubmission
);

/**
 * @route   GET /api/events/:id/leaderboard
 * @desc    Get leaderboard for an event
 * @access  Public
 */
router.get("/:id/leaderboard", getLeaderboard);

/* =====================================================
   📈 DASHBOARD & METRICS
===================================================== */

/**
 * @route   GET /api/events/registrations/me
 * @desc    Get events registered by logged-in user
 * @access  Logged-in users
 */
router.get("/registrations/me", protect, listMyRegistrations);

/**
 * @route   GET /api/events/admin/metrics
 * @desc    Admin dashboard metrics overview
 * @access  Admin / Mentor / SuperAdmin
 */
router.get(
  "/admin/metrics",
  protect,
  authorize(["admin", "mentor", "superadmin"]),
  eventAdminMetrics
);

/**
 * @route   GET /api/events/:id/submissions
 * @desc    List all submissions for an event (Admin)
 * @access  Admin / Mentor / SuperAdmin
 */
router.get(
  "/:id/submissions",
  protect,
  authorize(["admin", "mentor", "superadmin"]),
  listSubmissionsForEvent
);

/* =====================================================
   🗑️ LEGACY UTILITIES (SuperAdmin Only)
===================================================== */

/**
 * @route   DELETE /api/events/bulk/all
 * @desc    Delete all events (SuperAdmin)
 * @access  SuperAdmin only
 */
router.delete(
  "/bulk/all",
  protect,
  authorize(["superadmin"]),
  async (req, res) => {
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
  }
);

export default router;

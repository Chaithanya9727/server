// src/models/AuditLog.js
import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    // 🎯 Type of action performed (e.g., "MENTOR_APPROVED", "LOGIN", "DELETE_USER")
    action: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    // 👤 User affected by the action (optional)
    targetUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // 📦 Snapshot of affected user (keeps context even if user is deleted)
    targetUserSnapshot: {
      name: { type: String, trim: true },
      email: { type: String, trim: true, lowercase: true },
      role: { type: String, trim: true },
    },

    // ⚙️ User who performed the action (Admin / Mentor / SuperAdmin / Candidate)
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // 🧾 Who performed (snapshot, for historical accuracy)
    performedBySnapshot: {
      name: { type: String, trim: true },
      email: { type: String, trim: true, lowercase: true },
      role: { type: String, trim: true },
    },

    // 🧠 Detailed message or metadata
    details: {
      type: String,
      trim: true,
      default: "",
    },

    // 🌍 Optional IP, device, or environment details
    context: {
      ip: { type: String, default: "" },
      userAgent: { type: String, default: "" },
      location: { type: String, default: "" },
    },
  },
  {
    timestamps: true, // adds createdAt, updatedAt
  }
);

// 🧠 Pre-save hook to ensure lowercase emails
auditLogSchema.pre("save", function (next) {
  if (this.targetUserSnapshot?.email) {
    this.targetUserSnapshot.email = this.targetUserSnapshot.email.toLowerCase();
  }
  if (this.performedBySnapshot?.email) {
    this.performedBySnapshot.email = this.performedBySnapshot.email.toLowerCase();
  }
  next();
});

// 🧭 Index for performance (sort/filter logs faster)
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ "performedBySnapshot.email": 1 });

// ✅ Model export
export default mongoose.model("AuditLog", auditLogSchema);

import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    // 🎯 What happened (e.g., "CREATE_ADMIN", "PROMOTE_TO_ADMIN", "DELETE_RESOURCE")
    action: {
      type: String,
      required: true,
      trim: true,
    },

    // 👤 Which user was affected by this action (optional)
    targetUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // 🧾 Snapshot of the affected user’s details (so logs stay valid even if user deleted)
    targetUserSnapshot: {
      name: String,
      email: String,
      role: String,
    },

    // ⚙️ Who performed this action (SuperAdmin / Admin / etc)
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // 🧠 Extra info — anything about what was done
    details: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true, // ✅ keeps createdAt, updatedAt auto
  }
);

// Optional: Index for performance (sort/filter logs faster)
auditLogSchema.index({ createdAt: -1 });

export default mongoose.model("AuditLog", auditLogSchema);

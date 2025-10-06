import mongoose from "mongoose"

const auditLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true },  // e.g. "Deleted User", "Changed Role"
    targetUser: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    targetUserSnapshot: {   // ✅ store details so logs survive deletes
      name: String,
      email: String,
    },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    details: String,
  },
  { timestamps: true }
)

export default mongoose.model("AuditLog", auditLogSchema)

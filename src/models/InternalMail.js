// models/InternalMail.js
import mongoose from "mongoose";

const internalMailSchema = new mongoose.Schema(
  {
    from: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    toUser: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // optional if sent by email only
    toEmail: { type: String, required: true },
    subject: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    priority: { type: String, enum: ["Low", "Normal", "High"], default: "Normal" },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

internalMailSchema.index({ toEmail: 1, createdAt: -1 });
internalMailSchema.index({ from: 1, createdAt: -1 });

export default mongoose.model("InternalMail", internalMailSchema);

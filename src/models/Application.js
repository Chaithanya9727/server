// models/Application.js
import mongoose from "mongoose";

const ApplicationSchema = new mongoose.Schema({
  job: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true },
  candidate: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  resumeUrl: { type: String },
  coverLetter: { type: String },
  status: {
    type: String,
    enum: ["applied", "shortlisted", "rejected", "hired"],
    default: "applied",
  },
  atsScore: { type: Number },
  atsVerdict: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

ApplicationSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

export default mongoose.models.Application || mongoose.model("Application", ApplicationSchema);

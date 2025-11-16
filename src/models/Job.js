import mongoose from "mongoose";

const jobSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    skills: [{ type: String, trim: true }],
    location: { type: String, required: true, trim: true },
    salary: { type: String, default: "Not Disclosed" },
    type: { type: String, enum: ["Full-time", "Part-time", "Internship"], default: "Full-time" },

    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    applicants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Application",
      },
    ],

    status: {
      type: String,
      enum: ["active", "pending", "approved", "closed"],
      default: "pending",
    },

    visibility: {
      type: String,
      enum: ["public", "private"],
      default: "public",
    },
  },
  { timestamps: true }
);

// 🧠 Index for recruiter dashboard analytics
jobSchema.index({ postedBy: 1, createdAt: -1 });

export default mongoose.model("Job", jobSchema);

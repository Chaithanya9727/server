// models/Submission.js
import mongoose from "mongoose";

const submissionSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // 🔗 Optional: if submissions are team-based
    teamName: {
      type: String,
      default: "",
      trim: true,
    },

    // 🧾 Core Submission Content
    submissionLink: {
      type: String, // e.g., GitHub repo, Google Drive link, etc.
      default: "",
      trim: true,
    },
    fileUrl: {
      type: String, // uploaded file URL (if applicable)
      default: "",
      trim: true,
    },
    filePublicId: {
      type: String,
      default: "",
    },
    notes: {
      type: String,
      default: "",
      trim: true,
    },

    // 🏁 Status Tracking
    status: {
      type: String,
      enum: ["submitted", "under_review", "reviewed", "rejected"],
      default: "submitted",
    },

    // 🧮 Scoring (from Judge Panel)
    scoreBreakdown: [
      {
        criteria: { type: String },
        score: { type: Number, min: 0, max: 100 },
        feedback: { type: String },
      },
    ],
    finalScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
    feedback: {
      type: String,
      default: "",
    },

    // 🕓 Auto timestamps: createdAt = submitted time
  },
  { timestamps: true }
);

// Prevent duplicate submission per (event, user)
submissionSchema.index({ event: 1, user: 1 }, { unique: true });

const Submission = mongoose.model("Submission", submissionSchema);
export default Submission;

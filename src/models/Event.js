import mongoose from "mongoose";

/* =====================================================
   💬 FAQ SUB-SCHEMA
   - Uses `question` / `answer` for consistency with frontend & backend
===================================================== */
const faqSchema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true, trim: true },
  },
  { _id: false }
);

/* =====================================================
   🖼️ IMAGE SUB-SCHEMA (for cover images)
===================================================== */
const imageSchema = new mongoose.Schema(
  { url: String, publicId: String },
  { _id: false }
);

/* =====================================================
   ❓ QUIZ QUESTION SUB-SCHEMA
===================================================== */
const quizQuestionSchema = new mongoose.Schema({
  question: { type: String, required: true },
  options: [{ type: String, required: true }], 
  correctOption: { type: Number, required: true }, // Index 0-3
  marks: { type: Number, default: 1 }
}, { _id: true });

/* =====================================================
   👥 PARTICIPANT SUB-SCHEMA
===================================================== */
const participantSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    teamName: { type: String, trim: true },

    submissionStatus: {
      type: String,
      enum: ["not_submitted", "submitted", "reviewed"],
      default: "not_submitted",
    },
    score: { type: Number, min: 0, default: null },
    feedback: { type: String, trim: true },
    round: { type: Number, default: 1 },
    registeredAt: { type: Date, default: Date.now },
    lastUpdated: { type: Date },
  },
  { _id: false }
);

/* =====================================================
   🎉 MAIN EVENT SCHEMA
===================================================== */
const eventSchema = new mongoose.Schema(
  {
    // Basic Details
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, default: "" },
    description: { type: String, default: "" },

    // Organizer & Type
    organizer: { type: String, default: "" },
    category: {
      type: String,
      enum: ["hackathon", "quiz", "case", "job-challenge", "workshop", "other"],
      default: "other",
    },
    tags: [{ type: String, trim: true }],
    location: { type: String, default: "Online" },
    coverImage: imageSchema,

    // 🔗 Linked Hiring Opportunity (Hybrid Event)
    linkedJob: { type: mongoose.Schema.Types.ObjectId, ref: "Job" },

    // Dates
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    registrationDeadline: { type: Date, required: true },

    // Event Structure
    maxTeamSize: { type: Number, default: 1, min: 1 },
    prizes: [{ type: String }],
    rules: [{ type: String }],
    faqs: [faqSchema],
    
    // Quiz Config
    quiz: {
      questions: [quizQuestionSchema],
      duration: { type: Number, default: 15 } // minutes
    },

    // Visibility
    visibility: { type: String, enum: ["public", "private"], default: "public" },

    // Creator
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // Participants
    participants: { type: [participantSchema], default: [] },
  },
  { timestamps: true }
);

/* =====================================================
   ⚡ VIRTUAL FIELDS
===================================================== */
eventSchema.virtual("status").get(function () {
  const now = new Date();
  if (now < this.startDate) return "upcoming";
  if (now > this.endDate) return "ended";
  return "ongoing";
});

/* =====================================================
   🧠 METHODS
===================================================== */
eventSchema.methods.updateParticipant = function (userId, updater) {
  const index = this.participants.findIndex(
    (p) => String(p.userId) === String(userId)
  );
  if (index === -1) return false;

  const p = this.participants[index];
  updater(p);
  p.lastUpdated = new Date();
  this.markModified("participants");
  return true;
};

/* =====================================================
   🧹 DATA SAFETY CHECKS (Pre-save Hook)
===================================================== */
eventSchema.pre("save", function (next) {
  // Ensure tags is always a flat array of strings (no nested arrays)
  if (Array.isArray(this.tags)) {
    this.tags = this.tags.flat().map((t) => String(t).trim());
  }
  next();
});

/* =====================================================
   🧾 SCHEMA CONFIG
===================================================== */
eventSchema.set("toJSON", { virtuals: true });
eventSchema.set("toObject", { virtuals: true });

/* =====================================================
   🔍 INDEXES (for search & performance)
   ⚠️ `tags` removed from text index permanently
===================================================== */
eventSchema.index({
  title: "text",
  description: "text",
  organizer: "text",
});

eventSchema.index({
  startDate: 1,
  endDate: 1,
  registrationDeadline: 1,
  createdAt: -1,
});

eventSchema.index({ "participants.userId": 1 });
eventSchema.index({ "participants.registeredAt": 1 });

/* =====================================================
   ✅ EXPORT MODEL
===================================================== */
const Event = mongoose.model("Event", eventSchema);
export default Event;

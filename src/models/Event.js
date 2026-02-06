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

    // Custom Form Responses
    customResponses: [
      {
        fieldId: String,
        label: String,
        value: mongoose.Schema.Types.Mixed
      }
    ],

    submissionStatus: {
      type: String,
      enum: ["not_submitted", "submitted", "reviewed", "shortlisted", "rejected"],
      default: "not_submitted",
    },
    
    // Multi-Round Progress
    currentRound: { type: Number, default: 1 },
    roundStatus: [
      {
        roundId: Number,
        score: { type: Number, default: null },
        feedback: { type: String, default: "" },
        status: { type: String, enum: ["pending", "qualified", "disqualified"], default: "pending" },
        evaluatedAt: Date
      }
    ],

    score: { type: Number, min: 0, default: null }, // Final/Aggregate score
    feedback: { type: String, trim: true },
    registeredAt: { type: Date, default: Date.now },
    lastUpdated: { type: Date },
    
    // Rewards
    certificateUrl: { type: String, default: "" },
    isWinner: { type: Boolean, default: false },
    rank: { type: Number, default: null }
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
    venue: { type: String, default: "" }, // ✨ New: Physical venue if any
    coverImage: imageSchema,

    // 🔗 Linked Hiring Opportunity (Hybrid Event)
    linkedJob: { type: mongoose.Schema.Types.ObjectId, ref: "Job" },

    // Dates
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    registrationDeadline: { type: Date, required: true },

    // 🏆 Multi-Round Pipeline
    rounds: [
      {
         roundNumber: { type: Number, required: true },
         title: { type: String, required: true },
         type: { type: String, enum: ["quiz", "submission", "interview", "other"], default: "submission" },
         description: { type: String, default: "" },
         startDate: Date,
         endDate: Date,
         isElimination: { type: Boolean, default: true }
      }
    ],

    // 📝 Custom Registration Form Builder
    customFields: [
      {
         id: { type: String, required: true },
         label: { type: String, required: true },
         type: { type: String, enum: ["text", "number", "dropdown", "file", "url"], default: "text" },
         options: [{ type: String }], // for dropdown
         required: { type: Boolean, default: false },
         placeholder: String
      }
    ],

    // 📜 Certificate Configuration
    certificateConfig: {
       enabled: { type: Boolean, default: false },
       templateUrl: String,
       signatureUrl: String,
       issuingAuthority: String,
       issuerDesignation: String
    },

    // 🤝 Team Finder
    maxTeamSize: { type: Number, default: 1, min: 1 },
    teamFinderEnabled: { type: Boolean, default: true },

    // Rewards & Rules
    prizes: [{ type: String }],
    rules: [{ type: String }],
    faqs: [faqSchema],
    
    // Quiz Config (Round 1 fallback or standalone)
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

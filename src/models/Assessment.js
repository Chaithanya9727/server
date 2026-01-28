import mongoose from "mongoose";

const questionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["MCQ", "Multiple Select", "True/False", "Short Answer", "Coding"],
    required: true
  },
  question: { type: String, required: true },
  options: [String], // For MCQ/Multiple Select
  correctAnswer: mongoose.Schema.Types.Mixed, // String for MCQ, Array for Multiple Select, String for others
  explanation: String,
  difficulty: {
    type: String,
    enum: ["Easy", "Medium", "Hard"],
    default: "Medium"
  },
  tags: [String], // ["JavaScript", "React", "DSA"]
  points: { type: Number, default: 1 }
});

const assessmentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  
  // Creator
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  creatorRole: { type: String, enum: ["recruiter", "admin"], required: true },
  
  // Questions
  questions: [questionSchema],
  
  // Settings
  duration: { type: Number, required: true }, // in minutes
  passingScore: { type: Number, default: 60 }, // percentage
  allowReview: { type: Boolean, default: true }, // Can review answers after submission
  shuffleQuestions: { type: Boolean, default: false },
  showResults: { type: Boolean, default: true }, // Show results immediately
  
  // Proctoring (basic)
  tabSwitchLimit: { type: Number, default: 3 }, // Max tab switches allowed
  enableCamera: { type: Boolean, default: false },
  
  // Access Control
  isPublic: { type: Boolean, default: true },
  allowedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // If private
  
  // Metadata
  category: { type: String, default: "General" }, // "Technical", "Aptitude", "HR"
  difficulty: { type: String, enum: ["Easy", "Medium", "Hard"], default: "Medium" },
  tags: [String],
  
  // Stats
  totalAttempts: { type: Number, default: 0 },
  averageScore: { type: Number, default: 0 },
  
  // Status
  isActive: { type: Boolean, default: true },
  publishedAt: Date,
  expiresAt: Date
}, { timestamps: true });

const attemptSchema = new mongoose.Schema({
  assessment: { type: mongoose.Schema.Types.ObjectId, ref: "Assessment", required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  
  // Answers
  answers: [{
    questionId: mongoose.Schema.Types.ObjectId,
    answer: mongoose.Schema.Types.Mixed, // User's answer
    isCorrect: Boolean,
    pointsEarned: Number,
    timeTaken: Number // seconds for this question
  }],
  
  // Scoring
  totalScore: { type: Number, default: 0 },
  percentage: { type: Number, default: 0 },
  passed: { type: Boolean, default: false },
  
  // Timing
  startedAt: { type: Date, default: Date.now },
  submittedAt: Date,
  timeSpent: Number, // in seconds
  
  // Proctoring Data
  tabSwitches: { type: Number, default: 0 },
  flagged: { type: Boolean, default: false },
  flagReason: String,
  
  // Status
  status: {
    type: String,
    enum: ["in-progress", "submitted", "expired", "flagged"],
    default: "in-progress"
  }
}, { timestamps: true });

export const Assessment = mongoose.model("Assessment", assessmentSchema);
export const AssessmentAttempt = mongoose.model("AssessmentAttempt", attemptSchema);

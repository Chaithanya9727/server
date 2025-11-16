import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    /* 👤 Core Identity */
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    mobile: { type: String, default: "" },
    avatar: { type: String, default: "" },

    /* 🏢 Company Info (Recruiter Extended Fields) */
    companyWebsite: { type: String, default: "" },
    companyDescription: { type: String, default: "" },

    /* 🧩 Roles */
    role: {
      type: String,
      enum: ["candidate", "mentor", "recruiter", "admin", "superadmin", "guest"],
      default: "candidate",
      lowercase: true,
      trim: true,
    },
    allowedRoles: {
      type: [String],
      default: [],
    },

    /* 🏢 Recruiter-specific fields */
    orgName: { type: String, trim: true, default: "" },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "approved", // auto-approved for non-recruiters
    },

    /* 🔐 Recovery */
    resetPasswordToken: String,
    resetPasswordExpire: Date,

    /* 🕒 Login & Activity */
    lastLogin: { type: Date },
    loginHistory: [
      {
        at: { type: Date, default: Date.now },
        ip: String,
        userAgent: String,
        location: String,
      },
    ],

    /* 🎓 Mentor fields */
    mentorProfile: {
      expertise: { type: String, default: "" },
      experience: { type: Number, default: 0 },
      bio: { type: String, default: "" },
    },
    mentorRequested: { type: Boolean, default: false },
    mentorApproved: { type: Boolean, default: false },
    mentees: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    mentorAssigned: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    /* 🧾 Candidate Profile Integration */
    resumeUrl: { type: String, default: "" },
    resumePublicId: { type: String, default: "" }, // for Cloudinary deletes/updates
    coverLetter: { type: String, default: "" },

    savedJobs: [{ type: mongoose.Schema.Types.ObjectId, ref: "Job" }],

    applications: [
      {
        job: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true },
        status: {
          type: String,
          enum: ["applied", "under_review", "shortlisted", "rejected", "hired", "withdrawn"],
          default: "applied",
        },
        appliedAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

/* 🧩 Role & Authorization Normalization */
userSchema.pre("save", function (next) {
  if (this.role) this.role = this.role.toLowerCase().trim();
  if (!this.allowedRoles.includes(this.role)) this.allowedRoles.push(this.role);
  this.allowedRoles = this.allowedRoles.map((r) => r.toLowerCase().trim());
  if (this.role !== "recruiter" && !this.status) this.status = "approved";
  next();
});

/* 🔒 Password Hashing */
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

/* 🔑 Password Comparison */
userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model("User", userSchema);

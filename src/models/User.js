import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },

    email: { type: String, required: true, unique: true, lowercase: true, trim: true },

    password: { type: String, required: true, minlength: 6, select: false },

    role: {
      type: String,
      enum: ["candidate", "mentor", "recruiter", "admin", "superadmin", "guest"],
      default: "candidate",
      lowercase: true,
      trim: true,
    },

    // ✅ Multi-role authorization support
    allowedRoles: {
      type: [String],
      default: [],
    },

    mobile: { type: String, default: "" },
    avatar: { type: String, default: "" },

    resetPasswordToken: String,
    resetPasswordExpire: Date,

    // ✅ Login tracking
    lastLogin: { type: Date },
    loginHistory: [
      {
        at: { type: Date, default: Date.now },
        ip: String,
        userAgent: String,
        location: String,
      },
    ],

    /* =====================================================
       🎓 Mentor-related Fields
    ===================================================== */
    mentorProfile: {
      expertise: { type: String, default: "" },
      experience: { type: Number, default: 0 },
      bio: { type: String, default: "" },
    },

    // ✅ These were missing before
    mentorRequested: { type: Boolean, default: false },
    mentorApproved: { type: Boolean, default: false },

    // ✅ Relation mappings
    mentees: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    mentorAssigned: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

/* =====================================================
   🧩 Role consistency
===================================================== */
userSchema.pre("save", function (next) {
  if (this.role) this.role = this.role.toLowerCase().trim();

  if (!this.allowedRoles.includes(this.role)) {
    this.allowedRoles.push(this.role);
  }

  this.allowedRoles = this.allowedRoles.map((r) => r.toLowerCase().trim());
  next();
});

/* =====================================================
   🔒 Password hashing
===================================================== */
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

/* =====================================================
   🔑 Compare passwords
===================================================== */
userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model("User", userSchema);

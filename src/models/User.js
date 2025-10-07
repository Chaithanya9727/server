// src/models/User.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },

    email: { type: String, required: true, unique: true, lowercase: true, trim: true },

    // Hide by default; explicitly select in login
    password: { type: String, required: true, minlength: 6, select: false },

    role: {
      type: String,
      enum: ["student", "admin", "guest"],
      default: "student",
      lowercase: true,
      trim: true,
    },

    mobile: { type: String, default: "" }, // ✅ used by /send-otp for SMS

    avatar: { type: String, default: "" },

    resetPasswordToken: String,
    resetPasswordExpire: Date,

    // ✅ Login Tracking
    lastLogin: { type: Date },
    loginHistory: [
      {
        at: { type: Date, default: Date.now },
        ip: String,
        userAgent: String,
        location: String,
      },
    ],
  },
  { timestamps: true }
);

// ✅ Hash password before save
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ✅ Ensure role is always lowercase/trimmed
userSchema.pre("save", function (next) {
  if (this.role) this.role = this.role.toLowerCase().trim();
  next();
});

// ✅ Compare passwords
userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model("User", userSchema);

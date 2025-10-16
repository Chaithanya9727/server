// models/OTP.js
import mongoose from "mongoose";

const otpSchema = new mongoose.Schema(
  {
    email: { type: String },
    phone: { type: String },
    otp: { type: String, required: true },

    // ✅ purpose now supports both password-reset and email-verification
    purpose: {
      type: String,
      enum: ["password-reset", "email-verification"],
      required: true,
    },

    // ✅ whether the OTP was successfully verified
    verified: { type: Boolean, default: false },

    // ✅ Auto-expire OTP after 5 minutes
    expiresAt: {
      type: Date,
      default: Date.now,
      index: { expires: 300 }, // 300s = 5 minutes
    },
  },
  { timestamps: true }
);

// ✅ Ensure compound index for faster lookups
otpSchema.index({ email: 1, purpose: 1 });

export default mongoose.model("OTP", otpSchema);

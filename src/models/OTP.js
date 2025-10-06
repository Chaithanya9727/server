// models/OTP.js
import mongoose from "mongoose";

const otpSchema = new mongoose.Schema(
  {
    email: { type: String },
    phone: { type: String },
    otp: { type: String, required: true },
    purpose: { type: String, enum: ["password-reset"], required: true },
    // TTL index: auto-delete after ~5 minutes
    expiresAt: { type: Date, default: Date.now, index: { expires: 300 } },
  },
  { timestamps: true }
);

export default mongoose.model("OTP", otpSchema);

import mongoose from "mongoose";

const contactSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000, // reasonable limit
    },
    replies: [
      {
        text: { type: String, required: true, trim: true },
        repliedAt: { type: Date, default: Date.now },
        repliedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],
    status: {
      type: String,
      enum: ["Pending", "Replied", "Closed"],
      default: "Pending",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Optional index for admin queries (better performance)
contactSchema.index({ email: 1, subject: 1 });

export default mongoose.model("Contact", contactSchema);

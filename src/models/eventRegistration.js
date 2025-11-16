// models/EventRegistration.js
import mongoose from "mongoose";

const eventRegistrationSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    teamName: { type: String, default: "" },
    members: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // optional extra members by id
        name: String,
        email: String,
      },
    ],
    registeredAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Prevent duplicate registration per (event, user)
eventRegistrationSchema.index({ event: 1, user: 1 }, { unique: true });

const EventRegistration = mongoose.model("EventRegistration", eventRegistrationSchema);
export default EventRegistration;

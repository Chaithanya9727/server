import Notification from "../models/Notification.js";
import { sendEmail } from "./sendEmail.js";

export const notify = async ({
  userId,
  email, // optional
  title,
  message,
  type = "system",
  meta = {},
  emailSubject,
  emailHtml,
}) => {
  try {
    // In-app notification
    if (userId) {
      await Notification.create({ user: userId, title, message, type, meta });
    }
    // Email (optional)
    if (email && emailSubject) {
      await sendEmail(email, emailSubject, message, emailHtml);
    }
  } catch (e) {
    console.error("Notify error:", e.message);
  }
};

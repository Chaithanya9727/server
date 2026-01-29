// src/utils/notifyUser.js
import Notification from "../models/Notification.js";
import { sendEmail } from "./sendEmail.js";

// ✅ Keep a reference to the global Socket.io instance
let globalIO = null;

/**
 * 🔌 Set Socket.io instance (called from socket.js)
 * Example:
 *   import { setSocketInstance } from "./utils/notifyUser.js";
 *   setSocketInstance(io);
 */
export const setSocketInstance = (ioInstance) => {
  globalIO = ioInstance;
  console.log("🔗 Global Socket.io instance linked to notifyUser.js");
};

/**
 * 🔔 Smart Universal Notification Utility
 * ---------------------------------------
 * Handles persistence, email, and real-time socket emission.
 */
export const notifyUser = async ({
  userId = null,
  email = null,
  title,
  message,
  link = "",
  type = "system",
  emailSubject = "Notification from OneStop Hub",
  emailHtml = "",
  broadcast = false,
  persist = true,
  emailEnabled = false,
  realtime = true,
}) => {
  try {
    let notificationDoc = null;

    // ✅ 1️⃣ Save notification in DB (optional)
    if (persist && userId) {
      notificationDoc = await Notification.create({
        user: userId,
        title,
        message,
        link,
        type,
        read: false,
      });
    }

    // ✅ 2️⃣ Send Email (optional)
    if (emailEnabled && email) {
      const html =
        emailHtml ||
        `
        <div style="font-family:'Segoe UI',sans-serif;padding:20px;">
          <h2 style="color:#6c63ff;">${title}</h2>
          <p style="font-size:1rem;color:#333;">${message}</p>
          ${
            link
              ? `<p><a href="${process.env.CLIENT_URL || process.env.FRONTEND_URL || 'https://onestopfrontend.vercel.app'}${link}" 
                  style="color:#6c63ff;text-decoration:none;">View on OneStop Hub →</a></p>`
              : ""
          }
          <hr style="border:none;border-top:1px solid #eee;margin-top:20px;" />
          <p style="font-size:0.8rem;color:#888;">This is an automated notification from OneStop Hub.</p>
        </div>
        `;

      await sendEmail(email, emailSubject, html, true);
      console.log(`📧 Email sent to ${email} — ${title}`);
    }

    // ✅ 3️⃣ Real-time socket emission (optional)
    if (realtime && globalIO) {
      const payload = {
        _id: notificationDoc?._id || Date.now().toString(),
        title,
        message,
        link,
        type,
        read: false,
        createdAt: new Date(),
      };

      if (broadcast) {
        globalIO.emit("notification:new", payload);
        console.log(`🌍 Broadcast notification: ${title}`);
      } else if (userId) {
        const targetRoom = userId.toString();
        globalIO.to(targetRoom).emit("notification:new", payload);
        console.log(`📢 Real-time notification sent to ${targetRoom}: ${title}`);
      }
    } else if (!globalIO && realtime) {
      console.warn("⚠️ Socket instance not initialized — notification not emitted in real-time");
    }

    return notificationDoc;
  } catch (err) {
    console.error("❌ notifyUser error:", err.message);
  }
};

/**
 * 🌍 Broadcast Helper
 * Send system-wide announcements (optional persistence).
 */
export const broadcastNotification = async ({
  title,
  message,
  link = "",
  type = "system",
  realtime = true,
  persist = false,
}) => {
  try {
    if (persist) {
      await Notification.create({
        user: null,
        title,
        message,
        link,
        type,
      });
    }

    if (realtime && globalIO) {
      const payload = {
        _id: Date.now().toString(),
        title,
        message,
        link,
        type,
        read: false,
        createdAt: new Date(),
      };
      globalIO.emit("notification:new", payload);
      console.log(`🌍 Broadcast notification emitted: ${title}`);
    } else if (!globalIO && realtime) {
      console.warn("⚠️ Socket instance not initialized — broadcast not emitted");
    }
  } catch (err) {
    console.error("❌ broadcastNotification error:", err.message);
  }
};
  
// src/socket.js
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import User from "./models/User.js";
import Conversation from "./models/Conversation.js";
import Message from "./models/Message.js";
import Notification from "./models/Notification.js";
import { setSocketInstance } from "./utils/notifyUser.js";

const activeUsers = new Map(); // userId -> socketId

export default function socketServer(httpServer) {
  const allowedOrigins = [
    "http://localhost:5173",
    "https://onestopfrontend.vercel.app",
    process.env.CLIENT_URL
  ].filter(Boolean);

  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    },
  });

  // ✅ Make socket globally accessible (for utils/notifyUser.js)
  setSocketInstance(io);

  /**
   * 🔐 Authenticate each socket via JWT before connection
   */
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("No token provided"));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (!user) return next(new Error("User not found"));

      socket.user = user;
      next();
    } catch (err) {
      next(new Error("Authentication error"));
    }
  });

  /**
   * ✅ Handle new connection
   */
  io.on("connection", (socket) => {
    const userId = socket.user._id.toString();
    activeUsers.set(userId, socket.id);

    console.log(`✅ ${socket.user.name} connected (${socket.user.role})`);
    io.emit("presence:update", { userId, online: true });

    // =====================================================
    // 🔔 REAL-TIME NOTIFICATIONS
    // =====================================================

    // Join personal room for user-specific notifications
    socket.join(userId);
    console.log(`🔔 User joined room: ${userId}`);

    // Listen for manual "notification:send" events (optional)
    socket.on("notification:send", async (data) => {
      try {
        const { to, title, message, link, type = "system" } = data;
        if (!to || !title || !message) return;

        const notif = await Notification.create({
          user: to,
          title,
          message,
          link,
          type,
          read: false,
        });

        const targetSocket = activeUsers.get(to);
        if (targetSocket) {
          io.to(targetSocket).emit("notification:new", notif);
        }

        console.log(`📨 Real-time notification sent to ${to}: ${title}`);
      } catch (err) {
        console.error("❌ Notification send failed:", err);
      }
    });

    // =====================================================
    // 💬 MESSAGING
    // =====================================================

    socket.on("message:send", async ({ conversationId, to, body }, cb) => {
      try {
        if (!conversationId || !to)
          return cb?.({ ok: false, error: "Missing recipient or conversation" });

        const msg = await Message.create({
          conversation: conversationId,
          from: userId,
          to,
          body,
          status: "sent",
        });

        await Conversation.findByIdAndUpdate(conversationId, {
          lastMessage: msg._id,
          lastMessageAt: new Date(),
        });

        const populated = await Message.findById(msg._id)
          .populate("from to", "name email avatar role")
          .lean();

        // 🎯 Emit to receiver
        const targetSocket = activeUsers.get(to);
        if (targetSocket) {
          io.to(targetSocket).emit("message:new", { message: populated });
          populated.status = "delivered";
          await Message.findByIdAndUpdate(msg._id, { status: "delivered" });
        }

        cb?.({ ok: true, message: populated });
      } catch (err) {
        console.error("💥 Send error:", err);
        cb?.({ ok: false, error: "Send failed" });
      }
    });

    // =====================================================
    // 🧹 DELETE MESSAGE
    // =====================================================

    socket.on("message:delete", async ({ messageId, mode }, cb) => {
      try {
        const msg = await Message.findById(messageId);
        if (!msg) return cb?.({ ok: false, error: "Message not found" });

        if (mode === "everyone") {
          if (msg.from.toString() !== userId)
            return cb?.({ ok: false, error: "Not allowed" });

          msg.body = "❌ Message deleted";
          await msg.save();

          const targetSocket = activeUsers.get(msg.to.toString());
          if (targetSocket) {
            io.to(targetSocket).emit("message:deleted", {
              messageId: msg._id,
              mode: "everyone",
            });
          }

          io.to(socket.id).emit("message:deleted", {
            messageId: msg._id,
            mode: "everyone",
          });

          cb?.({ ok: true });
        } else if (mode === "me") {
          if (!msg.deletedFor.includes(userId)) {
            msg.deletedFor.push(userId);
            await msg.save();
          }

          io.to(socket.id).emit("message:deleted", {
            messageId: msg._id,
            mode: "me",
          });

          cb?.({ ok: true });
        }
      } catch (err) {
        console.error("❌ Delete error:", err);
        cb?.({ ok: false, error: "Delete failed" });
      }
    });

    // =====================================================
    // ⌨️ TYPING INDICATOR
    // =====================================================

    socket.on("typing", ({ to, conversationId, typing }) => {
      const targetSocket = activeUsers.get(to);
      if (targetSocket) {
        io.to(targetSocket).emit("typing", {
          from: userId,
          conversationId,
          typing,
        });
      }
    });

    // =====================================================
    // 🧾 MESSAGE STATUS UPDATES
    // =====================================================

    socket.on("message:mark", async ({ messageId, status }) => {
      try {
        const msg = await Message.findById(messageId);
        if (msg && msg.to.toString() === userId) {
          msg.status = status;
          await msg.save();

          const fromSocket = activeUsers.get(msg.from.toString());
          if (fromSocket) {
            io.to(fromSocket).emit("message:update", {
              messageId: msg._id,
              status,
            });
          }
        }
      } catch (err) {
        console.error("❌ Message mark error:", err);
      }
    });

    // =====================================================
    // 🔌 DISCONNECT
    // =====================================================

    socket.on("disconnect", () => {
      activeUsers.delete(userId);
      io.emit("presence:update", { userId, online: false });
      console.log(`❌ ${socket.user.name} disconnected`);
    });
  });

  console.log("⚙️ Socket.io initialized ✅");
  return io;
}

export { activeUsers };

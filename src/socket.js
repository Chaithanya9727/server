import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import User from "./models/User.js";
import Conversation from "./models/Conversation.js";
import Message from "./models/Message.js";

const activeUsers = new Map();

export default function socketServer(httpServer) {
  // ✅ Allow both Netlify (production) and localhost (dev)
  const allowedOrigins = [
    "https://onestop-frontend.netlify.app",
    "http://localhost:5173",
  ];

  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
      methods: ["GET", "POST"],
    },
  });

  // ✅ Authenticate user with JWT token
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("No token"));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (!user) return next(new Error("User not found"));

      socket.user = user;
      next();
    } catch (err) {
      next(new Error("Authentication error"));
    }
  });

  // ✅ When user connects
  io.on("connection", (socket) => {
    const userId = socket.user._id.toString();
    activeUsers.set(userId, socket.id);
    console.log(`✅ User connected: ${socket.user.name}`);

    io.emit("presence:update", { userId, online: true });

    /**
     * ✅ Send message
     */
    socket.on("message:send", async ({ conversationId, to, body }, cb) => {
      try {
        if (!conversationId || !to)
          return cb?.({ ok: false, error: "Invalid recipient or conversation" });

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

        const populated = await Message.findById(msg._id).populate(
          "from to",
          "name email avatar"
        );

        const targetSocket = activeUsers.get(to);
        if (targetSocket) {
          io.to(targetSocket).emit("message:new", { message: populated });
          populated.status = "delivered";
          await populated.save();
        }

        cb?.({ ok: true, message: populated });
      } catch (err) {
        console.error("Send error:", err);
        cb?.({ ok: false, error: "Send failed" });
      }
    });

    /**
     * ✅ Delete message
     */
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
        console.error("Delete error:", err);
        cb?.({ ok: false, error: "Delete failed" });
      }
    });

    /**
     * ✅ Typing indicator
     */
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

    /**
     * ✅ Mark as seen/delivered
     */
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
        console.error("Message mark error:", err);
      }
    });

    /**
     * ✅ Handle disconnection
     */
    socket.on("disconnect", () => {
      activeUsers.delete(userId);
      io.emit("presence:update", { userId, online: false });
      console.log(`❌ User disconnected: ${socket.user.name}`);
    });
  });

  return io;
}

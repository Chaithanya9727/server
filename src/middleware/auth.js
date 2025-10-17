// src/middleware/auth.js
import jwt from "jsonwebtoken";
import User from "../models/User.js";

/* =====================================================
   🔒 JWT Authentication Middleware
===================================================== */
export const protect = async (req, res, next) => {
  try {
    let token;

    // Extract Bearer token
    if (req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({ message: "Not authorized, token missing" });
    }

    // Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || !decoded.id) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    // Find user and attach to request
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(401).json({ message: "User not found or removed" });
    }

    // Enrich request with user and request context
    req.user = user;
    req.requestContext = {
      ip: req.headers["x-forwarded-for"] || req.connection.remoteAddress,
      userAgent: req.headers["user-agent"] || "",
    };

    next();
  } catch (err) {
    console.error("🔐 Auth Error:", err.message);
    res.status(401).json({ message: "Not authorized, token invalid" });
  }
};

/* =====================================================
   🛡️ Role-based Access Middleware
   Usage: authorize("admin", "mentor")
===================================================== */
export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const userRole = req.user.role?.toLowerCase();

      // Always allow SuperAdmin to bypass
      if (userRole === "superadmin") return next();

      if (!allowedRoles.map((r) => r.toLowerCase()).includes(userRole)) {
        console.warn(
          `🚫 Unauthorized Access: "${userRole}" tried to access "${req.originalUrl}"`
        );
        return res.status(403).json({
          message: `Access denied: ${userRole} not permitted`,
        });
      }

      next();
    } catch (error) {
      console.error("authorize error:", error.message);
      res.status(403).json({ message: "Access denied" });
    }
  };
};

/* =====================================================
   🎓 Mentor-only Shortcut
===================================================== */
export const isMentor = (req, res, next) => {
  if (
    req.user &&
    (req.user.role === "mentor" || req.user.role === "superadmin")
  ) {
    return next();
  } else {
    return res.status(403).json({ message: "Access denied: Mentor only" });
  }
};

/* =====================================================
   👑 Admin-only Shortcut
===================================================== */
export const isAdmin = (req, res, next) => {
  if (
    req.user &&
    (req.user.role === "admin" || req.user.role === "superadmin")
  ) {
    return next();
  } else {
    return res.status(403).json({ message: "Access denied: Admin only" });
  }
};

/* =====================================================
   🧩 SuperAdmin-only Shortcut
===================================================== */
export const isSuperAdmin = (req, res, next) => {
  if (req.user && req.user.role === "superadmin") {
    return next();
  } else {
    return res.status(403).json({ message: "Access denied: SuperAdmin only" });
  }
};

/* =====================================================
   ✅ Compatibility Export
===================================================== */
export const authMiddleware = protect;

import jwt from "jsonwebtoken";
import User from "../models/User.js";

/* =====================================================
 🔒 Protect route (requires valid token)
===================================================== */
export const protect = async (req, res, next) => {
  try {
    let token;

    // ✅ Extract Bearer token
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({ message: "Not authorized, no token" });
    }

    // ✅ Verify token with secret key
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ Attach user to request
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error("🔐 Auth error:", err.message);
    res.status(401).json({ message: "Not authorized, token failed" });
  }
};

/* =====================================================
 🛡️ Role-based authorization middleware
 Example: authorize("admin", "superadmin")
===================================================== */
export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const userRole = req.user.role?.toLowerCase();

      // ✅ Always allow superadmin to bypass all role restrictions
      if (userRole === "superadmin") {
        return next();
      }

      // ✅ If role not in allowed list, block access
      if (!allowedRoles.map((r) => r.toLowerCase()).includes(userRole)) {
        return res.status(403).json({
          message: `Access denied: ${userRole} role not permitted`,
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
 👑 SuperAdmin check middleware
 Use this on routes that only SuperAdmin can access
===================================================== */
export const isSuperAdmin = (req, res, next) => {
  if (req.user && req.user.role === "superadmin") {
    return next();
  } else {
    return res.status(403).json({ message: "Access denied: SuperAdmin only" });
  }
};

/* =====================================================
 🧩 Simple Admin-only middleware (still supported)
===================================================== */
export const isAdmin = (req, res, next) => {
  if (req.user && (req.user.role === "admin" || req.user.role === "superadmin")) {
    // ✅ superadmin also allowed wherever admin has access
    next();
  } else {
    res.status(403).json({ message: "Access denied: Admins only" });
  }
};

/* =====================================================
 ✅ Alias for backward compatibility
===================================================== */
export const authMiddleware = protect;

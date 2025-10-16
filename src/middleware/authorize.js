// middleware/authorize.js

export const authorize = (roles = []) => {
  return (req, res, next) => {
    try {
      // ✅ Must have a user object (from protect middleware)
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const userRole = req.user.role?.toLowerCase();
      const allowedRoles = roles.map((r) => r.toLowerCase());

      // ✅ SuperAdmin always has full unrestricted access
      if (userRole === "superadmin") {
        return next();
      }

      // ✅ Allow if role is in allowed list
      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({
          message: `Forbidden: ${userRole} not permitted to perform this action`,
        });
      }

      next();
    } catch (error) {
      console.error("Authorize middleware error:", error);
      res.status(500).json({ message: "Server authorization error" });
    }
  };
};

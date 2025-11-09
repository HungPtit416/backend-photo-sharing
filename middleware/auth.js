const jwt = require("jsonwebtoken");
const User = require("../db/userModel");

// Middleware to check if user is authenticated with JWT
async function requireAuth(req, res, next) {
  // Skip authentication for login/logout/register routes
  if (
    req.path === "/admin/login" ||
    req.path === "/admin/logout" ||
    req.path === "/"
  ) {
    return next();
  }

  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ error: "Unauthorized - No token provided" });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // ============= CHECK TOKEN BLACKLIST =============
    // Check if token has been blacklisted (user logged out)
    if (typeof global.isTokenBlacklisted === "function") {
      if (global.isTokenBlacklisted(token)) {
        return res
          .status(401)
          .json({
            error: "Unauthorized - Token has been invalidated (logged out)",
          });
      }
    }

    // Verify token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "long-and-random-secret-key-B22DCCN416"
    );

    // Get user from database to ensure user still exists
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized - User not found" });
    }

    // Add user info to request object
    req.user_id = decoded.userId;
    req.user = user;

    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Unauthorized - Invalid token" });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Unauthorized - Token expired" });
    }

    console.error("Auth middleware error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

module.exports = requireAuth;

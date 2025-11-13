const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../db/userModel");
const router = express.Router();

// Helper function to generate JWT token
function generateToken(userId) {
  return jwt.sign(
    { userId: userId },
    process.env.JWT_SECRET || "long-and-random-secret-key-B22DCCN416",
    { expiresIn: "24h" } // Token expires in 24 hours
  );
}

// POST /admin/login - Login a user with password
router.post("/login", async (req, res) => {
  try {
    const { login_name, password } = req.body;

    // Check if login_name and password are provided
    if (!login_name) {
      return res.status(400).json({ error: "Login name is required" });
    }

    if (!password) {
      return res.status(400).json({ error: "Password is required" });
    }

    // Find user by login_name
    const user = await User.findOne({ login_name: login_name });

    if (!user) {
      return res.status(400).json({ error: "Invalid login name" });
    }

    // Check password (simple string comparison for now)
    if (user.password !== password) {
      return res.status(400).json({ error: "Invalid password" });
    }

    // Generate JWT token
    const token = generateToken(user._id);

    // Return user info and token
    res.status(200).json({
      token: token,
      user: {
        _id: user._id,
        first_name: user.first_name,
        last_name: user.last_name,
        login_name: user.login_name,
        location: user.location,
        description: user.description,
        occupation: user.occupation,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /admin/current - Get current logged in user
router.get("/current", async (req, res) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Not logged in" });
    }

    const token = authHeader.substring(7);

    try {
      // Verify token
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "long-and-random-secret-key-B22DCCN416"
      );

      // Get user details
      const user = await User.findById(decoded.userId);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Return user info (excluding sensitive data)
      res.status(200).json({
        _id: user._id,
        first_name: user.first_name,
        last_name: user.last_name,
        login_name: user.login_name,
        location: user.location,
        description: user.description,
        occupation: user.occupation,
      });
    } catch (tokenError) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
  } catch (error) {
    console.error("Get current user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /admin/logout - Logout a user
router.post("/logout", async (req, res) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);

      try {
        // Verify token to get userId
        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET || "long-and-random-secret-key-B22DCCN416"
        );

        // ============= ADD TOKEN TO BLACKLIST =============
        if (typeof global.blacklistToken === "function") {
          global.blacklistToken(token);
          console.log(`Token blacklisted for user: ${decoded.userId}`);
        }

        // ============= DISCONNECT ALL USER'S WEBSOCKETS =============
        if (typeof global.disconnectUserWebSockets === "function") {
          global.disconnectUserWebSockets(decoded.userId.toString());
          console.log(
            `Disconnected all WebSockets for user: ${decoded.userId}`
          );
        }
      } catch (tokenError) {
        // Token invalid or expired, but still allow logout
        console.log("Logout with invalid token, allowing anyway");
      }
    }

    res.status(200).json({ message: "Successfully logged out" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/change-password", async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ error: "Unauthorized - No token provided" });
    }

    const token = authHeader.substring(7);

    try {
      // Verify token
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "long-and-random-secret-key-B22DCCN416"
      );

      // Get user details
      const user = await User.findById(decoded.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Validate input
      if (!current_password || !new_password) {
        return res.status(400).json({
          error: "Current and new passwords are required",
        });
      }

      if (new_password.trim().length < 6) {
        return res.status(400).json({
          error: "New password must be at least 6 characters long",
        });
      }

      // Verify current password
      if (current_password !== user.password) {
        return res.status(400).json({ error: "Current password is incorrect" });
      }

      // Update password
      user.password = new_password;
      await user.save();

      res.status(200).json({ message: "Password changed successfully" });
    } catch (tokenError) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;

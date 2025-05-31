const express = require("express");
const User = require("../db/userModel");
const router = express.Router();

// POST /admin/login - Login a user
router.post("/login", async (req, res) => {
  try {
    const { login_name } = req.body;

    // Check if login_name is provided
    if (!login_name) {
      return res.status(400).json({ error: "Login name is required" });
    }

    // Find user by login_name
    const user = await User.findOne({ login_name: login_name });

    if (!user) {
      return res.status(400).json({ error: "Invalid login name" });
    }

    // Store user info in session
    req.session.user_id = user._id;
    req.session.user = {
      _id: user._id,
      last_name: user.last_name,
    };

    // Return user info (excluding sensitive data)
    res.status(200).json({
      _id: user._id,
      last_name: user.last_name,
      location: user.location,
      description: user.description,
      occupation: user.occupation,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /admin/current - Get current logged in user
router.get("/current", async (req, res) => {
  try {
    // Check if user is logged in
    if (!req.session.user_id) {
      return res.status(401).json({ error: "Not logged in" });
    }

    // Get user details
    const user = await User.findById(req.session.user_id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Return user info (excluding sensitive data)
    res.status(200).json({
      _id: user._id,
      last_name: user.last_name,
      location: user.location,
      description: user.description,
      occupation: user.occupation,
    });
  } catch (error) {
    console.error("Get current user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /admin/logout - Logout a user
router.post("/logout", (req, res) => {
  try {
    // Check if user is logged in
    if (!req.session.user_id) {
      return res.status(400).json({ error: "No user is currently logged in" });
    }

    // Clear session
    req.session.destroy((err) => {
      if (err) {
        console.error("Session destroy error:", err);
        return res.status(500).json({ error: "Could not log out" });
      }

      res.status(200).json({ message: "Successfully logged out" });
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;

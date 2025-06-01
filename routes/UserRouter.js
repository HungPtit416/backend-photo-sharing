const express = require("express");
const User = require("../db/userModel");
const router = express.Router();

// POST /user - Register a new user (this route should be accessible without auth)
router.post("/", async (req, res) => {
  try {
    const {
      login_name,
      password,
      first_name,
      last_name,
      location,
      description,
      occupation,
    } = req.body;

    // Validate required fields for NEW registrations only
    if (!login_name || login_name.trim() === "") {
      return res.status(400).send("Login name is required and cannot be empty");
    }

    if (!password || password.trim() === "") {
      return res.status(400).send("Password is required and cannot be empty");
    }

    if (!first_name || first_name.trim() === "") {
      return res.status(400).send("First name is required and cannot be empty");
    }

    if (!last_name || last_name.trim() === "") {
      return res.status(400).send("Last name is required and cannot be empty");
    }

    // Check if login_name already exists
    const existingUser = await User.findOne({ login_name: login_name.trim() });
    if (existingUser) {
      return res.status(400).send("Login name already exists");
    }

    // Create new user
    const newUser = new User({
      login_name: login_name.trim(),
      password: password, // In production, you should hash this password
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      location: location ? location.trim() : "",
      description: description ? description.trim() : "",
      occupation: occupation ? occupation.trim() : "",
    });

    // Save user to database
    const savedUser = await newUser.save();

    // Return user info (excluding password)
    res.status(201).json({
      _id: savedUser._id,
      login_name: savedUser.login_name,
      first_name: savedUser.first_name,
      last_name: savedUser.last_name,
      location: savedUser.location,
      description: savedUser.description,
      occupation: savedUser.occupation,
    });
  } catch (error) {
    console.error("Registration error:", error);

    // Handle mongoose validation errors
    if (error.name === "ValidationError") {
      return res.status(400).send("Validation error: " + error.message);
    }

    // Handle duplicate key error (unique constraint)
    if (error.code === 11000) {
      return res.status(400).send("Login name already exists");
    }

    res.status(500).send("Internal server error");
  }
});

router.get("/list", async (request, response) => {
  try {
    const users = await User.find({}, "_id first_name last_name");
    response.json(users);
  } catch (error) {
    response.status(500).json({ message: error.message });
  }
});

router.get("/:id", async (request, response) => {
  try {
    const user = await User.findById(
      request.params.id,
      "_id first_name last_name location description occupation"
    );

    if (!user) {
      return response.status(400).json({ message: "User not found" });
    }

    response.json(user);
  } catch (error) {
    response.status(500).json({ message: error.message });
  }
});

module.exports = router;

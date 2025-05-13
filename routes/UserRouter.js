const express = require("express");
const User = require("../db/userModel");
const router = express.Router();

router.post("/", async (request, response) => {});

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

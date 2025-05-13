const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Photo = require("../db/photoModel");
const User = require("../db/userModel");

router.get("/photosOfUser/:id", async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).send({ message: "Invalid user ID format." });
  }

  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(400).send({ message: "User not found." });
    }

    const photos = await Photo.find({ user_id: id }).lean();

    const result = await Promise.all(
      photos.map(async (photo) => {
        const comments = await Promise.all(
          photo.comments.map(async (c) => {
            const u = await User.findById(
              c.user_id,
              "_id first_name last_name"
            ).lean();
            return {
              _id: c._id,
              comment: c.comment,
              date_time: c.date_time,
              user: u,
            };
          })
        );

        return {
          _id: photo._id,
          user_id: photo.user_id,
          file_name: photo.file_name,
          date_time: photo.date_time,
          comments,
        };
      })
    );

    res.send(result);
  } catch (err) {
    console.error("Error in /photosOfUser/:id:", err);
    res.status(500).send({ message: "Internal server error." });
  }
});

module.exports = router;

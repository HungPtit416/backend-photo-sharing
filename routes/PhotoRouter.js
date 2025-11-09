const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Photo = require("../db/photoModel");
const User = require("../db/userModel");
const { broadcast } = require("../realtime/sseManager");
// Cấu hình multer để upload file
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, "../images");

    // Tạo thư mục images nếu chưa có
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Tạo tên file unique: timestamp + random + extension
    const uniqueName =
      Date.now() +
      "-" +
      Math.round(Math.random() * 1e9) +
      path.extname(file.originalname);
    cb(null, uniqueName);
  },
});

// Kiểm tra file type (chỉ cho phép ảnh)
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed!"), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // Giới hạn 5MB
  },
});

// Route upload ảnh mới
router.post("/photos/new", upload.single("photo"), async (req, res) => {
  try {
    // Kiểm tra user đã login chưa (JWT authentication đã được xử lý bởi middleware)
    if (!req.user_id) {
      return res.status(401).json({ error: "Unauthorized - Please log in" });
    }

    // Kiểm tra có file được upload không
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // User đã được verify bởi middleware, không cần check lại
    // Tạo Photo object mới
    const newPhoto = new Photo({
      file_name: req.file.filename,
      url: `/images/${req.file.filename}`,
      date_time: new Date(),
      user_id: req.user_id, // Sử dụng user_id từ JWT token
      comments: [],
    });

    // Lưu vào database
    const savedPhoto = await newPhoto.save();

    broadcast("new-photo", savedPhoto);

    res.status(201).json({
      message: "Photo uploaded successfully",
      photo: {
        _id: savedPhoto._id,
        file_name: savedPhoto.file_name,
        url: `/images/${savedPhoto.file_name}`,
        date_time: savedPhoto.date_time,
        user_id: savedPhoto.user_id,
        comments: [],
      },
    });
  } catch (error) {
    console.error("Error uploading photo:", error);

    // Nếu có lỗi, xóa file đã upload (nếu có)
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error("Error deleting file:", err);
      });
    }

    res.status(500).json({ error: "Internal server error" });
  }
});

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
          likesCount: photo.likes ? photo.likes.length : 0,
          liked:
            req.user_id && photo.likes
              ? photo.likes.some(
                  (like) => like.toString() === req.user_id.toString()
                )
              : false,
        };
      })
    );

    res.send(result);
  } catch (err) {
    console.error("Error in /photosOfUser/:id:", err);
    res.status(500).send({ message: "Internal server error." });
  }
});

router.delete("/photos/:photo_id", async (req, res) => {
  const { photo_id } = req.params;

  // Check if user is authenticated
  if (!req.user_id) {
    return res.status(401).json({ error: "Unauthorized - Please log in" });
  }

  if (!mongoose.Types.ObjectId.isValid(photo_id)) {
    return res.status(400).json({ error: "Invalid photo ID format" });
  }

  try {
    const photo = await Photo.findById(photo_id);
    if (!photo) {
      return res.status(404).json({ error: "Photo not found" });
    }

    if (photo.user_id.toString() !== req.user_id) {
      return res
        .status(403)
        .json({ error: "You can only delete your own photos" });
    }

    const filePath = path.join(__dirname, "../images", photo.file_name);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await Photo.findByIdAndDelete(photo_id);

    res.status(200).json({ message: "Photo deleted successfully" });
  } catch (err) {
    console.error("Error deleting photo:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/commentsOfPhoto/:photo_id", async (req, res) => {
  const { photo_id } = req.params;
  const { comment } = req.body;

  if (!req.user_id) {
    return res.status(401).json({ error: "Unauthorized - Please log in" });
  }

  if (!mongoose.Types.ObjectId.isValid(photo_id)) {
    return res.status(400).json({ error: "Invalid photo ID format" });
  }

  if (!comment || typeof comment !== "string" || comment.trim() === "") {
    return res.status(400).json({ error: "Comment cannot be empty" });
  }

  try {
    // Check if photo exists
    const photo = await Photo.findById(photo_id);
    if (!photo) {
      return res.status(404).json({ error: "Photo not found" });
    }

    // User đã được verify bởi middleware, sử dụng req.user thay vì query lại
    const user = req.user;

    const newComment = {
      comment: comment.trim(),
      date_time: new Date(),
      user_id: req.user_id,
    };

    photo.comments.push(newComment);
    await photo.save();

    const addedComment = photo.comments[photo.comments.length - 1];
    const commentWithUser = {
      _id: addedComment._id,
      comment: addedComment.comment,
      date_time: addedComment.date_time,
      user: {
        _id: user._id,
        first_name: user.first_name,
        last_name: user.last_name,
      },
    };

    res.status(201).json({
      message: "Comment added successfully",
      comment: commentWithUser,
    });
  } catch (err) {
    console.error("Error in /commentsOfPhoto/:photo_id:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/commentsOfPhoto/:photo_id/:comment_id", async (req, res) => {
  const { photo_id, comment_id } = req.params;
  const { comment } = req.body;
  if (!req.user_id) {
    return res.status(401).json({ error: "Please log in" });
  }
  if (!mongoose.Types.ObjectId.isValid(photo_id)) {
    return res.status(400).json({ error: "Invalid format" });
  }
  if (!comment || typeof comment !== "string" || comment.trim() === "") {
    return res.status(400).json({ error: "Comment cannot be empty" });
  }
  try {
    const photo = await Photo.findById(photo_id);
    if (!photo) {
      return res.status(404).json({ error: "Photo not found" });
    }

    const commentToEdit = photo.comments.id(comment_id);
    if (!commentToEdit) {
      return res.status(404).json({ error: "Comment not found" });
    }

    if (commentToEdit.user_id.toString() !== req.user_id) {
      return res.status(403).json({ error: "You can only edit your comments" });
    }

    commentToEdit.comment = comment.trim();
    commentToEdit.date_time = new Date();
    await photo.save();

    const user = req.user;

    const updatedComment = {
      _id: commentToEdit._id,
      comment: commentToEdit.comment,
      date_time: commentToEdit.date_time,
      user: {
        _id: user._id,
        first_name: user.first_name,
        last_name: user.last_name,
      },
    };
    res.status(200).json({
      message: "Comment updated successfully",
      comment: updatedComment,
    });
  } catch (err) {
    console.error("Error in /commentsOfPhoto/:photo_id/:comment_id:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
module.exports = router;

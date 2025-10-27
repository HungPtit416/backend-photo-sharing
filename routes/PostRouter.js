const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Post = require("../db/postModel");
const User = require("../db/userModel");

// CREATE - Tạo post mới
router.post("/posts", async (req, res) => {
  try {
    // Kiểm tra user đã login chưa
    if (!req.user_id) {
      return res.status(401).json({ error: "Unauthorized - Please log in" });
    }

    const { title, content, tags, status } = req.body;

    // Validate input
    if (!title || !content) {
      return res.status(400).json({ error: "Title and content are required" });
    }

    if (title.trim() === "" || content.trim() === "") {
      return res
        .status(400)
        .json({ error: "Title and content cannot be empty" });
    }

    // Tạo Post object mới
    const newPost = new Post({
      title: title.trim(),
      content: content.trim(),
      user_id: req.user_id,
      tags: tags || [],
      status: status || "published",
      comments: [],
      likes: [],
    });

    // Lưu vào database
    const savedPost = await newPost.save();

    // Populate user info
    const postWithUser = await Post.findById(savedPost._id)
      .populate("user_id", "_id first_name last_name")
      .lean();

    res.status(201).json({
      message: "Post created successfully",
      post: {
        ...postWithUser,
        likesCount: 0,
        liked: false,
        commentsCount: 0,
      },
    });
  } catch (error) {
    console.error("Error creating post:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// READ - Lấy tất cả posts
router.get("/posts", async (req, res) => {
  try {
    const { page = 1, limit = 10, status = "published" } = req.query;
    const skip = (page - 1) * limit;

    const posts = await Post.find({ status })
      .populate("user_id", "_id first_name last_name")
      .sort({ date_time: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const result = posts.map((post) => ({
      ...post,
      likesCount: post.likes ? post.likes.length : 0,
      liked:
        req.user_id && post.likes
          ? post.likes.some(
              (like) => like.toString() === req.user_id.toString()
            )
          : false,
      commentsCount: post.comments ? post.comments.length : 0,
    }));

    const total = await Post.countDocuments({ status });

    res.json({
      posts: result,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (error) {
    console.error("Error fetching posts:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// READ - Lấy post theo ID
router.get("/posts/:post_id", async (req, res) => {
  const { post_id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(post_id)) {
    return res.status(400).json({ error: "Invalid post ID format" });
  }

  try {
    const post = await Post.findById(post_id)
      .populate("user_id", "_id first_name last_name")
      .lean();

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    // Populate comment users
    const comments = await Promise.all(
      post.comments.map(async (comment) => {
        const user = await User.findById(
          comment.user_id,
          "_id first_name last_name"
        ).lean();
        return {
          _id: comment._id,
          comment: comment.comment,
          date_time: comment.date_time,
          user,
        };
      })
    );

    const result = {
      ...post,
      comments,
      likesCount: post.likes ? post.likes.length : 0,
      liked:
        req.user_id && post.likes
          ? post.likes.some(
              (like) => like.toString() === req.user_id.toString()
            )
          : false,
      commentsCount: comments.length,
    };

    res.json(result);
  } catch (error) {
    console.error("Error fetching post:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// READ - Lấy posts của user
router.get("/postsOfUser/:user_id", async (req, res) => {
  const { user_id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(user_id)) {
    return res.status(400).json({ error: "Invalid user ID format" });
  }

  try {
    const user = await User.findById(user_id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const posts = await Post.find({ user_id })
      .populate("user_id", "_id first_name last_name")
      .sort({ date_time: -1 })
      .lean();

    const result = posts.map((post) => ({
      ...post,
      likesCount: post.likes ? post.likes.length : 0,
      liked:
        req.user_id && post.likes
          ? post.likes.some(
              (like) => like.toString() === req.user_id.toString()
            )
          : false,
      commentsCount: post.comments ? post.comments.length : 0,
    }));

    res.json(result);
  } catch (error) {
    console.error("Error fetching user posts:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// UPDATE - Cập nhật post
router.patch("/posts/:post_id", async (req, res) => {
  const { post_id } = req.params;
  const { title, content, tags, status } = req.body;

  if (!req.user_id) {
    return res.status(401).json({ error: "Unauthorized - Please log in" });
  }

  if (!mongoose.Types.ObjectId.isValid(post_id)) {
    return res.status(400).json({ error: "Invalid post ID format" });
  }

  try {
    const post = await Post.findById(post_id);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    // Check if current user is the owner of the post
    if (post.user_id.toString() !== req.user_id) {
      return res
        .status(403)
        .json({ error: "You can only edit your own posts" });
    }

    // Update fields if provided
    if (title !== undefined) {
      if (!title || title.trim() === "") {
        return res.status(400).json({ error: "Title cannot be empty" });
      }
      post.title = title.trim();
    }

    if (content !== undefined) {
      if (!content || content.trim() === "") {
        return res.status(400).json({ error: "Content cannot be empty" });
      }
      post.content = content.trim();
    }

    if (tags !== undefined) {
      post.tags = tags;
    }

    if (status !== undefined) {
      if (!["draft", "published", "archived"].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      post.status = status;
    }

    await post.save();

    const updatedPost = await Post.findById(post_id)
      .populate("user_id", "_id first_name last_name")
      .lean();

    res.json({
      message: "Post updated successfully",
      post: {
        ...updatedPost,
        likesCount: updatedPost.likes ? updatedPost.likes.length : 0,
        liked:
          req.user_id && updatedPost.likes
            ? updatedPost.likes.some(
                (like) => like.toString() === req.user_id.toString()
              )
            : false,
        commentsCount: updatedPost.comments ? updatedPost.comments.length : 0,
      },
    });
  } catch (error) {
    console.error("Error updating post:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE - Xóa post
router.delete("/posts/:post_id", async (req, res) => {
  const { post_id } = req.params;

  if (!req.user_id) {
    return res.status(401).json({ error: "Unauthorized - Please log in" });
  }

  if (!mongoose.Types.ObjectId.isValid(post_id)) {
    return res.status(400).json({ error: "Invalid post ID format" });
  }

  try {
    const post = await Post.findById(post_id);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    // Check if current user is the owner of the post
    if (post.user_id.toString() !== req.user_id) {
      return res
        .status(403)
        .json({ error: "You can only delete your own posts" });
    }

    await Post.findByIdAndDelete(post_id);

    res.json({ message: "Post deleted successfully" });
  } catch (error) {
    console.error("Error deleting post:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// LIKE/UNLIKE post
router.post("/posts/:post_id/like", async (req, res) => {
  const { post_id } = req.params;

  if (!req.user_id) {
    return res.status(401).json({ error: "Unauthorized - Please log in" });
  }

  if (!mongoose.Types.ObjectId.isValid(post_id)) {
    return res.status(400).json({ error: "Invalid post ID format" });
  }

  try {
    const post = await Post.findById(post_id);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    const userLikedIndex = post.likes.indexOf(req.user_id);

    if (userLikedIndex > -1) {
      // User đã like, bỏ like
      post.likes.splice(userLikedIndex, 1);
      await post.save();
      res.json({
        message: "Post unliked",
        liked: false,
        likesCount: post.likes.length,
      });
    } else {
      // User chưa like, thêm like
      post.likes.push(req.user_id);
      await post.save();
      res.json({
        message: "Post liked",
        liked: true,
        likesCount: post.likes.length,
      });
    }
  } catch (error) {
    console.error("Error in like/unlike post:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// COMMENTS - Thêm comment vào post
router.post("/posts/:post_id/comments", async (req, res) => {
  const { post_id } = req.params;
  const { comment } = req.body;

  if (!req.user_id) {
    return res.status(401).json({ error: "Unauthorized - Please log in" });
  }

  if (!mongoose.Types.ObjectId.isValid(post_id)) {
    return res.status(400).json({ error: "Invalid post ID format" });
  }

  if (!comment || typeof comment !== "string" || comment.trim() === "") {
    return res.status(400).json({ error: "Comment cannot be empty" });
  }

  try {
    const post = await Post.findById(post_id);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    const newComment = {
      comment: comment.trim(),
      date_time: new Date(),
      user_id: req.user_id,
    };

    post.comments.push(newComment);
    await post.save();

    // Get the newly added comment with user info
    const addedComment = post.comments[post.comments.length - 1];
    const user = req.user; // From auth middleware

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
  } catch (error) {
    console.error("Error adding comment to post:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// COMMENTS - Cập nhật comment
router.patch("/posts/:post_id/comments/:comment_id", async (req, res) => {
  const { post_id, comment_id } = req.params;
  const { comment } = req.body;

  if (!req.user_id) {
    return res.status(401).json({ error: "Unauthorized - Please log in" });
  }

  if (!mongoose.Types.ObjectId.isValid(post_id)) {
    return res.status(400).json({ error: "Invalid post ID format" });
  }

  if (!comment || typeof comment !== "string" || comment.trim() === "") {
    return res.status(400).json({ error: "Comment cannot be empty" });
  }

  try {
    const post = await Post.findById(post_id);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    const commentToEdit = post.comments.id(comment_id);
    if (!commentToEdit) {
      return res.status(404).json({ error: "Comment not found" });
    }

    if (commentToEdit.user_id.toString() !== req.user_id) {
      return res
        .status(403)
        .json({ error: "You can only edit your own comments" });
    }

    commentToEdit.comment = comment.trim();
    commentToEdit.date_time = new Date();
    await post.save();

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

    res.json({
      message: "Comment updated successfully",
      comment: updatedComment,
    });
  } catch (error) {
    console.error("Error updating comment:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// COMMENTS - Xóa comment
router.delete("/posts/:post_id/comments/:comment_id", async (req, res) => {
  const { post_id, comment_id } = req.params;

  if (!req.user_id) {
    return res.status(401).json({ error: "Unauthorized - Please log in" });
  }

  if (!mongoose.Types.ObjectId.isValid(post_id)) {
    return res.status(400).json({ error: "Invalid post ID format" });
  }

  try {
    const post = await Post.findById(post_id);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    const commentToDelete = post.comments.id(comment_id);
    if (!commentToDelete) {
      return res.status(404).json({ error: "Comment not found" });
    }

    if (commentToDelete.user_id.toString() !== req.user_id) {
      return res
        .status(403)
        .json({ error: "You can only delete your own comments" });
    }

    commentToDelete.deleteOne();
    await post.save();

    res.json({ message: "Comment deleted successfully" });
  } catch (error) {
    console.error("Error deleting comment:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;

const mongoose = require("mongoose");

/**
 * Define the Mongoose Schema for a Comment on Post.
 */
const postCommentSchema = new mongoose.Schema({
  // The text of the comment.
  comment: String,
  // The date and time when the comment was created.
  date_time: { type: Date, default: Date.now },
  // The ID of the user who created the comment.
  user_id: mongoose.Schema.Types.ObjectId,
});

/**
 * Define the Mongoose Schema for a Post.
 */
const postSchema = new mongoose.Schema({
  // Title of the post
  title: {
    type: String,
    required: true,
  },
  // Content/body of the post
  content: {
    type: String,
    required: true,
  },
  // The date and time when the post was added to the database.
  date_time: { type: Date, default: Date.now },
  // The ID of the user who created the post.
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "Users",
  },
  // Array of comment objects representing the comments made on this post.
  comments: [postCommentSchema],
  // Array of user IDs who liked this post
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Users" }],
  // Optional: tags for categorizing posts
  tags: [String],
  // Optional: post status (draft, published, archived)
  status: {
    type: String,
    enum: ["draft", "published", "archived"],
    default: "published",
  },
});

/**
 * Create a Mongoose Model for a Post using the postSchema.
 */
const Post = mongoose.model.Posts || mongoose.model("Posts", postSchema);

/**
 * Make this available to our application.
 */
module.exports = Post;

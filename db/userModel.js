const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  first_name: {
    type: String,
    // Not required to support existing users
  },
  last_name: {
    type: String,
    // Not required to support existing users
  },
  location: { type: String },
  description: { type: String },
  occupation: { type: String },
  login_name: {
    type: String,
    required: true,
    unique: true, // Ensure login names are unique
  },
  password: {
    type: String,
    required: true, // Add password field
  },
});

module.exports = mongoose.model.Users || mongoose.model("Users", userSchema);

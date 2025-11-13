const mongoose = require('mongoose');

const lastMessageSchema = new mongoose.Schema({
  content: String,
  sender_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Users' },
  date_time: Date,
}, { _id: false });

const chatSchema = new mongoose.Schema({
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Users', required: true }],
  chat_type: { type: String, enum: ['private'], default: 'private' },
  private_key: { type: String, unique: true, index: true, sparse: true },
  last_message: lastMessageSchema,
}, { timestamps: true });

module.exports = mongoose.models.Chat || mongoose.model('Chat', chatSchema);

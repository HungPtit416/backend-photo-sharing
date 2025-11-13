const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  chat_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true, index: true },
  content: { type: String, required: true, trim: true },
  sender_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Users', required: true },
  date_time: { type: Date, default: Date.now },
  is_read_by: [{ user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Users' }, read_at: Date }],
}, { timestamps: true });

messageSchema.index({ chat_id: 1, date_time: -1 });

module.exports = mongoose.models.Message || mongoose.model('Message', messageSchema);
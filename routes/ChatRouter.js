const express = require("express");
const router = express.Router();
const User = require("../db/userModel");
const Chat = require("../db/chatModel");
const Message = require("../db/messageModel");

// 1. Lấy danh sách tất cả users để có thể chat
router.get("/users", async (req, res) => {
  try {
    const currentUserId = req.user._id;
    
    // Lấy tất cả user trừ user hiện tại
    const users = await User.find(
      { _id: { $ne: currentUserId } },
      { _id: 1, login_name: 1, first_name: 1, last_name: 1 }
    ).limit(50);

    res.json({
      success: true,
      users: users
    });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ error: "Failed to get users" });
  }
});

// 2. Tạo hoặc tìm chat với 1 user
router.post("/start", async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const currentUserId = req.user._id;

    if (!targetUserId) {
      return res.status(400).json({ error: "Target user ID required" });
    }

    // Kiểm tra target user có tồn tại không
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ error: "Target user not found" });
    }

    // Tạo private_key để tìm chat (sắp xếp userId để đảm bảo unique)
    const sortedIds = [currentUserId.toString(), targetUserId].sort();
    const privateKey = `${sortedIds[0]}_${sortedIds[1]}`;
    
    // Tìm chat đã tồn tại
    let existingChat = await Chat.findOne({ private_key: privateKey })
      .populate("members", "first_name last_name");

    if (existingChat) {
      return res.json({
        success: true,
        chat: existingChat,
        isNew: false
      });
    }
    // Tạo chat mới
    const newChat = new Chat({
      members: [currentUserId, targetUserId],
      chat_type: "private",
      private_key: privateKey
    });
    
    await newChat.save();
    await newChat.populate("members", "login_name first_name last_name");
    
    res.status(200).json({
      success: true,
      chat: newChat,
      isNew: true
    });
  } catch (error) {
    console.error("Start chat error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 3. Lấy danh sách chats của user hiện tại
router.get("/list", async (req, res) => {
  try {
    const userId = req.user._id;
    
    const chats = await Chat.find({ members: userId })
      .populate("members", "login_name first_name last_name")
      .sort({ updatedAt: -1 });

    // Thêm thông tin về user kia và tin nhắn cuối
    const chatDetails = await Promise.all(
      chats.map(async (chat) => {
        // Tìm user kia (không phải user hiện tại)
        const otherUser = chat.members.find(member => 
          member._id.toString() !== userId
        );

        // Lấy tin nhắn cuối cùng
        const lastMessage = await Message.findOne({ chat_id: chat._id })
          .sort({ date_time: -1 })
          .populate("sender_id", "first_name last_name");

        return {
          ...chat.toObject(),
          otherUser,
          lastMessage
        };
      })
    );

    res.json({
      success: true,
      chats: chats
    });

  } catch (error) {
    console.error("Get chat list error:", error);
    res.status(500).json({ error: "Failed to get chat list" });
  }
});

// 4. Lấy tin nhắn trong chat
router.get("/:chatId/messages", async (req, res) => {
  try {
    const { chatId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const userId = req.user._id;

    // Kiểm tra user có quyền truy cập chat này không
    const chat = await Chat.findById(chatId);
    if (!chat || !chat.members.includes(userId)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const skip = (page - 1) * limit;
    
    const messages = await Message.find({ chat_id: chatId })
      .populate("sender_id", "login_name first_name last_name")
      .sort({ date_time: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Reverse để tin nhắn cũ ở trên, mới ở dưới
    messages.reverse();

    res.json({
      success: true,
      messages: messages,
      hasMore: messages.length === parseInt(limit)
    });

  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({ error: "Failed to get messages" });
  }
});

// 5. Gửi tin nhắn
router.post("/:chatId/send", async (req, res) => {
  try {
    const { chatId } = req.params;
    const { content } = req.body;
    const userId = req.user._id;

    if (!content || content.trim() === "") {
      return res.status(400).json({ error: "Message content required" });
    }

    // Kiểm tra user có quyền gửi tin nhắn trong chat này không
    const chat = await Chat.findById(chatId);
    if (!chat || !chat.members.includes(userId)) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Tạo tin nhắn mới
    const newMessage = new Message({
      chat_id: chatId,
      sender_id: userId,
      content: content.trim()
    });

    await newMessage.save();
    await newMessage.populate("sender_id", "login_name first_name last_name");

    // Cập nhật thời gian chat
    await Chat.findByIdAndUpdate(chatId, { 
      last_message: {
        content: content.trim(),
        sender_id: userId,
        date_time: newMessage.date_time
      }
    });
    // Broadcast tin nhắn qua WebSocket
    if (global.broadcastChatMessage) {
      global.broadcastChatMessage(chatId, {
        type: "NEW_MESSAGE",
        chatId: chatId,
        message: newMessage
      }, userId.toString());
    }

    res.json({
      success: true,
      message: newMessage
    });

  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
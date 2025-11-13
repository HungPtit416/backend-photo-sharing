const WebSocket = require("ws");
const jwt = require("jsonwebtoken");
const User = require("../db/userModel");

function setupChatWebSocket(wss) {
  wss.on("connection", async (ws, req) => {
    console.log("New WebSocket connection");
    // Xác thực người dùng từ token
    ws.on("message", async (data) => {
      try {
        const message = JSON.parse(data);

        if (message.type === "AUTHENTICATE") {
          const token = message.token;
          
          if (!token) {
            ws.send(JSON.stringify({ 
              type: "ERROR", 
              message: "Token required" 
            }));
            return;
          }
          try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || "long-and-random-secret-key-B22DCCN416");
            const user = await User.findById(decoded.userId);
            
            if (!user) {
              ws.send(JSON.stringify({ 
                type: "ERROR", 
                message: "User not found" 
              }));
              return;
            }
            // Lưu thông tin user vào connection
            ws.userId = user._id.toString();
            ws.user = user;
            ws.authenticated = true;

            console.log(`User ${user.login_name} connected`);

            ws.send(JSON.stringify({
              type: "AUTHENTICATED",
              user: {
                _id: user._id,
                login_name: user.login_name,
                first_name: user.first_name,
                last_name: user.last_name,
              },
            }));
          } catch (error) {
            console.error("Authentication error:", error);
            ws.send(JSON.stringify({ 
              type: "ERROR", 
              message: "Invalid token" 
            }));
          }
        }

        if (message.type === "TYPING_START" && ws.authenticated) {
          broadcastToChat(wss, message.chatId, {
            type: "USER_TYPING",
            chatId: message.chatId,
            user: {
              _id: ws.user._id,
              login_name: ws.user.login_name,
            },
          }, ws.userId);
        }

        if (message.type === "TYPING_STOP" && ws.authenticated) {
          broadcastToChat(wss, message.chatId, {
            type: "USER_STOP_TYPING",
            chatId: message.chatId,
            user: {
              _id: ws.user._id,
              login_name: ws.user.login_name,
            },
          }, ws.userId);
        }

      } catch (error) {
        console.error("WebSocket message error:", error);
        ws.send(JSON.stringify({ 
          type: "ERROR", 
          message: "Invalid message format" 
        }));
      }
    });

    ws.on("close", () => {
      if (ws.authenticated) {
        console.log(`User ${ws.user.login_name} disconnected`);
      }
    });

    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
    });

    // Gửi ping định kỳ
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      } else {
        clearInterval(pingInterval);
      }
    }, 30000); // 30 giây
  });
}

async function broadcastToChat(wss, chatId, messageData, senderUserId) {
  // Lấy danh sách members của chat
  const chat = await Chat.findById(chatId);
  if (!chat) return;
  
  const memberIds = chat.members.map(id => id.toString());
  
  wss.clients.forEach((client) => {
    if (
      client.readyState === WebSocket.OPEN &&
      client.authenticated &&
      client.userId !== senderUserId &&
      memberIds.includes(client.userId)
    ) {
      client.send(JSON.stringify(messageData));
    }
  });
}

module.exports = { setupChatWebSocket, broadcastToChat };
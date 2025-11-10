const express = require("express");
const app = express();
const cors = require("cors");
const path = require("path");
const http = require("http");
const { WebSocketServer } = require("ws");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const dbConnect = require("./db/dbConnect");
const UserRouter = require("./routes/UserRouter");
const PhotoRouter = require("./routes/PhotoRouter");
const AuthRouter = require("./routes/AuthRouter");
const requireAuth = require("./middleware/auth");
const User = require("./db/userModel");
const sseRouter = require("./realtime/sseRouter");
dbConnect();

// CORS configuration
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://cvc35l.csb.app",
      "https://jw62pn.csb.app",
    ],
    credentials: true,
  })
);

app.use(express.json());

// Serve static files from images directory
app.use("/images", express.static(path.join(__dirname, "images")));

// ============= TOKEN BLACKLIST =============
const tokenBlacklist = new Set();

function blacklistToken(token) {
  tokenBlacklist.add(token);
  console.log("Token blacklisted");
}

function isTokenBlacklisted(token) {
  return tokenBlacklist.has(token);
}

global.blacklistToken = blacklistToken;
global.isTokenBlacklisted = isTokenBlacklisted;

// Routes
app.use("/api/stream", sseRouter);
app.use("/admin", AuthRouter); // Authentication routes
app.use("/user", UserRouter); // User registration route
app.use("/api/user", requireAuth, UserRouter); // Protected user routes
app.use("/api/photo", requireAuth, PhotoRouter); // Protected photo routes

app.get("/", (request, response) => {
  response.send({ message: "Hello from photo-sharing app API!" });
});

// Create HTTP server
const server = http.createServer(app);
const wss = new WebSocketServer({
  server,
  path: "/ws",
});

// ============= USER TRACKING =============
const userConnections = new Map();

function getOnlineUsersCount() {
  return userConnections.size;
}

function getOnlineUserIds() {
  return Array.from(userConnections.keys());
}

// UPDATED: Broadcast both count AND user IDs
function broadcastOnlineInfo() {
  const onlineCount = getOnlineUsersCount();
  const onlineUserIds = getOnlineUserIds();

  const message = JSON.stringify({
    type: "ONLINE_USERS",
    count: onlineCount,
    userIds: onlineUserIds,
    timestamp: new Date().toISOString(),
  });

  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      try {
        client.send(message);
      } catch (error) {
        console.error("Error sending to client:", error);
      }
    }
  });

  console.log(`Broadcast: ${onlineCount} users online:`, onlineUserIds);
}

function addUserConnection(userId, ws) {
  if (!userConnections.has(userId)) {
    userConnections.set(userId, new Set());
    console.log(`New unique user online: ${userId}`);
  }

  userConnections.get(userId).add(ws);
  const connectionCount = userConnections.get(userId).size;
  console.log(`User ${userId} added (${connectionCount} connections)`);
}

function removeUserConnection(userId, ws) {
  if (userConnections.has(userId)) {
    userConnections.get(userId).delete(ws);

    if (userConnections.get(userId).size === 0) {
      userConnections.delete(userId);
      console.log(`User ${userId} disconnected`);
    } else {
      console.log(
        `User ${userId} removed (${userConnections.get(userId).size} remaining)`
      );
    }
  }
}

// WebSocket handler
wss.on("connection", async (ws, req) => {
  console.log("New WebSocket connection attempt");

  const urlParams = new URLSearchParams(req.url.split("?")[1]);
  const token = urlParams.get("token");

  if (!token) {
    console.log("No token provided");
    ws.close(1008, "No authentication token provided");
    return;
  }

  if (isTokenBlacklisted(token)) {
    console.log("Token blacklisted");
    ws.close(1008, "Token has been invalidated");
    return;
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "long-and-random-secret-key-B22DCCN416"
    );

    const user = await User.findById(decoded.userId);
    if (!user) {
      console.log("User not found");
      ws.close(1008, "User not found");
      return;
    }

    const userId = user._id.toString();
    const username = `${user.first_name} ${user.last_name}`;

    ws.userId = userId;
    ws.username = username;
    ws.token = token;

    addUserConnection(userId, ws);
    console.log(`User connected: ${username} (${userId})`);

    ws.send(
      JSON.stringify({
        type: "CONNECTED",
        message: "Successfully connected to WebSocket",
        userId: userId,
      })
    );

    broadcastOnlineInfo();

    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === "PING") {
          ws.send(JSON.stringify({ type: "PONG" }));
        }
      } catch (error) {
        console.error("Error parsing message:", error);
      }
    });

    ws.on("close", () => {
      if (ws.userId) {
        console.log(`Connection closed: ${ws.username}`);
        removeUserConnection(ws.userId, ws);
        broadcastOnlineInfo();
      }
    });

    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
      if (ws.userId) {
        removeUserConnection(ws.userId, ws);
        broadcastOnlineInfo();
      }
    });
  } catch (error) {
    console.error("Token verification failed:", error.message);
    ws.close(1008, "Invalid authentication token");
  }
});

global.disconnectUserWebSockets = function (userId) {
  if (userConnections.has(userId)) {
    const connections = userConnections.get(userId);
    console.log(`Disconnecting all WebSockets for user: ${userId}`);

    connections.forEach((ws) => {
      if (ws.readyState === 1) {
        ws.close(1000, "User logged out");
      }
    });

    userConnections.delete(userId);
    broadcastOnlineInfo();
  }
};

server.listen(8081, () => {
  console.log("Server listening on http://localhost:8081");
  console.log("WebSocket server ready on ws://localhost:8081");
});

process.on("SIGTERM", () => {
  console.log("SIGTERM signal received: closing HTTP server");
  server.close(() => {
    console.log("HTTP server closed");
  });
});

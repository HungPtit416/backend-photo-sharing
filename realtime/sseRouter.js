const jwt = require("jsonwebtoken");

const express = require("express");
const router = express.Router();
const { addClient, removeClient, broadcast } = require("./sseManager");

router.get("/stream", (req, res) => {
  console.log("/api/stream/stream called");

  const token = req.query.token;
  if (!token) {
    console.error("No token provided");
    return res.status(401).send("Unauthorized");
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Token verified for user:", decoded.userId);
    req.user_id = decoded.userId;
  } catch (err) {
    console.error("JWT verify error:", err.message);
    return res.status(401).send("Unauthorized");
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  addClient(res);
  console.log("SSE connection established:", req.user_id);

  const keepAlive = setInterval(() => res.write(":\n\n"), 20000);

  req.on("close", () => {
    clearInterval(keepAlive);
    removeClient(res);
    console.log("SSE connection closed:", req.user_id);
  });
});

module.exports = router;

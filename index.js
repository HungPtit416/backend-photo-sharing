const express = require("express");
const app = express();
const cors = require("cors");
const path = require("path");
require("dotenv").config();
const dbConnect = require("./db/dbConnect");
const UserRouter = require("./routes/UserRouter");
const PhotoRouter = require("./routes/PhotoRouter");
const AuthRouter = require("./routes/AuthRouter");
const requireAuth = require("./middleware/auth");

dbConnect();

// CORS configuration to allow credentials
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());

// Serve static files from images directory
app.use("/images", express.static(path.join(__dirname, "images")));

// Routes
app.use("/admin", AuthRouter); // Authentication routes
app.use("/user", UserRouter); // User registration route
app.use("/api/user", requireAuth, UserRouter); // Protected user routes
app.use("/api/photo", requireAuth, PhotoRouter); // Protected photo routes

app.get("/", (request, response) => {
  response.send({ message: "Hello from photo-sharing app API!" });
});

app.listen(8081, () => {
  console.log("server listening on port http://localhost:8081");
});

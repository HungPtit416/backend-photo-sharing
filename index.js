const express = require("express");
const app = express();
const cors = require("cors");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const path = require("path");
require("dotenv").config(); // Load environment variables
const dbConnect = require("./db/dbConnect");
const UserRouter = require("./routes/UserRouter");
const PhotoRouter = require("./routes/PhotoRouter");
const AuthRouter = require("./routes/AuthRouter"); // New auth routes
const requireAuth = require("./middleware/auth"); // Authentication middleware

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

// Session configuration using MongoDB Atlas
app.use(
  session({
    secret: process.env.SESSION_SECRET || "your-secret-key-here", // Use env variable or fallback
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.DB_URL, // Use your MongoDB Atlas connection string
    }),
    cookie: {
      secure: false, // Set to true if using HTTPS
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24, // 24 hours
    },
  })
);

// Routes
app.use("/admin", AuthRouter); // Authentication routes (no auth required)
app.use("/user", UserRouter); // User registration route (no auth required for POST /user)
app.use("/api/user", requireAuth, UserRouter); // Protected user routes
app.use("/api/photo", requireAuth, PhotoRouter); // Protected photo routes

app.get("/", (request, response) => {
  response.send({ message: "Hello from photo-sharing app API!" });
});

app.listen(8081, () => {
  console.log("server listening on port http://localhost:8081");
});

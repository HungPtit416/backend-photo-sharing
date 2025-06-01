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
const cookieParser = require("cookie-parser");
dbConnect();

// CORS configuration to allow credentials
const corsOptions = {
  origin: [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    // Add your sandbox domains here
    "https://codesandbox.io",
    //"https://*.codesandbox.io",
    "https://3pqzgw-8081.csb.app",
    //"https://*.csb.app",
  ],
  credentials: true, // Enable credentials
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: [
    "Origin",
    "X-Requested-With",
    "Content-Type",
    "Accept",
    "Authorization",
    "Cache-Control",
    "X-API-Key",
  ],
  exposedHeaders: ["set-cookie"],
};

app.use(cors(corsOptions));
app.use(cookieParser());
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
      secure: true,
      httpOnly: true,
      sameSite: "none",
      maxAge: 1000 * 60 * 60 * 24, // 24 hours
    },
  })
);

// Routes
app.use("/admin", AuthRouter); // Authentication routes (no auth required)
app.use("/user", UserRouter); // User registration route (no auth required for POST /user)
app.use("/api/user", requireAuth, UserRouter); // Protected user routes
app.use("/api/photo", requireAuth, PhotoRouter); // Protected photo routes

app.get("/api/test-cors", (req, res) => {
  console.log("Origin:", req.get("Origin"));
  console.log("Cookies:", req.cookies);

  res.json({
    message: "CORS with credentials is working!",
    origin: req.get("Origin") || "No origin header",
    cookies: req.cookies,
    timestamp: new Date().toISOString(),
  });
});
app.get("/", (request, response) => {
  response.send({ message: "Hello from photo-sharing app API!" });
});

app.listen(8081, () => {
  console.log("server listening on port http://localhost:8081");
});

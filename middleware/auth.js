// Middleware to check if user is authenticated
function requireAuth(req, res, next) {
  // Skip authentication for login/logout routes
  if (req.path === "/admin/login" || req.path === "/admin/logout") {
    return next();
  }

  // Check if user is logged in
  if (!req.session.user_id) {
    return res.status(401).json({ error: "Unauthorized - Please log in" });
  }

  next();
}

module.exports = requireAuth;

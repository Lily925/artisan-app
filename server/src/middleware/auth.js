const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing or invalid Authorization header" });

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  // A valid signature isn't enough: the account may have been deleted (e.g. by a
  // re-seed) since the token was issued. Role also comes from the database so a
  // role change takes effect without waiting for the token to expire.
  try {
    const user = mongoose.isValidObjectId(payload.id) ? await User.findById(payload.id).select("role") : null;
    if (!user) return res.status(401).json({ error: "Account no longer exists" });
    req.user = { id: user._id.toString(), role: user.role };
    next();
  } catch (err) {
    next(err);
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden: insufficient role" });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };

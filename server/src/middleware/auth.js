const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");

// Resolves the Bearer token to { id, role } from the database, or null when there's
// no usable token. A valid signature isn't enough: the account may have been deleted
// (e.g. by a re-seed) since the token was issued. Role also comes from the database so
// a role change takes effect without waiting for the token to expire. Tokens issued before
// the last password change (older tokenVersion; tokens without "tv" count as 0) are refused.
async function userFromToken(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return { error: "Missing or invalid Authorization header" };

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
  } catch (err) {
    return { error: "Invalid or expired token" };
  }

  const user = mongoose.isValidObjectId(payload.id) ? await User.findById(payload.id).select("role tokenVersion") : null;
  if (!user) return { error: "Account no longer exists" };
  if ((payload.tv ?? 0) !== (user.tokenVersion ?? 0)) return { error: "Invalid or expired token" };
  return { user: { id: user._id.toString(), role: user.role } };
}

async function requireAuth(req, res, next) {
  try {
    const { user, error } = await userFromToken(req);
    if (!user) return res.status(401).json({ error });
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

// Sets req.user when a valid token is sent; otherwise carries on logged out (no 401).
async function optionalAuth(req, res, next) {
  try {
    req.user = (await userFromToken(req)).user || null;
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

module.exports = { requireAuth, optionalAuth, requireRole };

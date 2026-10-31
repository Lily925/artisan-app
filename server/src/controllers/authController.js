const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { SEED_PASSWORD } = require("../config/constants");

function signToken(user) {
  return jwt.sign(
    { id: user._id.toString(), role: user.role, tv: user.tokenVersion || 0 },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d", algorithm: "HS256" }
  );
}

// Only plain strings are accepted (objects like {"$gt": ""} are rejected before any query).
const str = (v) => (typeof v === "string" ? v : null);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128; // bcrypt only uses the first 72 bytes; this also bounds hashing work
// In production the seed password (public, it's in the repo) is refused, so the seeded demo
// accounts can't be used there until their passwords are changed (npm run set-password).
const seedPasswordBlocked = (password) => process.env.NODE_ENV === "production" && password === SEED_PASSWORD;
// The only roles a client may pick when signing up. "admin" (or anything else, including
// non-strings) is refused; admins are created on the server only (seed / database).
const SIGNUP_ROLES = ["buyer", "artisan"];

// Login/signup response: the caller's own account (so it includes email).
function toPublicUser(user) {
  return { id: user._id, name: user.name, email: user.email, role: user.role, avatarUrl: user.avatarUrl || "", bio: user.bio || "" };
}

async function signup(req, res) {
  const name = str(req.body?.name)?.trim();
  const email = str(req.body?.email)?.trim().toLowerCase();
  const password = str(req.body?.password);
  const role = req.body?.role === undefined ? "buyer" : req.body.role;
  if (!SIGNUP_ROLES.includes(role)) {
    return res.status(400).json({ error: "role must be 'buyer' or 'artisan'", code: "BAD_ROLE" });
  }
  if (!name || !email || !password) {
    return res.status(400).json({ error: "name, email, and password are required" });
  }
  if (name.length > 100) return res.status(400).json({ error: "Name must be 100 characters or fewer" });
  if (email.length > 254 || !EMAIL.test(email)) return res.status(400).json({ error: "Enter a valid email address" });
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    return res.status(400).json({ error: `Password must be ${PASSWORD_MIN}-${PASSWORD_MAX} characters` });
  }
  if (seedPasswordBlocked(password)) return res.status(400).json({ error: "Please choose a different password", code: "WEAK_PASSWORD" });

  const existing = await User.findOne({ email });
  if (existing) return res.status(409).json({ error: "Email already registered" });

  const passwordHash = await bcrypt.hash(password, 10);
  // An artisan's shop profile (Artisan record) is created by POST /api/artisans/me ("Set up your shop").
  const user = await User.create({ name, email, passwordHash, role });

  const token = signToken(user);
  res.status(201).json({ token, user: toPublicUser(user) });
}

async function login(req, res) {
  const email = str(req.body?.email)?.trim().toLowerCase();
  const password = str(req.body?.password);
  if (!email || !password || email.length > 254 || password.length > PASSWORD_MAX) {
    return res.status(400).json({ error: "email and password are required" });
  }

  if (seedPasswordBlocked(password)) return res.status(401).json({ error: "Invalid email or password" });

  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ error: "Invalid email or password" });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Invalid email or password" });

  const token = signToken(user);
  res.json({ token, user: toPublicUser(user) });
}

// PUT /api/auth/password { currentPassword, newPassword }. Every failure is a 400 (not 401,
// which the client treats as "logged out"); the code tells the client which message to show.
// On success all earlier tokens stop working and this session gets a fresh one.
async function changePassword(req, res) {
  const currentPassword = str(req.body?.currentPassword);
  const newPassword = str(req.body?.newPassword);
  if (!currentPassword || !newPassword || currentPassword.length > PASSWORD_MAX) {
    return res.status(400).json({ error: "Current and new password are required", code: "MISSING_FIELDS" });
  }
  if (newPassword.length < PASSWORD_MIN || newPassword.length > PASSWORD_MAX) {
    return res.status(400).json({ error: `Password must be ${PASSWORD_MIN}-${PASSWORD_MAX} characters`, code: "BAD_NEW_PASSWORD" });
  }
  if (seedPasswordBlocked(newPassword)) return res.status(400).json({ error: "Please choose a different password", code: "WEAK_PASSWORD" });

  const user = await User.findById(req.user.id);
  if (!user) return res.status(401).json({ error: "Account no longer exists" });
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    return res.status(400).json({ error: "Current password is incorrect", code: "WRONG_PASSWORD" });
  }
  // Compared against the hash, so a new password matching the old one in bcrypt's first
  // 72 bytes also counts as the same.
  if (newPassword === currentPassword || (await bcrypt.compare(newPassword, user.passwordHash))) {
    return res.status(400).json({ error: "New password must be different from the current one", code: "SAME_PASSWORD" });
  }

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();
  res.json({ token: signToken(user), user: toPublicUser(user) });
}

module.exports = { signup, login, changePassword };

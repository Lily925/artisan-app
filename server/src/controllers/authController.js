const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

function signToken(user) {
  return jwt.sign(
    { id: user._id.toString(), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d", algorithm: "HS256" }
  );
}

// Only plain strings are accepted (objects like {"$gt": ""} are rejected before any query).
const str = (v) => (typeof v === "string" ? v : null);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128; // bcrypt only uses the first 72 bytes; this also bounds hashing work

function toPublicUser(user) {
  return { id: user._id, name: user.name, email: user.email, role: user.role };
}

async function signup(req, res) {
  const name = str(req.body?.name)?.trim();
  const email = str(req.body?.email)?.trim().toLowerCase();
  const password = str(req.body?.password);
  const { role } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: "name, email, and password are required" });
  }
  if (name.length > 100) return res.status(400).json({ error: "Name must be 100 characters or fewer" });
  if (email.length > 254 || !EMAIL.test(email)) return res.status(400).json({ error: "Enter a valid email address" });
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    return res.status(400).json({ error: `Password must be ${PASSWORD_MIN}-${PASSWORD_MAX} characters` });
  }
  if (role !== undefined && !["buyer", "artisan"].includes(role)) {
    return res.status(400).json({ error: "role must be 'buyer' or 'artisan'" });
  }

  const existing = await User.findOne({ email });
  if (existing) return res.status(409).json({ error: "Email already registered" });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, passwordHash, role: role || "buyer" });

  const token = signToken(user);
  res.status(201).json({ token, user: toPublicUser(user) });
}

async function login(req, res) {
  const email = str(req.body?.email)?.trim().toLowerCase();
  const password = str(req.body?.password);
  if (!email || !password || email.length > 254 || password.length > PASSWORD_MAX) {
    return res.status(400).json({ error: "email and password are required" });
  }

  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ error: "Invalid email or password" });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Invalid email or password" });

  const token = signToken(user);
  res.json({ token, user: toPublicUser(user) });
}

module.exports = { signup, login };

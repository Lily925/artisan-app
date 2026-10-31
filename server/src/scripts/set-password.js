// Sets a new password for one account, e.g. to replace the public seed password
// ("artisan123") before going live.
//   npm run set-password -- admin@artisan.mn               random 20-character password, printed once
//   NEW_PASSWORD='...' npm run set-password -- admin@artisan.mn   use your own (8-128 characters)
// Works on whatever database MONGODB_URI points at. Existing logins (tokens) for the
// account stop working.
require("dotenv").config();
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../models/User");
const { SEED_PASSWORD } = require("../config/constants");

async function run() {
  const email = (process.argv[2] || "").trim().toLowerCase();
  if (!email) {
    console.error("Usage: npm run set-password -- <email>");
    process.exit(1);
  }
  const chosen = process.env.NEW_PASSWORD;
  if (chosen !== undefined && (chosen.length < 8 || chosen.length > 128 || chosen === SEED_PASSWORD)) {
    console.error("NEW_PASSWORD must be 8-128 characters and not the seed password.");
    process.exit(1);
  }
  const password = chosen ?? crypto.randomBytes(15).toString("base64url"); // 20 characters

  await connectDB();
  const user = await User.findOne({ email });
  if (!user) {
    console.error(`No account with email ${email}.`);
    await mongoose.disconnect();
    process.exit(1);
  }
  user.passwordHash = await bcrypt.hash(password, 10);
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();
  console.log(`Password changed for ${email} (${user.role}).`);
  if (chosen === undefined) console.log(`New password (shown once, store it in a password manager): ${password}`);
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("set-password failed:", err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});

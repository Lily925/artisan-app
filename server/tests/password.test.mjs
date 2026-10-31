// API tests for "Change password" (PUT /api/auth/password).
// Run with the API running (npm run dev / npm start):  npm run test:password (also part of test:api)
// Test accounts (pw-test-*@test.invalid) are created directly in the database, so no sign-ups
// are used, and are deleted at the end, also when a check fails.
import { createRequire } from "module";
const require = createRequire(import.meta.url);
require("dotenv").config();
import crypto from "crypto";
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const connectDB = require("../src/config/db");
const User = require("../src/models/User");

const API = process.env.API_URL || `http://localhost:${process.env.PORT || 5000}/api`;
let pass = 0, fail = 0;
const check = (n, ok, x = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${x ? "  — " + x : ""}`); };
const call = async (path, { method = "GET", token, json } = {}) => {
  const h = {}; if (token) h.Authorization = `Bearer ${token}`; if (json !== undefined) h["Content-Type"] = "application/json";
  const r = await fetch(API + path, { method, headers: h, body: json !== undefined ? JSON.stringify(json) : undefined });
  const text = await r.text();
  let body = {}; try { body = JSON.parse(text); } catch {}
  return { status: r.status, body, text };
};
const tag = crypto.randomBytes(4).toString("hex");
const email = (k) => `pw-test-${k}-${tag}@test.invalid`;
const pw = () => crypto.randomBytes(9).toString("base64url"); // 12 characters
const login = (k, password) => call("/auth/login", { method: "POST", json: { email: email(k), password } });
const change = (token, currentPassword, newPassword) => call("/auth/password", { method: "PUT", token, json: { currentPassword, newPassword } });
const me = (token) => call("/users/me", { token });

await connectDB();
// Creates an account with a known password and logs it in through the API.
async function account(k, role) {
  const password = pw();
  await User.create({ name: `Pw Test ${k}`, email: email(k), passwordHash: await bcrypt.hash(password, 10), role });
  const r = await login(k, password);
  if (r.status !== 200) throw new Error(`login for ${k} failed: ${r.status} ${r.body.error}`);
  return { password, token: r.body.token };
}

try {
  const buyer = await account("buyer", "buyer");
  const other = await account("other", "buyer");
  const artisan = await account("artisan", "artisan");
  const admin = await account("admin", "admin");
  const limited = await account("limited", "buyer");

  // ── rejected changes (4 failed attempts on this account; the limit is 5 per 15 min) ──
  check("no login → 401", (await call("/auth/password", { method: "PUT", json: { currentPassword: buyer.password, newPassword: pw() } })).status === 401);
  let r = await change(buyer.token, "wrong-password-123", pw());
  check("wrong current password → 400 WRONG_PASSWORD", r.status === 400 && r.body.code === "WRONG_PASSWORD", `${r.status} ${r.body.code}`);
  r = await change(buyer.token, buyer.password, "short7!");
  check("new password under 8 characters → 400 BAD_NEW_PASSWORD", r.status === 400 && r.body.code === "BAD_NEW_PASSWORD", `${r.status} ${r.body.code}`);
  r = await change(buyer.token, buyer.password, buyer.password);
  check("same as current → 400 SAME_PASSWORD", r.status === 400 && r.body.code === "SAME_PASSWORD", `${r.status} ${r.body.code}`);
  r = await change(buyer.token, { $ne: "" }, pw());
  check("non-text current password → 400", r.status === 400, `${r.status} ${r.body.code}`);
  check("still logged in with the old password after failed changes", (await login("buyer", buyer.password)).status === 200);

  // ── success ──
  const newPassword = pw();
  r = await change(buyer.token, buyer.password, newPassword);
  check("correct current password → 200 with a new token", r.status === 200 && typeof r.body.token === "string" && r.body.token !== buyer.token, `${r.status} ${r.body.error || ""}`);
  check("response has no password or hash", !/password|\$2[aby]\$/i.test(r.text.replace(/"token":"[^"]*"/, "")) && !r.text.includes(newPassword));
  const newToken = r.body.token;
  check("old token rejected → 401", (await me(buyer.token)).status === 401);
  check("new token works", (await me(newToken)).status === 200);
  check("login with the old password fails", (await login("buyer", buyer.password)).status === 401);
  const relogin = await login("buyer", newPassword);
  check("login with the new password works", relogin.status === 200);
  check("token from that login works", (await me(relogin.body.token)).status === 200);
  r = await change(buyer.token, newPassword, pw());
  check("old token can't change the password again", r.status === 401);

  // ── other users unaffected ──
  check("other user's token still works", (await me(other.token)).status === 200);
  check("other user's password unchanged", (await login("other", other.password)).status === 200);

  // ── every role ──
  for (const [role, acc] of [["artisan", artisan], ["admin", admin]]) {
    const next = pw();
    r = await change(acc.token, acc.password, next);
    check(`${role} can change their password`, r.status === 200 && r.body.user?.role === role, `${r.status} ${r.body.error || ""}`);
    check(`${role}: old token rejected, new token works`, (await me(acc.token)).status === 401 && (await me(r.body.token)).status === 200);
  }

  // ── tokens from before this feature (no version) still work until a change ──
  const legacyUser = await User.findOne({ email: email("other") });
  const legacy = jwt.sign({ id: legacyUser._id.toString(), role: "buyer" }, process.env.JWT_SECRET, { expiresIn: "5m", algorithm: "HS256" });
  check("token without a version (issued before this feature) still works", (await me(legacy)).status === 200);

  // ── rate limit: 5 failed attempts per account per 15 minutes ──
  for (let i = 0; i < 5; i++) await change(limited.token, `wrong-${i}-password`, pw());
  r = await change(limited.token, limited.password, pw());
  check("6th attempt → 429, even with the right password", r.status === 429 && r.body.code === "RATE_LIMITED", `${r.status} ${r.body.code}`);
  check("rate-limited attempt didn't change the password", (await login("limited", limited.password)).status === 200);
  r = await change(other.token, other.password, pw());
  check("limit is per account (another user can still change theirs)", r.status === 200, `${r.status} ${r.body.code}`);
} finally {
  const { deletedCount } = await User.deleteMany({ email: new RegExp(`^pw-test-.*-${tag}@test\\.invalid$`) });
  console.log(`cleanup: removed ${deletedCount} test accounts`);
  await mongoose.disconnect();
}
console.log(`
${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;

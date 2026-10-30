// API tests for profile photos (PATCH /api/users/:id), against whichever photo storage the
// API uses (local disk or Cloudinary; see tests/helpers.mjs).
// Run with the API running (npm run dev / npm start):  npm run test:avatars
// Uses 1 sign-up (the limit is 10 per hour per address; restarting the API resets it). The
// account and its photo are deleted at the end, also when a check fails.
import { createRequire } from "module";
import crypto from "crypto";
import { API, STORAGE, PNG, JPG, EXE, BIG_PNG, storedUrl, exists, served, count } from "./helpers.mjs";
const require = createRequire(import.meta.url);
require("dotenv").config();

let pass = 0, fail = 0;
const check = (n, ok, x = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${x ? "  — " + x : ""}`); };
const call = async (p, { method = "GET", token, json, form } = {}) => {
  const h = {}; if (token) h.Authorization = `Bearer ${token}`; if (json !== undefined) h["Content-Type"] = "application/json";
  const r = await fetch(API + p, { method, headers: h, body: form || (json !== undefined ? JSON.stringify(json) : undefined) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const photoForm = (buf, type, name) => { const f = new FormData(); f.append("photo", new Blob([buf], { type }), name); return f; };

const tag = crypto.randomBytes(4).toString("hex");
const email = `avatar-test-${tag}@test.invalid`;
console.log(`Photo storage under test: ${STORAGE}`);

async function cleanup() {
  const mongoose = require("mongoose");
  const connectDB = require("../src/config/db");
  const User = require("../src/models/User");
  const { deleteAvatarPhoto } = require("../src/utils/imageStorage");
  await connectDB();
  const users = await User.find({ email });
  for (const u of users) await deleteAvatarPhoto(u.avatarUrl);
  const { deletedCount } = await User.deleteMany({ email });
  console.log(`cleanup: removed ${deletedCount} test account(s) and their photo`);
  await mongoose.disconnect();
}

try {
  const s = await call("/auth/signup", { method: "POST", json: { name: "Avatar Test", email, password: crypto.randomBytes(12).toString("hex") } });
  if (s.status !== 201) throw new Error(`sign-up failed: ${s.status} ${s.body.error}`);
  const { token, user } = s.body;
  const buyer = (await call("/auth/login", { method: "POST", json: { email: "buyer@artisan.mn", password: "artisan123" } })).body.token;
  const before = await count("avatars");

  // ── upload ──
  let r = await call(`/users/${user.id}`, { method: "PATCH", token, form: photoForm(PNG(), "image/png", "me.png") });
  check("upload profile photo → 200", r.status === 200, `${r.status} ${r.body.error || ""}`);
  const first = r.body.avatarUrl;
  check("stored as a photo URL of this storage", storedUrl("avatars").test(first || ""), first);
  check("photo is stored and served", (await exists(first)) && (await served(first)));
  check("GET /users/me returns it", (await call("/users/me", { token })).body.avatarUrl === first);

  // ── replace ──
  r = await call(`/users/${user.id}`, { method: "PATCH", token, form: photoForm(JPG(), "image/jpeg", "me.jpg") });
  const second = r.body.avatarUrl;
  check("replace with a JPEG → 200, new URL", r.status === 200 && storedUrl("avatars").test(second || "") && second !== first, second);
  check("old photo deleted from storage", !(await exists(first)));
  check("new photo stored", await exists(second));
  check("one photo in storage for this user", (await count("avatars")) === before + 1);

  // ── refused uploads change nothing ──
  r = await call(`/users/${user.id}`, { method: "PATCH", token, form: photoForm(EXE(), "image/jpeg", "setup.jpg") });
  check(".exe renamed to .jpg refused by signature (400)", r.status === 400 && /JPEG, PNG or WebP/.test(r.body.error), r.body.error);
  r = await call(`/users/${user.id}`, { method: "PATCH", token, form: photoForm(Buffer.from("hello"), "text/plain", "a.txt") });
  check("text file refused (400)", r.status === 400, r.body.error);
  r = await call(`/users/${user.id}`, { method: "PATCH", token, form: photoForm(BIG_PNG(), "image/png", "big.png") });
  check("3 MB photo refused (400)", r.status === 400 && /2 MB/.test(r.body.error), r.body.error);
  r = await call(`/users/${user.id}`, { method: "PATCH", token: buyer, form: photoForm(PNG(), "image/png", "x.png") });
  check("someone else's profile → 403", r.status === 403);
  r = await call(`/users/${user.id}`, { method: "PATCH", form: photoForm(PNG(), "image/png", "x.png") });
  check("no login → 401", r.status === 401);
  check("refused uploads kept the photo and stored nothing new", (await call("/users/me", { token })).body.avatarUrl === second && (await count("avatars")) === before + 1);

  // ── remove ──
  r = await call(`/users/${user.id}`, { method: "PATCH", token, json: { removePhoto: true } });
  check("remove photo → 200, avatarUrl empty", r.status === 200 && r.body.avatarUrl === "");
  check("removed photo deleted from storage", !(await exists(second)));
  check("storage back to how it was", (await count("avatars")) === before);
} catch (err) {
  fail++;
  console.log("FAIL  test run stopped:", err.message);
} finally {
  await cleanup();
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;

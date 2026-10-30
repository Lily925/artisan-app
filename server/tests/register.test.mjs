// API tests for sign-up roles and "Set up your shop".
// Run with the API running (npm run dev / npm start):  npm run test:api
// Uses 8 sign-up attempts (the limit is 10 per hour per address; restarting the API resets it).
// Every account it creates (reg-test-*@test.invalid) is deleted at the end, also when a check fails.
import { createRequire } from "module";
const require = createRequire(import.meta.url);
require("dotenv").config();
import crypto from "crypto";
const API = process.env.API_URL || `http://localhost:${process.env.PORT || 5000}/api`;
let pass = 0, fail = 0;
const check = (n, ok, x = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${x ? "  — " + x : ""}`); };
const call = async (path, { method = "GET", token, json } = {}) => {
  const h = {}; if (token) h.Authorization = `Bearer ${token}`; if (json !== undefined) h["Content-Type"] = "application/json";
  const r = await fetch(API + path, { method, headers: h, body: json !== undefined ? JSON.stringify(json) : undefined });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const tag = crypto.randomBytes(4).toString("hex");
const pw = crypto.randomBytes(12).toString("hex");
const email = (k) => `reg-test-${k}-${tag}@test.invalid`;
const signup = (k, role) => call("/auth/signup", { method: "POST", json: { name: `Reg Test ${k}`, email: email(k), password: pw, ...(role !== "omit" && { role }) } });


async function cleanup() {
  const mongoose = require("mongoose");
  const connectDB = require("../src/config/db");
  const User = require("../src/models/User"), Artisan = require("../src/models/Artisan"), Cart = require("../src/models/Cart");
  await connectDB();
  const ids = (await User.find({ email: new RegExp(`^reg-test-.*-${tag}@test\.invalid$`) }).select("_id")).map((u) => u._id);
  await Artisan.deleteMany({ user: { $in: ids } });
  await Cart.deleteMany({ user: { $in: ids } });
  const { deletedCount } = await User.deleteMany({ _id: { $in: ids } });
  console.log(`cleanup: removed ${deletedCount} test accounts`);
  await mongoose.disconnect();
}

try {
  // ── sign-up roles (8 sign-up attempts; the limit is 10/hour per address) ──
  let r = await signup("buyer", "buyer");
  check("buyer sign-up → 201, role buyer", r.status === 201 && r.body.user.role === "buyer");
  const buyerToken = r.body.token;
  r = await signup("default", "omit");
  check("no role sent → buyer", r.status === 201 && r.body.user.role === "buyer");
  r = await signup("artisan", "artisan");
  check("artisan sign-up → 201, role artisan", r.status === 201 && r.body.user.role === "artisan");
  const artisanToken = r.body.token;
  for (const bad of ["admin", "ADMIN", ["artisan"], { $ne: "buyer" }, null]) {
    r = await signup(`bad${typeof bad}`, bad);
    check(`role ${JSON.stringify(bad)} rejected (400 BAD_ROLE)`, r.status === 400 && r.body.code === "BAD_ROLE", `${r.status} ${r.body.error}`);
  }
  const login = await call("/auth/login", { method: "POST", json: { email: email("badstring"), password: pw } });
  check("no account was created for a rejected role", login.status === 401);

  // ── shop setup ──
  r = await call("/artisans/me", { token: artisanToken });
  check("new artisan has no shop yet (GET /artisans/me → 404)", r.status === 404);
  check("buyer can't set up a shop (403)", (await call("/artisans/me", { method: "POST", token: buyerToken, json: { shopName: "Buyer Shop" } })).status === 403);
  check("no login → 401", (await call("/artisans/me", { method: "POST", json: { shopName: "Anon Shop" } })).status === 401);
  r = await call("/artisans/me", { method: "POST", token: artisanToken, json: { location: "Darkhan" } });
  check("shop name required (400 BAD_SHOP_NAME)", r.status === 400 && r.body.code === "BAD_SHOP_NAME");
  r = await call("/artisans/me", { method: "POST", token: artisanToken, json: { shopName: "<script>" } });
  check("invalid shop name rejected", r.status === 400 && r.body.code === "BAD_SHOP_NAME");
  r = await call("/artisans/me", { method: "POST", token: artisanToken, json: { shopName: "NOON_HANDMADE_" } });
  check("existing shop name taken (case-insensitive) → 409", r.status === 409 && r.body.code === "SHOP_NAME_TAKEN");
  r = await call("/artisans/me", { method: "POST", token: artisanToken, json: { shopName: "Reg Test Shop " + tag, instagramHandle: "not a handle!" } });
  check("invalid Instagram handle rejected (400)", r.status === 400, r.body.error);
  r = await call("/artisans/me", { method: "POST", token: artisanToken, json: { shopName: { $gt: "" } } });
  check("non-text fields rejected (400)", r.status === 400);
  r = await call("/artisans/me", { method: "POST", token: artisanToken, json: { shopName: ` Reg Test Shop ${tag} `, location: "Darkhan", bio: "I make felt slippers.", instagramHandle: "@reg_test_shop", certified: true, payoutEmail: "x@y.z" } });
  check("setup saved → 201", r.status === 201, `${r.status} ${r.body.error || ""}`);
  check("saved fields (trimmed, @ stripped)", r.body.shopName === `Reg Test Shop ${tag}` && r.body.location === "Darkhan" && r.body.bio === "I make felt slippers." && r.body.instagramHandle === "reg_test_shop");
  check("can't make itself certified", r.body.certified === false);
  const artisanId = r.body._id;
  r = await call("/artisans/me", { token: artisanToken });
  check("GET /artisans/me now returns the shop", r.status === 200 && r.body.shopName === `Reg Test Shop ${tag}` && r.body.payoutEmail === "");
  r = await call("/artisans/me", { method: "POST", token: artisanToken, json: { shopName: "Second Shop " + tag } });
  check("setting up twice → 409 SHOP_EXISTS", r.status === 409 && r.body.code === "SHOP_EXISTS");
  r = await call("/artisans/me", { method: "PUT", token: artisanToken, json: { shopName: "Renamed", payoutEmail: "reg-test-payout@test.invalid" } });
  r = await call("/artisans/me", { token: artisanToken });
  check("shop name can't be changed later; payout email can", r.body.shopName === `Reg Test Shop ${tag}` && r.body.payoutEmail === "reg-test-payout@test.invalid");
  r = await call(`/artisans/${artisanId}`);
  check("public shop has no email/payout email", r.status === 200 && !JSON.stringify(r.body).includes("@test.invalid"));
  r = await call("/users/me", { token: artisanToken });
  check("artisan account role stays artisan", r.body.role === "artisan");

  // ── existing accounts ──
  for (const e of ["buyer@artisan.mn", "noon.handmade@example.com", "admin@artisan.mn", "narantsetseg@artisan.mn"]) {
    const l = await call("/auth/login", { method: "POST", json: { email: e, password: "artisan123" } });
    check(`demo login still works: ${e} (${l.body.user?.role})`, l.status === 200);
  }
  const noon = (await call("/auth/login", { method: "POST", json: { email: "noon.handmade@example.com", password: "artisan123" } })).body.token;
  check("existing artisan still has their shop", (await call("/artisans/me", { token: noon })).body.shopName === "noon_handmade_");
} finally {
  await cleanup();
}
console.log(`
${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;

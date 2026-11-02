// API tests for sign-up roles and "Set up your shop" (shop approval: shop-approval.test.mjs).
// Starts its own throwaway database and API (setup.mjs):  npm run test:api
// Every account it creates (reg-test-*@test.invalid) is deleted at the end, also when a check fails.
// "Set up your shop" is only for artisan accounts without a shop (sign-up creates one now), so
// that account is created directly in the database.
import { API, connectDB, stopTestEnv } from "./setup.mjs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
import crypto from "crypto";
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
const signup = (k, role) => call("/auth/signup", { method: "POST", json: {
  name: `Reg Test ${k}`, email: email(k), password: pw, ...(role !== "omit" && { role }),
  ...(role === "artisan" && { shopName: `Reg Signup Shop ${tag}`, shopDescription: "Felt and wool." }),
} });


// An artisan account with no shop, logged in; returns its token.
async function legacyArtisan() {
  const bcrypt = require("bcryptjs");
  const User = require("../src/models/User");
  await connectDB();
  await User.create({ name: "Reg Test legacy", email: email("legacy"), passwordHash: await bcrypt.hash(pw, 10), role: "artisan" });
  return (await call("/auth/login", { method: "POST", json: { email: email("legacy"), password: pw } })).body.token;
}

async function cleanup() {
  const mongoose = require("mongoose");
  const User = require("../src/models/User"), Artisan = require("../src/models/Artisan"), Cart = require("../src/models/Cart");
  await connectDB();
  const ids = (await User.find({ email: new RegExp(`^reg-test-.*-${tag}@test\.invalid$`) }).select("_id")).map((u) => u._id);
  // Admins are told about each new shop: remove those notifications with the test shops.
  const shopIds = (await Artisan.find({ user: { $in: ids } }).select("_id")).map((a) => String(a._id));
  await require("../src/models/Notification").deleteMany({ "params.shopId": { $in: shopIds } });
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
  check("artisan sign-up → 201, role artisan, shop pending", r.status === 201 && r.body.user.role === "artisan" && r.body.shop?.status === "pending", `${r.status} ${r.body.error || ""}`);
  check("artisan's shop already exists (GET /artisans/me)", (await call("/artisans/me", { token: r.body.token })).body.shopName === `Reg Signup Shop ${tag}`);
  for (const bad of ["admin", "ADMIN", ["artisan"], { $ne: "buyer" }, null]) {
    r = await signup(`bad${typeof bad}`, bad);
    check(`role ${JSON.stringify(bad)} rejected (400 BAD_ROLE)`, r.status === 400 && r.body.code === "BAD_ROLE", `${r.status} ${r.body.error}`);
  }
  const login = await call("/auth/login", { method: "POST", json: { email: email("badstring"), password: pw } });
  check("no account was created for a rejected role", login.status === 401);

  // ── shop setup (artisan account without a shop, e.g. from before sign-up created one) ──
  const artisanToken = await legacyArtisan();
  r = await call("/artisans/me", { token: artisanToken });
  check("new artisan has no shop yet (GET /artisans/me → 404)", r.status === 404);
  check("buyer can't set up a shop (403)", (await call("/artisans/me", { method: "POST", token: buyerToken, json: { shopName: "Buyer Shop" } })).status === 403);
  check("no login → 401", (await call("/artisans/me", { method: "POST", json: { shopName: "Anon Shop" } })).status === 401);
  r = await call("/artisans/me", { method: "POST", token: artisanToken, json: { location: "Darkhan" } });
  check("shop name required (400 BAD_SHOP_NAME)", r.status === 400 && r.body.code === "BAD_SHOP_NAME");
  r = await call("/artisans/me", { method: "POST", token: artisanToken, json: { shopName: "<script>" } });
  check("invalid shop name rejected", r.status === 400 && r.body.code === "BAD_SHOP_NAME");
  r = await call("/artisans/me", { method: "POST", token: artisanToken, json: { shopName: `REG SIGNUP SHOP ${tag.toUpperCase()}` } });
  check("existing shop name taken (case-insensitive) → 409", r.status === 409 && r.body.code === "SHOP_NAME_TAKEN");
  r = await call("/artisans/me", { method: "POST", token: artisanToken, json: { shopName: "Reg Test Shop " + tag, instagramHandle: "not a handle!" } });
  check("invalid Instagram handle rejected (400)", r.status === 400, r.body.error);
  r = await call("/artisans/me", { method: "POST", token: artisanToken, json: { shopName: { $gt: "" } } });
  check("non-text fields rejected (400)", r.status === 400);
  r = await call("/artisans/me", { method: "POST", token: artisanToken, json: { shopName: ` Reg Test Shop ${tag} `, location: "Darkhan", bio: "I make felt slippers.", instagramHandle: "@reg_test_shop", certified: true, payoutEmail: "x@y.z" } });
  check("setup saved → 201, pending approval", r.status === 201 && r.body.status === "pending", `${r.status} ${r.body.error || ""}`);
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
  check("pending shop isn't public (404)", r.status === 404);
  r = await call("/users/me", { token: artisanToken });
  check("artisan account role stays artisan", r.body.role === "artisan");

  // ── accounts from before this run ──
  const bcrypt = require("bcryptjs");
  const User = require("../src/models/User"), Artisan = require("../src/models/Artisan");
  for (const role of ["buyer", "artisan", "admin"]) {
    await User.create({ name: `Reg Test old ${role}`, email: email(`old${role}`), passwordHash: await bcrypt.hash(pw, 10), role });
    const l = await call("/auth/login", { method: "POST", json: { email: email(`old${role}`), password: pw } });
    check(`an existing ${role} account can log in`, l.status === 200 && l.body.user?.role === role);
  }
  const oldArtisan = await User.findOne({ email: email("oldartisan") });
  await Artisan.create({ user: oldArtisan._id, shopName: `Reg Old Shop ${tag}`, slug: `reg-old-shop-${tag}`, status: "approved" });
  const oldToken = (await call("/auth/login", { method: "POST", json: { email: email("oldartisan"), password: pw } })).body.token;
  check("an existing artisan still has their shop", (await call("/artisans/me", { token: oldToken })).body.shopName === `Reg Old Shop ${tag}`);
} finally {
  await cleanup();
}
await stopTestEnv();
console.log(`
${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;

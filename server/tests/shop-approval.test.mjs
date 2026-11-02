// API tests for artisan sign-up with a shop, shop approval and the admin shop endpoints.
// Starts its own throwaway database and API (setup.mjs):  npm run test:shops (also part of test:api)
// Uploads 1 product photo, deleted again with the product.
// The admin, buyer and an older-style shop (no status) are created directly in the database;
// everything (shop-test-*@test.invalid) is deleted at the end, also when a check fails.
import { API, connectDB, stopTestEnv } from "./setup.mjs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
import crypto from "crypto";
import { PNG } from "./helpers.mjs";
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("../src/models/User");
const Artisan = require("../src/models/Artisan");
const Product = require("../src/models/Product");
const Cart = require("../src/models/Cart");
const Notification = require("../src/models/Notification");

let pass = 0, fail = 0;
const check = (n, ok, x = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${x ? "  — " + x : ""}`); };
const call = async (path, { method = "GET", token, json, form } = {}) => {
  const h = {}; if (token) h.Authorization = `Bearer ${token}`; if (json !== undefined) h["Content-Type"] = "application/json";
  const r = await fetch(API + path, { method, headers: h, body: form || (json !== undefined ? JSON.stringify(json) : undefined) });
  const text = await r.text();
  let body = {}; try { body = JSON.parse(text); } catch {}
  return { status: r.status, body, text };
};
const tag = crypto.randomBytes(4).toString("hex");
const pw = crypto.randomBytes(12).toString("hex");
const email = (k) => `shop-test-${k}-${tag}@test.invalid`;
const login = async (k) => (await call("/auth/login", { method: "POST", json: { email: email(k), password: pw } })).body.token;
// withPhoto false: an edit that keeps the current photos.
const productForm = ({ withPhoto = true, price = "25" } = {}) => {
  const f = new FormData();
  for (const [k, v] of Object.entries({ title: "Туршилт", titleEn: `Shop Test ${tag}`, category: "textile", price })) f.append(k, v);
  if (withPhoto) f.append("photos", new Blob([PNG()], { type: "image/png" }), "1.png");
  return f;
};
const notApproved = (r) => r.status === 403 && r.body.code === "SHOP_NOT_APPROVED" && /approved/.test(r.body.error);
const ids = (list) => list.map((x) => String(x._id ?? x.id));

await connectDB();
const created = { productId: null };

try {
  const hash = await bcrypt.hash(pw, 10);
  await User.create({ name: "Shop Test admin", email: email("admin"), passwordHash: hash, role: "admin" });
  await User.create({ name: "Shop Test buyer", email: email("buyer"), passwordHash: hash, role: "buyer" });
  const legacyUser = await User.create({ name: "Shop Test legacy", email: email("legacy"), passwordHash: hash, role: "artisan" });
  const legacyShop = await Artisan.create({ user: legacyUser._id, shopName: `Shop Test Legacy ${tag}` }); // no status, no slug
  const [adminToken, buyerToken, legacyToken] = [await login("admin"), await login("buyer"), await login("legacy")];

  // ── sign-up (2 sign-ups) ──
  let r = await call("/auth/signup", { method: "POST", json: { name: "Shop Test noshop", email: email("noshop"), password: pw, role: "artisan" } });
  check("artisan sign-up without a shop name → 400 BAD_SHOP_NAME", r.status === 400 && r.body.code === "BAD_SHOP_NAME", `${r.status} ${r.body.code}`);
  check("…and no account was created", !(await User.exists({ email: email("noshop") })));
  // Extra fields a client might try: all ignored.
  r = await call("/auth/signup", { method: "POST", json: {
    name: "Shop Test artisan", email: email("artisan"), password: pw, role: "artisan",
    shopName: `Нар Эсгий ${tag}`, shopDescription: "  Felt slippers from Arkhangai.  ", status: "approved", certified: true, tokenVersion: 5,
  } });
  check("artisan sign-up with a shop → 201", r.status === 201, `${r.status} ${r.body.error || ""}`);
  check("shop is pending even though the request said approved", r.body.shop?.status === "pending");
  check("slug is URL-safe and romanized", r.body.shop?.slug === `nar-esgii-${tag}`, r.body.shop?.slug);
  let artisanToken = r.body.token;
  r = await call("/artisans/me", { token: artisanToken });
  check("own shop: pending, not certified, description saved", r.body.status === "pending" && r.body.certified === false && r.body.bio === "Felt slippers from Arkhangai.");
  const shopId = r.body._id, slug = r.body.slug;

  // ── pending: can sign in and edit, can't publish, not public ──
  check("pending artisan can log in", Boolean(await login("artisan")));
  r = await call("/artisans/me", { method: "PUT", token: artisanToken, json: { location: "Arkhangai", instagramHandle: "nar_esgii" } });
  check("pending artisan can edit the shop profile", r.status === 200 && r.body.location === "Arkhangai", `${r.status} ${r.body.error || ""}`);
  r = await call("/products", { method: "POST", token: artisanToken, form: productForm() });
  check("pending artisan can't publish a product → 403 SHOP_NOT_APPROVED with a clear message", notApproved(r), `${r.status} ${r.body.code} ${r.body.error}`);
  check("…and nothing was created", !(await Product.exists({ titleEn: `Shop Test ${tag}` })));
  check("pending shop not in the public list", !ids((await call("/artisans")).body).includes(shopId));
  check("pending shop page → 404 (by id)", (await call(`/artisans/${shopId}`)).status === 404);
  check("pending shop page → 404 (by slug)", (await call(`/artisans/${slug}`)).status === 404);

  // ── admin endpoints are admin only ──
  check("no login → 401", (await call("/admin/shops")).status === 401);
  check("buyer → 403", (await call("/admin/shops", { token: buyerToken })).status === 403);
  check("artisan → 403", (await call("/admin/shops", { token: artisanToken })).status === 403);
  check("artisan can't approve their own shop → 403", (await call(`/admin/shops/${shopId}/approve`, { method: "PUT", token: artisanToken })).status === 403);
  check("buyer can't suspend a shop → 403", (await call(`/admin/shops/${legacyShop._id}/suspend`, { method: "PUT", token: buyerToken })).status === 403);

  // ── admin: review queue ──
  r = await call("/admin/shops?status=pending", { token: adminToken });
  const row = r.body.find?.((s) => s.id === shopId);
  check("admin sees the pending shop with name, description and date", r.status === 200 && row?.shopName === `Нар Эсгий ${tag}` && row.description === "Felt slippers from Arkhangai." && Boolean(Date.parse(row.createdAt)));
  check("admin list has no email addresses", !r.text.includes("@"));
  check("unknown status filter → 400", (await call("/admin/shops?status=whatever", { token: adminToken })).status === 400);
  check("unknown action → 404", (await call(`/admin/shops/${shopId}/delete`, { method: "PUT", token: adminToken })).status === 404);
  check("can't suspend a pending shop → 409", (await call(`/admin/shops/${shopId}/suspend`, { method: "PUT", token: adminToken })).status === 409);

  // ── reject, then approve ──
  r = await call(`/admin/shops/${shopId}/reject`, { method: "PUT", token: adminToken, json: { reason: "Please add photos of your work." } });
  check("admin rejects with a reason", r.status === 200 && r.body.status === "rejected", `${r.status} ${r.body.error || ""}`);
  r = await call("/artisans/me", { token: artisanToken });
  check("rejected artisan sees the status and reason", r.body.status === "rejected" && r.body.statusReason === "Please add photos of your work.");
  check("rejected shop still not public", (await call(`/artisans/${shopId}`)).status === 404);
  r = await call(`/admin/shops/${shopId}/approve`, { method: "PUT", token: adminToken });
  check("admin approves", r.status === 200 && r.body.status === "approved" && r.body.statusReason === "");
  check("approved shop has left the pending queue", !ids((await call("/admin/shops?status=pending", { token: adminToken })).body).includes(shopId));
  check("approving twice → 409", (await call(`/admin/shops/${shopId}/approve`, { method: "PUT", token: adminToken })).status === 409);

  // ── approved: public, can publish ──
  check("approved shop in the public list", ids((await call("/artisans")).body).includes(shopId));
  r = await call(`/artisans/${slug}`);
  check("approved shop page by slug", r.status === 200 && r.body._id === shopId);
  check("public shop page has no email or private fields", !r.text.includes("@") && !/payoutEmail|statusReason|reviewedBy/.test(r.text));
  r = await call("/products", { method: "POST", token: artisanToken, form: productForm() });
  check("approved artisan can publish a product → 201", r.status === 201, `${r.status} ${r.body.error || ""}`);
  created.productId = r.body._id;
  check("product is public", ids((await call("/products")).body).includes(created.productId));
  check("buyer can add it to the cart", (await call("/cart", { method: "POST", token: buyerToken, json: { productId: created.productId, tier: "basic" } })).status === 201);
  await call("/cart", { method: "DELETE", token: buyerToken, json: { productId: created.productId, tier: "basic" } });

  // ── suspend / unsuspend ──
  r = await call(`/admin/shops/${shopId}/suspend`, { method: "PUT", token: adminToken, json: { reason: "Reported listing." } });
  check("admin suspends", r.status === 200 && r.body.status === "suspended");
  check("suspended shop not public", (await call(`/artisans/${shopId}`)).status === 404 && !ids((await call("/artisans")).body).includes(shopId));
  check("its products are hidden from the public list", !ids((await call("/products")).body).includes(created.productId));
  check("its product page → 404", (await call(`/products/${created.productId}`)).status === 404);
  check("its products can't be added to a cart → 404", (await call("/cart", { method: "POST", token: buyerToken, json: { productId: created.productId, tier: "basic" } })).status === 404);
  check("suspended artisan can't publish", notApproved(await call("/products", { method: "POST", token: artisanToken, form: productForm() })));
  r = await call(`/products/${created.productId}`, { method: "PUT", token: artisanToken, form: productForm({ withPhoto: false, price: "30" }) });
  check("suspended artisan can't edit their product → 403 SHOP_NOT_APPROVED", notApproved(r), `${r.status} ${r.body.code}`);
  r = await call(`/products/${created.productId}`, { method: "PUT", token: adminToken, form: productForm({ withPhoto: false, price: "31" }) });
  check("admin can still edit a suspended shop's product", r.status === 200 && r.body.pricingTiers?.basic?.price === 31, `${r.status} ${r.body.error || ""}`);
  check("suspended artisan still sees their own product", (await call(`/products/${created.productId}`, { token: artisanToken })).status === 200);
  r = await call("/admin/shops", { token: adminToken });
  check("admin's all-shops list shows it suspended with the reason", r.body.find?.((s) => s.id === shopId)?.statusReason === "Reported listing.");
  r = await call(`/admin/shops/${shopId}/unsuspend`, { method: "PUT", token: adminToken });
  check("admin unsuspends", r.status === 200 && r.body.status === "approved");
  check("product public again", ids((await call("/products")).body).includes(created.productId));
  r = await call(`/products/${created.productId}`, { method: "PUT", token: artisanToken, form: productForm({ withPhoto: false, price: "32" }) });
  check("approved artisan can edit their product again", r.status === 200 && r.body.pricingTiers?.basic?.price === 32, `${r.status} ${r.body.error || ""}`);

  // ── an approved shop put back to pending (e.g. by hand in the database) ──
  await Artisan.updateOne({ _id: shopId }, { $set: { status: "pending" } });
  check("pending artisan can't edit an existing product", notApproved(await call(`/products/${created.productId}`, { method: "PUT", token: artisanToken, form: productForm({ withPhoto: false }) })));
  check("pending artisan can't add a product", notApproved(await call("/products", { method: "POST", token: artisanToken, form: productForm() })));
  await Artisan.updateOne({ _id: shopId }, { $set: { status: "approved" } });

  // ── shops from before approval (no status) keep working ──
  check("older shop without a status is public", ids((await call("/artisans")).body).includes(String(legacyShop._id)));
  r = await call("/admin/shops?status=approved", { token: adminToken });
  check("…and listed as approved for the admin", r.body.find?.((s) => s.id === String(legacyShop._id))?.status === "approved");
  check("…and keeps no status until the migration (treated as approved)", (await call("/artisans/me", { token: legacyToken })).body.status === undefined);

} finally {
  if (created.productId) {
    const t = await login("artisan");
    await call(`/products/${created.productId}`, { method: "DELETE", token: t });
  }
  const users = (await User.find({ email: new RegExp(`^shop-test-.*-${tag}@test\\.invalid$`) }).select("_id")).map((u) => u._id);
  const shops = (await Artisan.find({ user: { $in: users } }).select("_id")).map((a) => a._id);
  // Admins are told about each new shop, owners about status changes.
  await Notification.deleteMany({ $or: [{ user: { $in: users } }, { "params.shopId": { $in: shops.map(String) } }] });
  await Product.deleteMany({ artisan: { $in: shops } });
  await Artisan.deleteMany({ _id: { $in: shops } });
  await Cart.deleteMany({ user: { $in: users } });
  const { deletedCount } = await User.deleteMany({ _id: { $in: users } });
  console.log(`cleanup: removed ${deletedCount} test accounts, ${shops.length} shops`);
  await mongoose.disconnect();
}
await stopTestEnv();
console.log(`
${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;

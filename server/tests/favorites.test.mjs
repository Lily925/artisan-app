// API tests for favorites (hearts) and the artisan's "saved" notification. Starts its own
// throwaway database and API (setup.mjs):  npm run test:favorites (also part of test:api).
// Accounts, shops and products are created directly in the database and deleted at the end.
import { API, connectDB, stopTestEnv } from "./setup.mjs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
import crypto from "crypto";
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("../src/models/User");
const Artisan = require("../src/models/Artisan");
const Product = require("../src/models/Product");
const Notification = require("../src/models/Notification");
const ProductSaveMark = require("../src/models/ProductSaveMark");
const { notifyProductSaved } = require("../src/utils/notify");
const { likeProduct } = require("../src/controllers/productController");

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
const pw = crypto.randomBytes(12).toString("hex");
const email = (k) => `fav-test-${k}-${tag}@test.invalid`;
const login = async (k) => (await call("/auth/login", { method: "POST", json: { email: email(k), password: pw } })).body.token;

await connectDB();

try {
  const hash = await bcrypt.hash(pw, 10);
  const mk = (k, role = "buyer") => User.create({ name: `Secret Person ${k}`, email: email(k), passwordHash: hash, role });
  const owner = await mk("owner", "artisan");
  const otherOwner = await mk("other", "artisan");
  const buyers = await Promise.all(["b1", "b2", "b3", "b4", "b5", "b6", "b7", "b8"].map((k) => mk(k)));
  const mkShop = (user, k, status = "approved") => Artisan.create({ user: user._id, shopName: `Fav ${k} ${tag}`, slug: `fav-${k}-${tag}`, status });
  const shop = await mkShop(owner, "shop");
  const otherShop = await mkShop(otherOwner, "othershop");
  const mkProduct = (artisan, name, over = {}) => Product.create({
    title: `${name} мн`, titleEn: name, category: "textile", artisan: artisan._id, images: ["/images/x.png"],
    pricingTiers: { basic: { price: 10 }, story: { price: 12 }, patron: { price: 15 } }, ...over,
  });
  const product = await mkProduct(shop, "Boots");
  const second = await mkProduct(shop, "Hat");
  const third = await mkProduct(shop, "Scarf");
  const otherProduct = await mkProduct(otherShop, "Bag");

  const ownerT = await login("owner");
  const otherT = await login("other");
  const tokens = await Promise.all(["b1", "b2", "b3", "b4", "b5", "b6", "b7", "b8"].map(login));
  const [b1, b2, b3, b4] = tokens;
  const like = (token, p) => call(`/products/${p._id}/like`, { method: "PUT", token });
  const unlike = (token, p) => call(`/products/${p._id}/like`, { method: "DELETE", token });
  const notesFor = (p) => Notification.find({ type: "product_saved", "params.productId": String(p._id) }).lean();
  const countOf = async (p) => (await Product.findById(p._id).select("likeCount")).likeCount;

  // ── login ──
  check("no login → 401", (await call(`/products/${product._id}/like`, { method: "PUT" })).status === 401);

  // ── your own product ──
  let r = await like(ownerT, product);
  check("the owner can't favorite their own product → 403 OWN_PRODUCT", r.status === 403 && r.body.code === "OWN_PRODUCT", `${r.status} ${r.body.code}`);
  check("…nothing changed", (await countOf(product)) === 0 && !(await Product.exists({ _id: product._id, likedBy: owner._id })));
  check("…no notification", (await notesFor(product)).length === 0);
  r = await like(ownerT, otherProduct);
  check("an artisan can favorite another shop's product", r.status === 200 && r.body.liked === true && r.body.likeCount === 1, r.text);
  check("…and that shop's artisan is told", (await notesFor(otherProduct)).length === 1);
  await unlike(ownerT, otherProduct);

  // ── older self-favorites don't count ──
  const selfLiked = await mkProduct(shop, "Old Self Like");
  await Product.updateOne({ _id: selfLiked._id }, { $push: { likedBy: owner._id }, $inc: { likeCount: 1 } });
  r = await call(`/products/${selfLiked._id}`);
  check("product page: an older self-favorite isn't counted", r.body.likeCount === 0, `${r.body.likeCount}`);
  r = await call("/products");
  check("product list: same", r.body.find((p) => p._id === String(selfLiked._id))?.likeCount === 0);
  r = await call(`/artisans/me/dashboard`, { token: ownerT });
  check("dashboard: not in the likes total or the product row", r.status === 200 && r.body.totals?.likes === 0 && r.body.products?.find((p) => String(p.id ?? p._id) === String(selfLiked._id))?.likeCount === 0, JSON.stringify(r.body.totals));
  r = await call("/products/liked", { token: ownerT });
  check("…nor in the owner's own Liked list", r.status === 200 && !r.body.includes(String(selfLiked._id)));
  r = await like(b1, selfLiked);
  check("someone else's favorite on it counts as 1, not 2", r.status === 200 && r.body.likeCount === 1, r.text);
  r = await call(`/products/${selfLiked._id}`);
  check("…also when read back", r.body.likeCount === 1);
  r = await unlike(ownerT, selfLiked);
  check("the owner can still remove an old self-favorite, and the count stays right", r.status === 200 && r.body.liked === false && r.body.likeCount === 1, r.text);
  await unlike(b1, selfLiked);
  await Notification.deleteMany({ "params.productId": String(selfLiked._id) });
  await ProductSaveMark.deleteMany({ product: selfLiked._id });

  // ── first favorite ──
  r = await like(b1, product);
  check("a buyer favorites a product", r.status === 200 && r.body.liked === true && r.body.likeCount === 1, r.text);
  let notes = await notesFor(product);
  check("the product's artisan gets one notification", notes.length === 1 && String(notes[0].user) === String(owner._id));
  check("…count 1, the product's names, a link to it, unread", notes[0]?.params.count === 1 && notes[0].params.title === "Boots мн" && notes[0].params.titleEn === "Boots" && notes[0].link === `/products/${product._id}` && notes[0].readAt === null, JSON.stringify(notes[0]));
  const stored = JSON.stringify(notes);
  check("…with nothing about who", !stored.includes(String(buyers[0]._id)) && !/Secret Person|test\.invalid/.test(stored));
  check("…only these values", Object.keys(notes[0].params).sort().join() === "count,productId,title,titleEn", Object.keys(notes[0].params).join());
  r = await call("/notifications", { token: ownerT });
  const row = r.body.items.find((n) => n.params.productId === String(product._id));
  check("the bell shows it, unread", row?.type === "product_saved" && r.body.unreadCount >= 1 && !/Secret Person|test\.invalid/.test(r.text));
  check("nobody else is told", (await Notification.countDocuments({ user: { $in: [...buyers.map((b) => b._id), otherOwner._id] }, type: "product_saved", "params.productId": String(product._id) })) === 0);
  check("the buyer's bell stays empty", (await call("/notifications", { token: b1 })).body.items.length === 0);

  // ── repeated hearts group into one ──
  await like(b2, product);
  await like(b3, product);
  notes = await notesFor(product);
  check("more people: still one notification, count 3", notes.length === 1 && notes[0].params.count === 3, JSON.stringify(notes.map((n) => n.params.count)));
  check("…the product's count follows", (await countOf(product)) === 3);
  r = await like(b1, product);
  notes = await notesFor(product);
  check("favoriting twice without un-favoriting changes nothing", r.status === 200 && notes[0].params.count === 3 && (await countOf(product)) === 3);
  await like(b1, second);
  check("another product gets its own notification", (await notesFor(second)).length === 1 && (await notesFor(product)).length === 1);
  await Notification.updateOne({ _id: notes[0]._id }, { $set: { readAt: new Date(), createdAt: new Date(Date.now() - 3600000) } });
  await like(b4, product);
  notes = await notesFor(product);
  check("a new person after it was read: same notification, count 4, unread and back on top", notes.length === 1 && notes[0].params.count === 4 && notes[0].readAt === null && Date.now() - new Date(notes[0].createdAt) < 60000);

  // ── un-favoriting, and favoriting again ──
  await Notification.updateOne({ _id: notes[0]._id }, { $set: { readAt: new Date("2026-01-01"), createdAt: new Date("2026-01-01") } });
  const unchanged = async () => {
    const [n] = await notesFor(product);
    return n.params.count === 4 && n.readAt?.getTime() === new Date("2026-01-01").getTime() && n.createdAt.getTime() === new Date("2026-01-01").getTime() && (await notesFor(product)).length === 1;
  };
  r = await unlike(b1, product);
  check("un-favoriting lowers the product's count", r.status === 200 && r.body.likeCount === 3, r.text);
  check("…and doesn't touch the notification", await unchanged());
  r = await like(b1, product);
  check("favoriting again raises the product's count", r.status === 200 && r.body.likeCount === 4, r.text);
  check("…but within 24 hours makes no notification", await unchanged());
  await unlike(b1, product); await like(b1, product); await unlike(b1, product); await like(b1, product);
  check("…however many times", await unchanged());

  await ProductSaveMark.updateOne({ product: product._id, user: buyers[0]._id }, { $set: { at: new Date(Date.now() - 23.5 * 3600000) } });
  await unlike(b1, product); await like(b1, product);
  check("still nothing at 23.5 hours", await unchanged());
  await ProductSaveMark.updateOne({ product: product._id, user: buyers[0]._id }, { $set: { at: new Date(Date.now() - 25 * 3600000) } });
  await unlike(b1, product); await like(b1, product);
  notes = await notesFor(product);
  check("after 24 hours it comes back unread, without counting the same person twice", notes.length === 1 && notes[0].readAt === null && notes[0].params.count === 4, JSON.stringify(notes[0].params));
  check("…and the next 24 hours start over", (await ProductSaveMark.findOne({ product: product._id, user: buyers[0]._id })).at > new Date(Date.now() - 60000));

  // ── several at once ──
  const results = await Promise.all(tokens.map((t) => like(t, third)));
  notes = await notesFor(third);
  check("8 favorites at once: all succeed, one notification, count 8", results.every((x) => x.status === 200) && notes.length === 1 && notes[0].params.count === 8, `${notes.length} ${notes[0]?.params.count}`);
  check("…the product's count is right", (await countOf(third)) === 8);
  check("…and the owner's unread count holds it once", (await Notification.countDocuments({ user: owner._id, type: "product_saved", "params.productId": String(third._id) })) === 1);

  // ── what can't be favorited ──
  const hidden = await mkProduct(shop, "Hidden", { isHidden: true });
  await like(b1, hidden);
  check("a hidden product: no notification", (await notesFor(hidden)).length === 0);
  const pendingOwner = await mk("pending", "artisan");
  const pendingShop = await mkShop(pendingOwner, "pending", "pending");
  const pendingProduct = await mkProduct(pendingShop, "Pending");
  await like(b1, pendingProduct);
  check("a shop that isn't live: no notification", (await notesFor(pendingProduct)).length === 0);
  check("a missing product → 404", (await call(`/products/${new mongoose.Types.ObjectId()}/like`, { method: "PUT", token: b1 })).status === 404);

  // ── deleting a product ──
  const gone = await mkProduct(shop, "Gone");
  await like(b1, gone);
  const goneId = gone._id;
  r = await call(`/products/${goneId}`, { method: "DELETE", token: otherT });
  check("(another artisan can't delete it)", r.status === 403, `${r.status}`);
  r = await call(`/products/${goneId}`, { method: "DELETE", token: ownerT });
  check("deleting a product removes its notification, so no link leads nowhere", r.status === 200 && (await notesFor(gone)).length === 0);
  check("…and its save marks", (await ProductSaveMark.countDocuments({ product: goneId })) === 0);

  // ── a notification failure doesn't break the favorite ──
  const quiet = console.error; console.error = () => {};
  const realCreate = ProductSaveMark.create;
  const realUpdate = Notification.updateOne;
  try {
    ProductSaveMark.create = async () => { throw new Error("simulated failure"); };
    await notifyProductSaved(second, buyers[5]._id);
    check("the helper doesn't throw when its records fail", true);
    ProductSaveMark.create = realCreate;
    Notification.updateOne = () => Promise.reject(new Error("simulated failure"));
    const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
    await likeProduct({ user: { id: String(buyers[6]._id), role: "buyer" }, params: { id: String(second._id) } }, res);
    check("the favorite still succeeds", res.statusCode === 200 && res.body.liked === true, JSON.stringify(res.body));
  } finally {
    ProductSaveMark.create = realCreate;
    Notification.updateOne = realUpdate;
    console.error = quiet;
  }
} finally {
  const users = (await User.find({ email: new RegExp(`^fav-test-.*-${tag}@test\\.invalid$`) }).select("_id")).map((u) => u._id);
  const shops = (await Artisan.find({ user: { $in: users } }).select("_id")).map((a) => a._id);
  const products = (await Product.find({ artisan: { $in: shops } }).select("_id")).map((p) => p._id);
  await ProductSaveMark.deleteMany({ product: { $in: products } });
  await Notification.deleteMany({ user: { $in: users } });
  await Product.deleteMany({ _id: { $in: products } });
  await Artisan.deleteMany({ _id: { $in: shops } });
  const { deletedCount } = await User.deleteMany({ _id: { $in: users } });
  console.log(`cleanup: removed ${deletedCount} test accounts, ${shops.length} shops, ${products.length} products`);
}
await stopTestEnv();
console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;

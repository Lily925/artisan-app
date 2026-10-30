// API tests for product photos (up to 5 per product).
// Run with the API running (npm run dev / npm start):  npm run test:photos
// Uses 2 sign-ups (the limit is 10 per hour per address; restarting the API resets it) and
// briefly puts one item in buyer@artisan.mn's cart (removed again). Everything it creates
// (photo-test-* accounts, their shops/products/photos, a test order) is deleted at the end,
// also when a check fails.
import { createRequire } from "module";
import crypto from "crypto";
import { API, STORAGE, PNG, JPG, WEBP, EXE, BIG_PNG, storedUrl, exists, served, count } from "./helpers.mjs";
const require = createRequire(import.meta.url);
require("dotenv").config();

let pass = 0, fail = 0;
const check = (n, ok, x = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${x ? "  — " + x : ""}`); };
const call = async (p, { method = "GET", token, json, form } = {}) => {
  const h = {}; if (token) h.Authorization = `Bearer ${token}`; if (json !== undefined) h["Content-Type"] = "application/json";
  const r = await fetch(API + p, { method, headers: h, body: form || (json !== undefined ? JSON.stringify(json) : undefined) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const uploadCount = () => count("products");
const allExist = async (urls) => (await Promise.all(urls.map(exists))).every(Boolean);
const noneExist = async (urls) => (await Promise.all(urls.map(exists))).every((x) => !x);
console.log(`Photo storage under test: ${STORAGE}`);
const productForm = (photos, extra = {}) => {
  const f = new FormData();
  const fields = { title: "TEST зураг", titleEn: "TEST photos", category: "crafts", description: "", price: "12.5", patronBonusMn: "", patronBonusEn: "", ...extra };
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  for (const [buf, type, name] of photos) f.append("photos", new Blob([buf], { type }), name);
  return f;
};

const tag = crypto.randomBytes(4).toString("hex");
const pw = crypto.randomBytes(12).toString("hex");
const created = { productIds: [], orderIds: [], files: [] };

async function makeArtisan(k) {
  const s = await call("/auth/signup", { method: "POST", json: { name: `Photo Test ${k}`, email: `photo-test-${k}-${tag}@test.invalid`, password: pw, role: "artisan" } });
  if (s.status !== 201) throw new Error(`sign-up failed: ${s.status} ${s.body.error}`);
  const setup = await call("/artisans/me", { method: "POST", token: s.body.token, json: { shopName: `Photo Test ${k} ${tag}` } });
  if (setup.status !== 201) throw new Error(`shop setup failed: ${setup.status} ${setup.body.error}`);
  return s.body.token;
}

async function cleanup() {
  const mongoose = require("mongoose");
  const connectDB = require("../src/config/db");
  const User = require("../src/models/User"), Artisan = require("../src/models/Artisan"), Product = require("../src/models/Product");
  const Order = require("../src/models/Order"), Cart = require("../src/models/Cart");
  const { deleteProductPhoto } = require("../src/utils/imageStorage");
  await connectDB();
  await Order.deleteMany({ _id: { $in: created.orderIds } });
  const users = await User.find({ email: new RegExp(`^photo-test-.*-${tag}@test\\.invalid$`) }).select("_id");
  const artisans = await Artisan.find({ user: { $in: users.map((u) => u._id) } }).select("_id");
  const products = await Product.find({ $or: [{ artisan: { $in: artisans.map((a) => a._id) } }, { _id: { $in: created.productIds } }] });
  for (const p of products) await Promise.all(p.images.map(deleteProductPhoto));
  await Promise.all(created.files.map(deleteProductPhoto)); // kept only for the deleted test order
  await Cart.updateMany({ "items.product": { $in: products.map((p) => p._id) } }, { $pull: { items: { product: { $in: products.map((p) => p._id) } } } });
  await Product.deleteMany({ _id: { $in: products.map((p) => p._id) } });
  await Artisan.deleteMany({ _id: { $in: artisans.map((a) => a._id) } });
  await Cart.deleteMany({ user: { $in: users.map((u) => u._id) } });
  const { deletedCount } = await User.deleteMany({ _id: { $in: users.map((u) => u._id) } });
  console.log(`cleanup: removed ${deletedCount} test accounts, ${products.length} test products and their photos, ${created.orderIds.length} test order(s)`);
  await mongoose.disconnect();
}

try {
  const owner = await makeArtisan("owner");
  const other = await makeArtisan("other");
  const login = async (email) => (await call("/auth/login", { method: "POST", json: { email, password: "artisan123" } })).body.token;
  const admin = await login("admin@artisan.mn");
  const buyer = await login("buyer@artisan.mn");
  const filesBefore = await uploadCount();

  // ── create ──
  let r = await call("/products", { method: "POST", token: owner, form: productForm([[PNG(), "image/png", "1.png"], [JPG(), "image/jpeg", "2.jpg"], [WEBP(), "image/webp", "3.webp"], [PNG(), "image/png", "4.png"], [JPG(), "image/jpeg", "5.jpg"]]) });
  check("create with 5 photos → 201", r.status === 201, `${r.status} ${r.body.error || ""}`);
  const p = r.body; created.productIds.push(p._id);
  check("5 photos stored in upload order, random names", p.images?.length === 5 && new Set(p.images).size === 5 && p.images.every((u) => storedUrl("products").test(u)) && p.images[2].endsWith(".webp"), p.images?.[0]);
  check("all 5 photos are served", (await Promise.all(p.images.map(served))).every(Boolean));
  check("5 new photos in storage", (await uploadCount()) === filesBefore + 5);

  const six = [1, 2, 3, 4, 5, 6].map((i) => [PNG(), "image/png", `${i}.png`]);
  r = await call("/products", { method: "POST", token: owner, form: productForm(six) });
  check("a 6th photo is refused (400)", r.status === 400 && /at most 5/.test(r.body.error), r.body.error);
  r = await call("/products", { method: "POST", token: owner, form: productForm([[BIG_PNG(), "image/png", "big.png"]]) });
  check("3 MB photo refused (400)", r.status === 400 && /2 MB/.test(r.body.error), r.body.error);
  r = await call("/products", { method: "POST", token: owner, form: productForm([[EXE(), "image/jpeg", "setup.jpg"]]) });
  check(".exe renamed to .jpg refused by signature (400)", r.status === 400 && /JPEG, PNG or WebP/.test(r.body.error), r.body.error);
  r = await call("/products", { method: "POST", token: owner, form: productForm([[PNG(), "image/png", "ok.png"], [EXE(), "image/jpeg", "setup.jpg"]]) });
  check("one bad file in a batch → nothing saved (400)", r.status === 400);
  r = await call("/products", { method: "POST", token: owner, form: productForm([[Buffer.from("hello"), "text/plain", "a.txt"]]) });
  check("text file refused (400)", r.status === 400, r.body.error);
  r = await call("/products", { method: "POST", token: owner, form: productForm([]) });
  check("no photo → 400", r.status === 400 && /at least one/.test(r.body.error), r.body.error);
  check("refused uploads left no photos behind", (await uploadCount()) === filesBefore + 5);

  // ── edit: reorder, remove, add ──
  const [a, b, c, d, e] = p.images;
  let f = productForm([[JPG(), "image/jpeg", "new.jpg"]], { imageOrder: JSON.stringify([e, "new:0", c, a]) });
  r = await call(`/products/${p._id}`, { method: "PUT", token: owner, form: f });
  check("edit: reorder + remove 2 + add 1 → 200", r.status === 200, `${r.status} ${r.body.error || ""}`);
  const after = r.body.images || [];
  check("new order: e, new, c, a (cover = e)", after.length === 4 && after[0] === e && after[2] === c && after[3] === a && storedUrl("products").test(after[1]) && ![a, b, c, d, e].includes(after[1]));
  check("removed photos deleted from storage", await noneExist([b, d]));
  check("kept and new photos still stored and served", (await allExist(after)) && (await Promise.all(after.map(served))).every(Boolean));
  check("no orphan photos", (await uploadCount()) === filesBefore + 4);

  r = await call(`/products/${p._id}`, { method: "PUT", token: owner, form: productForm([]) });
  check("edit without imageOrder/photos keeps photos", r.status === 200 && JSON.stringify(r.body.images) === JSON.stringify(after));
  for (const [label, order, files] of [
    ["someone else's photo URL", [after[0], "/images/products/silver-necklace.png"], []],
    ["a photo that wasn't uploaded", [after[0], "new:0"], []],
    ["the same photo twice", [after[0], after[0]], []],
    ["no photos at all", [], []],
    ["6 photos", [...after, "new:0", "new:1"], [[PNG(), "image/png", "x.png"], [PNG(), "image/png", "y.png"]]],
    ["an uploaded file left out of the order", [after[0]], [[PNG(), "image/png", "z.png"]]],
    ["not JSON", "nope", []],
  ]) {
    r = await call(`/products/${p._id}`, { method: "PUT", token: owner, form: productForm(files, { imageOrder: typeof order === "string" ? order : JSON.stringify(order) }) });
    check(`edit with ${label} → 400`, r.status === 400, r.body.error);
  }
  check("refused edits changed nothing", JSON.stringify((await call(`/products/${p._id}`)).body.images) === JSON.stringify(after) && (await uploadCount()) === filesBefore + 4);

  // ── who may change photos ──
  r = await call(`/products/${p._id}`, { method: "PUT", token: other, form: productForm([[PNG(), "image/png", "x.png"]], { imageOrder: JSON.stringify(["new:0"]) }) });
  check("another artisan can't change the photos (403)", r.status === 403);
  check("another artisan can't delete the product (403)", (await call(`/products/${p._id}`, { method: "DELETE", token: other })).status === 403);
  check("a buyer can't change the product (403)", (await call(`/products/${p._id}`, { method: "PUT", token: buyer, form: productForm([]) })).status === 403);
  check("no login → 401", (await call(`/products/${p._id}`, { method: "PUT", form: productForm([]) })).status === 401);
  const reversed = [...after].reverse();
  r = await call(`/products/${p._id}`, { method: "PUT", token: admin, form: productForm([], { imageOrder: JSON.stringify(reversed) }) });
  check("admin can reorder (200)", r.status === 200 && JSON.stringify(r.body.images) === JSON.stringify(reversed), `${r.status} ${r.body.error || ""}`);
  check("forbidden attempts left no photos", (await uploadCount()) === filesBefore + 4);

  // ── orders keep the cover as it was at purchase ──
  const mongoose = require("mongoose");
  const connectDB = require("../src/config/db");
  const Order = require("../src/models/Order"), User = require("../src/models/User"), Product = require("../src/models/Product");
  const { buildOrderFromCart } = require("../src/controllers/orderController");
  await connectDB();
  const buyerUser = await User.findOne({ email: "buyer@artisan.mn" }).select("_id");
  const cartBefore = (await call("/cart", { token: buyer })).body.items.length;
  await call("/cart", { method: "POST", token: buyer, json: { productId: p._id, tier: "basic", qty: 1 } });
  const built = await buildOrderFromCart(buyerUser._id);
  const line = built.items?.find((i) => String(i.product) === p._id);
  check("checkout snapshots the cover (items[].image)", line?.image === reversed[0], line?.image);
  await call("/cart", { method: "DELETE", token: buyer, json: { productId: p._id, tier: "basic" } });
  check("buyer's cart back to how it was", (await call("/cart", { token: buyer })).body.items.length === cartBefore);
  // A paid order made from that snapshot (as capture does), then the cover is removed.
  const order = await Order.create({ user: buyerUser._id, items: built.items.filter((i) => String(i.product) === p._id), subtotal: 12.5, commissionFee: 1.88, shipping: 12, total: 26.38, status: "paid" });
  created.orderIds.push(order._id);
  const oldCover = reversed[0];
  created.files.push(oldCover);
  r = await call(`/products/${p._id}`, { method: "PUT", token: owner, form: productForm([], { imageOrder: JSON.stringify(reversed.slice(1)) }) });
  check("cover removed from the product", r.status === 200 && !r.body.images.includes(oldCover));
  check("…but its photo stays, because an order shows it", await exists(oldCover));
  const detail = await call(`/orders/${order._id}`, { token: buyer });
  check("order page still shows the purchase-time cover", detail.status === 200 && detail.body.items?.[0]?.image === oldCover, detail.body.items?.[0]?.image);

  // ── old products keep working ──
  const pub = (await call("/products")).body;
  const seeded = pub.find((x) => x.titleEn === "Silver Necklace");
  check("existing single-photo products still list with 1 photo", seeded?.images?.length === 1);
  const legacy = await mongoose.connection.db.collection("products").insertOne({
    title: "TEST legacy", titleEn: "TEST legacy image", category: "crafts", artisan: (await Product.findById(p._id)).artisan,
    pricingTiers: { basic: { price: 5, label: "" }, story: { price: 6.5, label: "" }, patron: { price: 8.25, label: "" } },
    image: "/images/products/silver-necklace.png", likeCount: 0, createdAt: new Date(), updatedAt: new Date(),
  });
  created.productIds.push(String(legacy.insertedId));
  r = await call(`/products/${legacy.insertedId}`);
  check("a product with only the old `image` field reads as images[0]", r.status === 200 && JSON.stringify(r.body.images) === JSON.stringify(["/images/products/silver-necklace.png"]), JSON.stringify(r.body.images));

  // ── delete removes the photos ──
  const lastImages = (await call(`/products/${p._id}`)).body.images;
  r = await call(`/products/${p._id}`, { method: "DELETE", token: owner });
  check("owner deletes the product (200)", r.status === 200);
  check("its photos are deleted (except the one an order uses)", (await noneExist(lastImages)) && (await exists(oldCover)));
  await mongoose.disconnect();
} catch (err) {
  fail++;
  console.log("FAIL  test run stopped:", err.message);
} finally {
  await cleanup();
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;

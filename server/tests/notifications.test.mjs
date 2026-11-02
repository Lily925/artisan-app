// API tests for in-app notifications. Starts its own throwaway database and API (setup.mjs):  npm run test:notifications
// (also part of test:api). Accounts, shops and orders are created directly in the database,
// so no sign-ups are used, and everything is deleted at the end, also when a check fails.
// Two things need a stand-in and so run in this process, against the same database:
//  - PayPal (paid order, payout released): the real controller/util with a fake PayPal, so no
//    money or sandbox call is involved;
//  - "a notification failure doesn't break the request": Notification writes are made to fail.
import { API, connectDB, stopTestEnv } from "./setup.mjs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
import crypto from "crypto";
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("../src/models/User");
const Artisan = require("../src/models/Artisan");
const Product = require("../src/models/Product");
const Order = require("../src/models/Order");
const Checkout = require("../src/models/Checkout");
const Commission = require("../src/models/Commission");
const Notification = require("../src/models/Notification");
const paypal = require("../src/utils/paypal");
const payouts = require("../src/utils/payouts");
const { notify } = require("../src/utils/notify");
const { capturePaypalOrder } = require("../src/controllers/paymentController");
const commissions = require("../src/controllers/commissionController");
const orders = require("../src/controllers/orderController");

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
const email = (k) => `notif-test-${k}-${tag}@test.invalid`;
const login = async (k) => (await call("/auth/login", { method: "POST", json: { email: email(k), password: pw } })).body.token;
// Calls a controller directly, as Express would.
const run = async (controller, { user, params = {}, body = {} }) => {
  const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  await controller({ user: { id: String(user._id), role: user.role }, params, body, query: {} }, res);
  return res;
};
const notes = (user, type) => Notification.find({ user: user._id, ...(type && { type }) }).lean();

await connectDB();
const made = { shops: [], orders: [], commissions: [], checkouts: [] };
const realPaypal = { captureOrder: paypal.captureOrder, createPayout: paypal.createPayout, getPayoutBatch: paypal.getPayoutBatch };
const realInsertMany = Notification.insertMany;

try {
  const hash = await bcrypt.hash(pw, 10);
  const mkUser = (k, role) => User.create({ name: `Notif ${k}`, email: email(k), passwordHash: hash, role });
  const [admin, buyer, otherBuyer, artisanUser, otherArtisanUser, pendingUser] = await Promise.all([
    mkUser("admin", "admin"), mkUser("buyer", "buyer"), mkUser("otherbuyer", "buyer"),
    mkUser("artisan", "artisan"), mkUser("otherartisan", "artisan"), mkUser("pending", "artisan"),
  ]);
  const shop = await Artisan.create({ user: artisanUser._id, shopName: `Notif Shop ${tag}`, status: "approved", slug: `notif-shop-${tag}` });
  const otherShop = await Artisan.create({ user: otherArtisanUser._id, shopName: `Notif Other ${tag}`, status: "approved", slug: `notif-other-${tag}` });
  const pendingShop = await Artisan.create({ user: pendingUser._id, shopName: `Notif Pending ${tag}`, status: "pending", slug: `notif-pending-${tag}` });
  made.shops.push(shop._id, otherShop._id, pendingShop._id);

  const taken = await Product.distinct("category", { isHidden: { $ne: true } });
  const CATEGORIES = ["jewelry", "ceramics", "art", "textile", "crafts", "leather", "wood"];
  // A category no real shop sells in, so no real artisan is notified by these tests.
  const freeCategory = CATEGORIES.find((c) => !taken.includes(c)) || "wood";
  const anotherCategory = CATEGORIES.find((c) => c !== freeCategory); // no request is posted in this one
  const productDoc = (artisan, category) => ({
    title: "Туршилт", titleEn: `Notif ${tag}`, category, artisan: artisan._id, images: ["/images/x.png"],
    pricingTiers: { basic: { price: 10 }, story: { price: 12 }, patron: { price: 15 } },
  });
  const product = await Product.create(productDoc(shop, freeCategory));
  await Product.create(productDoc(otherShop, anotherCategory));
  await Product.create(productDoc(pendingShop, freeCategory)); // not live: must not be matched

  const [adminToken, buyerToken, otherBuyerToken, artisanToken, otherArtisanToken] = await Promise.all(
    ["admin", "buyer", "otherbuyer", "artisan", "otherartisan"].map(login));

  // ── access ──
  check("no login → 401", (await call("/notifications")).status === 401);
  check("mark all without login → 401", (await call("/notifications/read-all", { method: "POST" })).status === 401);
  let r = await call("/notifications", { token: buyerToken });
  check("a new user has none", r.status === 200 && r.body.items.length === 0 && r.body.unreadCount === 0, r.text);

  // ── new commission request → matching artisans only ──
  r = await call("/commissions", { method: "POST", token: buyerToken, json: { category: freeCategory, description: `notif test ${tag}` } });
  check("buyer posts a commission request", r.status === 201, `${r.status} ${r.body.error || ""}`);
  const commissionId = r.body._id; made.commissions.push(commissionId);
  const matched = await Notification.find({ type: "commission_match", "params.commissionId": commissionId }).lean();
  check("exactly the one live shop in that category is told", matched.length === 1 && String(matched[0].user) === String(artisanUser._id), matched.map((n) => n.user).join());
  check("…not a shop in another category, a pending shop, or the buyer", (await notes(otherArtisanUser, "commission_match")).length === 0 && (await notes(pendingUser, "commission_match")).length === 0 && (await notes(buyer, "commission_match")).length === 0);
  check("…with the category and link, and no buyer details", matched[0]?.params.category === freeCategory && matched[0]?.link === "/commission-board" && !JSON.stringify(matched[0]).includes("Notif buyer"));

  // ── new offer → the request's buyer only ──
  r = await call(`/commissions/${commissionId}/bids`, { method: "POST", token: artisanToken, json: { price: 20, message: "I can make it" } });
  check("artisan sends an offer", r.status === 201, `${r.status} ${r.body.error || ""}`);
  const offers = await Notification.find({ type: "offer_received", "params.commissionId": commissionId }).lean();
  check("the buyer alone gets the offer", offers.length === 1 && String(offers[0].user) === String(buyer._id));
  check("…with the shop name and link", offers[0]?.params.shopName === shop.shopName && offers[0]?.link === "/my-commissions");

  // ── order steps (no payout email, so no PayPal call) ──
  const orderDoc = (over = {}) => ({
    user: buyer._id, status: "paid", subtotal: 10, commissionFee: 1.5, shipping: 12, total: 23.5,
    items: [{ product: product._id, artisan: shop._id, title: "Туршилт", tier: "basic", unitPrice: 10, qty: 2 }],
    statusHistory: [{ status: "paid", at: new Date() }],
    shippingAddress: { name: "Secret Name", address: "Secret Street 1", city: "UB", country: "MN", phone: "+97699112233" },
    payment: { provider: "paypal", capturedAt: new Date() }, ...over,
  });
  const order = await Order.create(orderDoc()); made.orders.push(order._id);
  const buyerStatus = async (type) => Notification.find({ user: buyer._id, type, "params.orderId": String(order._id) }).lean();

  r = await call(`/orders/${order._id}/status`, { method: "PUT", token: artisanToken, json: { status: "in_production" } });
  check("order → in production", r.status === 200, `${r.status} ${r.body.error || ""}`);
  let n = await buyerStatus("order_in_production");
  check("buyer told: in production, with link to the order", n.length === 1 && n[0].link === `/orders/${order._id}` && n[0].params.shopName === shop.shopName);
  r = await call(`/orders/${order._id}/status`, { method: "PUT", token: artisanToken, json: { status: "in_production" } });
  check("a repeated step is refused and doesn't notify again", r.status === 409 && (await buyerStatus("order_in_production")).length === 1);

  await call(`/orders/${order._id}/status`, { method: "PUT", token: artisanToken, json: { status: "shipped" } });
  check("buyer told: shipped", (await buyerStatus("order_shipped")).length === 1);

  r = await call(`/orders/${order._id}/status`, { method: "PUT", token: buyerToken, json: { status: "completed" } });
  check("buyer confirms receipt", r.status === 200, `${r.status} ${r.body.error || ""}`);
  check("buyer told: completed", (await buyerStatus("order_completed")).length === 1);
  n = await Notification.find({ type: "order_confirmed", "params.orderId": String(order._id) }).lean();
  check("the shop's artisan alone told: receipt confirmed", n.length === 1 && String(n[0].user) === String(artisanUser._id));
  check("other users got nothing about this order", (await Notification.countDocuments({ user: { $in: [otherBuyer._id, otherArtisanUser._id, admin._id] }, "params.orderId": String(order._id) })) === 0);

  const orderNotes = await Notification.find({ "params.orderId": String(order._id) }).lean();
  check("no address, phone or buyer name in any order notification", !/Secret|\+976|Notif buyer/.test(JSON.stringify(orderNotes)));

  // ── new paid order (real capture code, fake PayPal) ──
  const paypalOrderId = `TEST-${tag}`;
  const checkout = await Checkout.create({
    user: buyer._id, paypalOrderId, currency: "USD", subtotal: 10, commissionFee: 1.5, shipping: 12, total: 23.5,
    items: [{ product: product._id, artisan: shop._id, title: "Туршилт", tier: "basic", unitPrice: 10, qty: 3 }],
    shippingAddress: orderDoc().shippingAddress,
  });
  made.checkouts.push(checkout._id);
  const captured = { status: "COMPLETED", purchase_units: [{ payments: { captures: [{ id: "CAP", status: "COMPLETED", amount: { currency_code: "USD", value: "23.50" } }] } }] };
  paypal.captureOrder = async () => captured;
  let res = await run(capturePaypalOrder, { user: buyer, params: { id: paypalOrderId } });
  check("capture creates the paid order", res.statusCode === 201 && Boolean(res.body.orderId), `${res.statusCode} ${JSON.stringify(res.body)}`);
  const paidOrderId = String(res.body.orderId); made.orders.push(paidOrderId);
  n = await Notification.find({ type: "order_paid", "params.orderId": paidOrderId }).lean();
  check("the shop's artisan alone told about the paid order", n.length === 1 && String(n[0].user) === String(artisanUser._id) && n[0].params.units === 3);
  res = await run(capturePaypalOrder, { user: buyer, params: { id: paypalOrderId } });
  check("capturing again doesn't notify again", res.body.alreadyCaptured === true && (await Notification.countDocuments({ type: "order_paid", "params.orderId": paidOrderId })) === 1);

  // ── payout part released (real payout code, fake PayPal) ──
  await Artisan.updateOne({ _id: shop._id }, { $set: { payoutEmail: `payout-${tag}@test.invalid` } });
  paypal.createPayout = async () => ({ batch_header: { payout_batch_id: `BATCH-${crypto.randomBytes(4).toString("hex")}`, batch_status: "PENDING" } });
  paypal.getPayoutBatch = async () => ({ batch_header: { batch_status: "PENDING" }, items: [{ transaction_status: "PENDING" }] });
  await Order.updateOne({ _id: paidOrderId }, { $set: { status: "in_production" } });
  await payouts.processOrderReleases(paidOrderId);
  n = await Notification.find({ type: "payout_released", "params.orderId": paidOrderId }).lean();
  const paidOrder = await Order.findById(paidOrderId);
  check("the artisan alone told about the released part, with amount and percent", n.length === 1 && String(n[0].user) === String(artisanUser._id) && n[0].params.percent === 30 && n[0].params.amount === paidOrder.releases[0].amount, JSON.stringify(n[0]?.params));
  check("the payout email isn't in it", !JSON.stringify(n).includes("payout-"));
  await payouts.processOrderReleases(paidOrderId);
  check("processing again doesn't notify again", (await Notification.countDocuments({ type: "payout_released", "params.orderId": paidOrderId })) === 1);
  await Order.updateOne({ _id: paidOrderId }, { $set: { status: "shipped" } });
  await payouts.processOrderReleases(paidOrderId);
  check("the next milestone gives one more", (await Notification.countDocuments({ type: "payout_released", "params.orderId": paidOrderId })) === 2);
  paypal.createPayout = async () => { throw new paypal.PayPalError("no", 500, { issue: "INTERNAL" }); };
  await Order.updateOne({ _id: paidOrderId }, { $set: { status: "completed" } });
  await payouts.processOrderReleases(paidOrderId);
  check("a payout PayPal refuses isn't announced as released", (await Notification.countDocuments({ type: "payout_released", "params.orderId": paidOrderId })) === 2);

  // ── shop status ──
  const statusFor = (type) => Notification.find({ user: pendingUser._id, type }).lean();
  r = await call(`/admin/shops/${pendingShop._id}/reject`, { method: "PUT", token: adminToken, json: { reason: "Please add photos." } });
  n = await statusFor("shop_rejected");
  check("rejected: owner told, with the reason", r.status === 200 && n.length === 1 && n[0].params.reason === "Please add photos." && n[0].link === "/profile");
  r = await call(`/admin/shops/${pendingShop._id}/approve`, { method: "PUT", token: adminToken });
  check("approved: owner told", r.status === 200 && (await statusFor("shop_approved")).length === 1);
  r = await call(`/admin/shops/${pendingShop._id}/suspend`, { method: "PUT", token: adminToken, json: { reason: "Reported." } });
  check("suspended: owner told", r.status === 200 && (await statusFor("shop_suspended")).length === 1);
  r = await call(`/admin/shops/${pendingShop._id}/unsuspend`, { method: "PUT", token: adminToken });
  check("unsuspended: owner told it's live again", r.status === 200 && (await statusFor("shop_approved")).length === 2);
  check("a refused change doesn't notify", (await call(`/admin/shops/${pendingShop._id}/approve`, { method: "PUT", token: adminToken })).status === 409 && (await statusFor("shop_approved")).length === 2);
  check("no other artisan was told", (await Notification.countDocuments({ user: otherArtisanUser._id, type: /^shop_/ })) === 0);

  // ── new shop waiting → admins (sign-up route: uses "Set up your shop", no sign-up used) ──
  const noShopUser = await mkUser("noshop", "artisan");
  const noShopToken = await login("noshop");
  r = await call("/artisans/me", { method: "POST", token: noShopToken, json: { shopName: `Notif New ${tag}` } });
  check("artisan sets up a shop", r.status === 201, `${r.status} ${r.body.error || ""}`);
  made.shops.push(r.body._id);
  n = await Notification.find({ type: "shop_pending", "params.shopId": r.body._id }).lean();
  const adminUsers = (await User.find({ role: "admin" }).select("_id")).map((u) => String(u._id));
  check("every admin, and nobody else, is told a shop is waiting", n.length === adminUsers.length && n.every((x) => adminUsers.includes(String(x.user))));
  check("…with name and link, no email", n[0]?.params.shopName === `Notif New ${tag}` && n[0]?.link === "/admin/shops" && !JSON.stringify(n).includes("@"));

  // ── the helper keeps only what a type allows ──
  await notify(otherBuyer._id, "order_shipped", { orderId: "x", shopName: "S", email: "leak@test.invalid", phone: "99112233", address: "Street" }, "/orders/x");
  const [cleaned] = await notes(otherBuyer, "order_shipped");
  check("params not allowed for the type are dropped", cleaned && !cleaned.params.email && !cleaned.params.phone && !cleaned.params.address && cleaned.params.shopName === "S", JSON.stringify(cleaned?.params));
  await notify(otherBuyer._id, "made_up_type", {});
  check("an unknown type stores nothing and doesn't throw", (await notes(otherBuyer, "made_up_type")).length === 0);

  // ── reading and marking ──
  const unreadOf = async (t) => (await call("/notifications", { token: t })).body.unreadCount;
  const list = (await call("/notifications", { token: buyerToken })).body;
  const buyerCount = await Notification.countDocuments({ user: buyer._id });
  check("buyer's unread count matches", list.unreadCount === buyerCount && buyerCount > 0, `${list.unreadCount} / ${buyerCount}`);
  check("buyer's list holds only their own, newest first", list.items.length === buyerCount && list.items.every((x, i, a) => i === 0 || new Date(a[i - 1].createdAt) >= new Date(x.createdAt)));
  check("items have no user id or database fields", list.items.every((x) => !("user" in x) && !("_id" in x) && x.id && x.type && "params" in x && "link" in x && x.readAt === null));

  const mine = list.items[0];
  check("someone else can't mark it read → 404", (await call(`/notifications/${mine.id}/read`, { method: "POST", token: otherBuyerToken })).status === 404);
  check("…not even an artisan or admin", (await call(`/notifications/${mine.id}/read`, { method: "POST", token: artisanToken })).status === 404 && (await call(`/notifications/${mine.id}/read`, { method: "POST", token: adminToken })).status === 404);
  check("…and it stays unread", (await Notification.findById(mine.id)).readAt === null);
  check("nobody else's list shows it", !(await call("/notifications", { token: otherBuyerToken })).body.items.some((x) => x.id === mine.id));
  check("a bad id → 404", (await call("/notifications/not-an-id/read", { method: "POST", token: buyerToken })).status === 404);
  check("a missing id → 404", (await call(`/notifications/${new mongoose.Types.ObjectId()}/read`, { method: "POST", token: buyerToken })).status === 404);

  r = await call(`/notifications/${mine.id}/read`, { method: "POST", token: buyerToken });
  check("read one: marked, count one lower", r.status === 200 && Boolean(r.body.notification.readAt) && r.body.unreadCount === buyerCount - 1, r.text);
  const firstReadAt = r.body.notification.readAt;
  r = await call(`/notifications/${mine.id}/read`, { method: "POST", token: buyerToken });
  check("reading it twice changes nothing", r.status === 200 && r.body.notification.readAt === firstReadAt && r.body.unreadCount === buyerCount - 1);

  const artisanBefore = await unreadOf(artisanToken);
  r = await call("/notifications/read-all", { method: "POST", token: buyerToken });
  check("read all: count 0", r.status === 200 && r.body.unreadCount === 0 && (await unreadOf(buyerToken)) === 0);
  check("read all leaves other users' alone", (await unreadOf(artisanToken)) === artisanBefore && artisanBefore > 0);

  // ── latest 30, but the count covers everything ──
  await Notification.insertMany(Array.from({ length: 35 }, (_, i) => ({ user: otherArtisanUser._id, type: "order_shipped", params: { i }, createdAt: new Date(Date.now() - i * 1000) })));
  r = await call("/notifications", { token: otherArtisanToken });
  check("list is capped at 30, unread count isn't", r.body.items.length === 30 && r.body.unreadCount === 35, `${r.body.items.length} ${r.body.unreadCount}`);

  // ── a notification failure doesn't break the main request ──
  const quiet = console.error; console.error = () => {};
  Notification.insertMany = async () => { throw new Error("simulated database failure"); };
  try {
    await notify(buyer._id, "order_shipped", {});
    check("the helper itself doesn't throw", true);
    await notify(async () => { throw new Error("lookup failed"); }, "shop_pending", {});
    check("…nor when looking up recipients fails", true);

    let result = await run(commissions.createCommission, { user: buyer, body: { category: freeCategory, description: `fail test ${tag}` } });
    check("new commission request still succeeds", result.statusCode === 201 && Boolean(result.body._id), `${result.statusCode}`);
    made.commissions.push(result.body._id);
    result = await run(commissions.submitBid, { user: artisanUser, params: { id: String(result.body._id) }, body: { price: 15 } });
    check("offer still succeeds", result.statusCode === 201, `${result.statusCode}`);

    const failOrder = await Order.create(orderDoc({ payment: undefined })); made.orders.push(failOrder._id);
    result = await run(orders.advanceOrder, { user: artisanUser, params: { id: String(failOrder._id) }, body: { status: "in_production" } });
    check("order step still succeeds", result.statusCode === 200 && result.body.status === "in_production", `${result.statusCode} ${result.body?.status}`);

    const failCheckout = await Checkout.create({
      user: buyer._id, paypalOrderId: `TEST-F-${tag}`, currency: "USD", subtotal: 10, commissionFee: 1.5, shipping: 12, total: 23.5,
      items: [{ product: product._id, artisan: shop._id, title: "Туршилт", tier: "basic", unitPrice: 10, qty: 1 }],
    });
    made.checkouts.push(failCheckout._id);
    result = await run(capturePaypalOrder, { user: buyer, params: { id: `TEST-F-${tag}` } });
    check("paid order is still created", result.statusCode === 201 && Boolean(result.body.orderId), `${result.statusCode}`);
    if (result.body.orderId) made.orders.push(result.body.orderId);
  } finally {
    Notification.insertMany = realInsertMany;
    console.error = quiet;
  }

  // ── rate limit (last: it uses up this user's allowance for a minute) ──
  let limited = null;
  for (let i = 0; i < 130 && !limited; i++) {
    const hit = await call("/notifications/read-all", { method: "POST", token: otherBuyerToken });
    if (hit.status === 429) limited = hit;
  }
  check("too many requests → 429", limited?.body.code === "RATE_LIMITED", limited ? "" : "never limited");
  check("…for that user only", (await call("/notifications/read-all", { method: "POST", token: buyerToken })).status === 200);
} finally {
  Object.assign(paypal, realPaypal);
  Notification.insertMany = realInsertMany;
  const users = (await User.find({ email: new RegExp(`^notif-test-.*-${tag}@test\\.invalid$`) }).select("_id")).map((u) => u._id);
  const shops = (await Artisan.find({ user: { $in: users } }).select("_id")).map((a) => a._id);
  // Admins outside this test (real ones) may have been told about a test shop too.
  await Notification.deleteMany({ $or: [
    { user: { $in: users } },
    { "params.shopId": { $in: shops.map(String) } },
    { "params.commissionId": { $in: made.commissions.map(String) } },
    { "params.orderId": { $in: made.orders.map(String) } },
  ] });
  await Order.deleteMany({ _id: { $in: made.orders } });
  await Checkout.deleteMany({ _id: { $in: made.checkouts } });
  await Commission.deleteMany({ _id: { $in: made.commissions } });
  await Product.deleteMany({ artisan: { $in: shops } });
  await Artisan.deleteMany({ _id: { $in: shops } });
  const { deletedCount } = await User.deleteMany({ _id: { $in: users } });
  console.log(`cleanup: removed ${deletedCount} test accounts, ${shops.length} shops, ${made.orders.length} orders`);
  await mongoose.disconnect();
}
await stopTestEnv();
console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;

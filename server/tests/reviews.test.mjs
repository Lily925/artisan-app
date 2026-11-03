// API tests for verified reviews. Starts its own throwaway database and API (setup.mjs):
//   npm run test:reviews (also part of test:api).
// Accounts, shops, products and orders are created directly in the database.
import { API, connectDB, stopTestEnv, PNG, EXE, BIG_PNG, exists, count, storedUrl } from "./helpers.mjs";
import { createRequire } from "module";
import crypto from "crypto";
const require = createRequire(import.meta.url);
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("../src/models/User");
const Artisan = require("../src/models/Artisan");
const Product = require("../src/models/Product");
const Order = require("../src/models/Order");
const Review = require("../src/models/Review");
const Notification = require("../src/models/Notification");
const { displayNameOf } = require("../src/utils/reviews");

let pass = 0, fail = 0;
const check = (n, ok, x = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${x ? "  — " + x : ""}`); };
const send = async (path, { method = "GET", token, json, form } = {}) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (json !== undefined) headers["Content-Type"] = "application/json";
  const r = await fetch(API + path, { method, headers, body: form || (json !== undefined ? JSON.stringify(json) : undefined) });
  const text = await r.text();
  let body = {}; try { body = JSON.parse(text); } catch {}
  return { status: r.status, body, text };
};
const formOf = (fields, files = []) => {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, String(v));
  files.forEach(({ data, type = "image/png", name = "photo.png" }) => form.append("photos", new Blob([data], { type }), name));
  return form;
};
const tag = crypto.randomBytes(4).toString("hex");
const pw = crypto.randomBytes(12).toString("hex");
const email = (k) => `rev-test-${k}-${tag}@test.invalid`;
const SECRET_PHONE = "+97699112233";
const SECRET_STREET = "Secret Street 42";

await connectDB();

try {
  const hash = await bcrypt.hash(pw, 10);
  const account = async (k, role = "buyer", name = `Tuya${k} Secretsurname`) => {
    const user = await User.create({ name, email: email(k), passwordHash: hash, role });
    const token = (await send("/auth/login", { method: "POST", json: { email: email(k), password: pw } })).body.token;
    return { user, token };
  };
  const owner = await account("owner", "artisan");
  const otherOwner = await account("other", "artisan");
  const admin = await account("admin", "admin");
  const buyer = await account("b1");
  const buyer2 = await account("b2");
  const buyer3 = await account("b3");
  const limited = await account("lim");
  // Each uses up part of the 10-attempt limit, so the checks that are refused get their own buyers.
  const gate = await account("gate");
  const validator = await account("val");
  const photoChecker = await account("pho");

  const shop = await Artisan.create({ user: owner.user._id, shopName: `Rev Shop ${tag}`, slug: `rev-shop-${tag}`, status: "approved" });
  const otherShop = await Artisan.create({ user: otherOwner.user._id, shopName: `Other ${tag}`, slug: `other-${tag}`, status: "approved" });
  const mkProduct = (artisan, name, over = {}) => Product.create({
    title: `${name} мн`, titleEn: name, category: "textile", artisan: artisan._id, images: ["/images/x.png"],
    pricingTiers: { basic: { price: 10 }, story: { price: 12 }, patron: { price: 15 } }, ...over,
  });
  const product = await mkProduct(shop, "Boots");
  const second = await mkProduct(shop, "Hat");
  const otherProduct = await mkProduct(otherShop, "Bag");
  // Paid through PayPal by default, and Completed just now if it's completed.
  const PAID = () => ({ provider: "paypal", captureId: "CAPTURE-1", amount: 23.5, currency: "USD", capturedAt: new Date() });
  const daysAgo = (days) => new Date(Date.now() - days * 86400000);
  const mkOrder = (who, status, products = [product], artisan = shop, over = {}) => Order.create({
    payment: PAID(), statusHistory: status === "completed" ? [{ status: "completed", at: new Date() }] : [],
    user: who.user._id, status, subtotal: 10, commissionFee: 1.5, shipping: 12, total: 23.5,
    items: products.map((p) => ({ product: p._id, artisan: artisan._id, title: p.title, tier: "basic", unitPrice: 10, qty: 1 })),
    shippingAddress: { name: "Secret Recipient", address: SECRET_STREET, city: "UB", country: "MN", phone: SECRET_PHONE },
    ...over,
  });
  const write = (who, order, fields = {}, files = [], itemIndex = 0) => send("/reviews", { method: "POST", token: who.token, form: formOf({ orderId: order._id, itemIndex, rating: 5, ...fields }, files) });
  const edit = (who, id, fields = {}, files = []) => send(`/reviews/${id}`, { method: "PUT", token: who.token, form: formOf({ rating: 4, ...fields }, files) });
  const age = async (id, days) => {
    const { modifiedCount } = await Review.collection.updateOne({ _id: new mongoose.Types.ObjectId(id) }, { $set: { createdAt: new Date(Date.now() - days * 86400000) } });
    if (modifiedCount !== 1) throw new Error("the review wasn't aged");
  };
  const rating = async (Model, doc) => { const d = await Model.findById(doc._id).select("ratingAvg ratingCount").lean(); return [d.ratingAvg, d.ratingCount]; };
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const publicList = (p = product, opts = {}, query = "") => send(`/products/${p._id}/reviews${query}`, opts);

  // ── who can review ──
  const completed = await mkOrder(buyer, "completed", [product, second]);
  check("no login → 401", (await send("/reviews", { method: "POST", form: formOf({ orderId: completed._id, itemIndex: 0, rating: 5 }) })).status === 401);

  for (const status of ["pending", "paid", "in_production", "shipped", "cancelled"]) {
    const order = await mkOrder(gate, status);
    const r = await write(gate, order);
    check(`can't review before Completed: ${status} → 409`, r.status === 409 && r.body.code === "ORDER_NOT_COMPLETED", `${r.status} ${r.body.code}`);
  }
  check("…no review was stored", (await Review.countDocuments()) === 0);

  let r = await write(buyer2, completed);
  check("someone else's order → 404, same as a missing one", r.status === 404 && r.body.code === "ORDER_NOT_FOUND", `${r.status}`);
  r = await write(otherOwner, completed);
  check("another artisan on someone's order → 404", r.status === 404);
  r = await write(owner, completed);
  check("the shop's artisan on a buyer's order → 404", r.status === 404);
  r = await write(admin, completed);
  check("an admin on a buyer's order → 404", r.status === 404);
  r = await write(gate, await mkOrder(gate, "completed"), { itemIndex: 7 });
  check("an item the order doesn't have → 404", r.status === 404);
  r = await send("/reviews", { method: "POST", token: gate.token, form: formOf({ orderId: "not-an-id", itemIndex: 0, rating: 5 }) });
  check("a malformed order id → 400", r.status === 400);

  const ownOrder = await mkOrder(owner, "completed");
  r = await write(owner, ownOrder);
  check("your own shop's product → 403 OWN_PRODUCT", r.status === 403 && r.body.code === "OWN_PRODUCT", `${r.status} ${r.body.code}`);
  const artisanBuys = await mkOrder(otherOwner, "completed");
  r = await write(otherOwner, artisanBuys);
  check("an artisan can review what they bought from another shop", r.status === 201, r.text);
  await Review.deleteOne({ _id: r.body.id });

  // ── validation ──
  const validationOrder = await mkOrder(validator, "completed");
  for (const bad of ["0", "6", "4.5", "abc", ""]) {
    r = await write(validator, validationOrder, { rating: bad });
    check(`rating "${bad}" → 400 BAD_RATING`, r.status === 400 && r.body.code === "BAD_RATING", `${r.status}`);
  }
  r = await send("/reviews", { method: "POST", token: validator.token, form: formOf({ orderId: validationOrder._id, itemIndex: 0 }) });
  check("no rating → 400", r.status === 400 && r.body.code === "BAD_RATING");
  r = await write(validator, validationOrder, { comment: "x".repeat(1001) });
  check("a 1001-character comment → 400", r.status === 400 && r.body.code === "COMMENT_TOO_LONG");

  // ── photos: same rules as product photos ──
  const photosBefore = count("reviews");
  const photoOrder = await mkOrder(photoChecker, "completed");
  r = await write(photoChecker, photoOrder, {}, [{ data: PNG() }, { data: PNG() }, { data: PNG() }, { data: PNG() }]);
  check("a 4th photo → 400", r.status === 400, r.text);
  r = await write(photoChecker, photoOrder, {}, [{ data: EXE() }]);
  check("a renamed .exe → 400", r.status === 400, r.text);
  r = await write(photoChecker, photoOrder, {}, [{ data: BIG_PNG() }]);
  check("a 3 MB photo → 400 PHOTO_TOO_BIG", r.status === 400 && r.body.code === "PHOTO_TOO_BIG", r.text);
  r = await write(photoChecker, photoOrder, {}, [{ data: Buffer.from("just text, not a picture at all"), type: "text/plain", name: "a.txt" }]);
  check("a text file → 400 PHOTO_TYPE", r.status === 400 && r.body.code === "PHOTO_TYPE", r.text);
  check("…none of those stored a file", count("reviews") === photosBefore);

  // ── writing one ──
  const html = '<img src=x onerror="alert(1)"> Great\u0000\u0007 boots  ';
  const notesBefore = await Notification.countDocuments({ user: owner.user._id, type: "review_received" });
  r = await write(buyer, completed, { rating: 5, comment: html }, [{ data: PNG() }, { data: PNG() }]);
  check("the buyer of a Completed order can review", r.status === 201, r.text);
  const reviewId = r.body.id;
  const firstPhotos = r.body.photos;
  check("2 photos stored through the shared helper", firstPhotos?.length === 2 && firstPhotos.every((u) => storedUrl("reviews").test(u)), JSON.stringify(firstPhotos));
  check("…and served", await exists(firstPhotos[0]));
  check("text cleaned like chat: control characters gone, ends trimmed, HTML left as plain text", r.body.comment === '<img src=x onerror="alert(1)"> Great boots', JSON.stringify(r.body.comment));
  check("the same item can't be reviewed twice → 409", (await write(buyer, completed)).body.code === "ALREADY_REVIEWED");
  const twoAtOnce = await mkOrder(buyer3, "completed");
  const both = await Promise.all([write(buyer3, twoAtOnce, { rating: 3 }), write(buyer3, twoAtOnce, { rating: 3 })]);
  check("two at once: one succeeds, one is refused", both.filter((x) => x.status === 201).length === 1 && both.filter((x) => x.status === 409).length === 1, both.map((x) => x.status).join());
  r = await write(buyer, completed, { rating: 3 }, [], 1);
  check("the order's other item has its own review", r.status === 201 && r.body.rating === 3, r.text);
  const secondItemReview = r.body.id;

  // ── notifications ──
  const notes = await Notification.find({ user: owner.user._id, type: "review_received" }).sort({ createdAt: 1, _id: 1 }).lean();
  check("the artisan is notified of a new review", notes.length - notesBefore >= 1);
  const note = notes.find((n) => n.params.productId === String(product._id));
  check("…linking to the new product route", note?.link === `/product/${product._id}#reviews`, note?.link);
  const noteText = JSON.stringify(note);
  check("…with no comment or personal data", !/Great|Tuya|Secretsurname|test\.invalid|Secret Street|97699/.test(noteText), noteText);
  check("…only the allowed fields", same(Object.keys(note.params).sort(), ["productId", "rating", "title", "titleEn"]), Object.keys(note.params).join());

  // ── what the public sees ──
  r = await publicList();
  check("logged-out visitors can read reviews", r.status === 200 && r.body.reviews.length === 2, r.text);
  const shown = r.body.reviews.find((x) => x.id === reviewId);
  check('"Verified purchase" flag on every review', r.body.reviews.every((x) => x.verified === true));
  check("only the first name is shown", shown.displayName === "Tuyab1", shown.displayName);
  for (const [what, pattern] of [["surname", /Secretsurname/], ["email", /test\.invalid/], ["phone", /97699/], ["address", /Secret Street/], ["recipient", /Secret Recipient/], ["buyer id", new RegExp(String(buyer.user._id))], ["order id", new RegExp(String(completed._id))]]) {
    check(`the public response has no ${what}`, !pattern.test(r.text));
  }
  check("no buyer/order fields at all", !["buyer", "order", "itemIndex", "own", "hiddenBy"].some((k) => k in shown), Object.keys(shown).join());
  check("a visitor's list doesn't mark it as theirs", shown.mine === false && shown.canReply === false);
  r = await publicList(product, { token: buyer2.token });
  check("another buyer gets no way to edit it", !("own" in r.body.reviews[0]) && !r.text.includes(String(completed._id)));
  r = await publicList(product, { token: buyer.token });
  const mine = r.body.reviews.find((x) => x.id === reviewId);
  check("its buyer gets the way to edit it", mine.mine === true && String(mine.own.orderId) === String(completed._id) && mine.own.editable === true);

  // ── display names ──
  check("display name: first word", displayNameOf("  Bat  Dorj ") === "Bat");
  check("display name: an email used as a name is dropped", displayNameOf("bat@mail.test is me") === "");
  check("display name: a phone number used as a name is dropped", displayNameOf("99112233 Bat") === "");
  check("display name: nothing", displayNameOf("") === "" && displayNameOf(undefined) === "");

  // ── averages ──
  check("product average and count", same(await rating(Product, product), [4, 2]), JSON.stringify(await rating(Product, product)));
  check("the other item's product has its own", same(await rating(Product, second), [3, 1]), JSON.stringify(await rating(Product, second)));
  check("shop average covers all its products", same(await rating(Artisan, shop), [3.67, 3]), JSON.stringify(await rating(Artisan, shop)));
  check("another shop is untouched", same(await rating(Artisan, otherShop), [0, 0]));
  r = await send(`/products/${product._id}`);
  check("the product API returns them", r.body.ratingAvg === 4 && r.body.ratingCount === 2, r.text.slice(0, 80));
  r = await send("/products");
  check("the catalog returns them, for product cards", r.body.find((p) => p._id === String(product._id))?.ratingCount === 2);
  r = await send(`/artisans/${shop.slug}`);
  check("the shop API returns them", r.body.ratingCount === 3 && r.body.ratingAvg === 3.67, JSON.stringify([r.body.ratingAvg, r.body.ratingCount]));
  r = await publicList();
  check("breakdown 5 to 1", same(r.body.summary.breakdown, { 1: 0, 2: 0, 3: 1, 4: 0, 5: 1 }), JSON.stringify(r.body.summary));
  check("summary average and count", r.body.summary.average === 4 && r.body.summary.count === 2);

  // ── order history ──
  const fresh = await mkOrder(buyer2, "completed", [product, second]);
  r = await send("/orders", { token: buyer2.token });
  check('order list: "Write a review" points at the first open item', r.body.find((o) => o._id === String(fresh._id))?.nextReviewItem === 0);
  r = await send("/orders", { token: buyer.token });
  check("…null once every item is reviewed", r.body.find((o) => o._id === String(completed._id))?.nextReviewItem === null);
  check("…null on an order that isn't Completed", r.body.filter((o) => o.status !== "completed").every((o) => o.nextReviewItem === null));
  r = await send(`/orders/${completed._id}`, { token: buyer.token });
  check("order page: the buyer sees their review on the item", r.body.items[0].reviewState.review.id === reviewId && r.body.items[0].reviewState.canReview === false);
  r = await send(`/orders/${fresh._id}`, { token: buyer2.token });
  check("order page: an open item can be reviewed", r.body.items[0].reviewState.canReview === true);
  r = await send(`/orders/${completed._id}`, { token: owner.token });
  check("order page: the artisan gets no review state", r.status === 200 && !("reviewState" in r.body.items[0]));
  r = await send(`/orders/${ownOrder._id}`, { token: owner.token });
  check("order page: your own product can't be reviewed", r.body.items[0].reviewState.block === "OWN_PRODUCT");

  // ── edit window ──
  r = await edit(buyer, reviewId, { rating: 2, comment: "Changed my mind", keepPhotos: JSON.stringify([firstPhotos[0]]) }, [{ data: PNG() }, { data: PNG() }]);
  check("the buyer can edit within 14 days", r.status === 200 && r.body.rating === 2 && r.body.comment === "Changed my mind" && r.body.photos.length === 3, r.text);
  check("…a removed photo is deleted from storage", !(await exists(firstPhotos[1])) && await exists(firstPhotos[0]));
  const editedPhotos = r.body.photos;
  check("…and the average follows", same(await rating(Product, product), [2.5, 2]), JSON.stringify(await rating(Product, product)));
  r = await publicList();
  check('…and it says "edited"', r.body.reviews.find((x) => x.id === reviewId).edited === true);
  r = await edit(buyer, reviewId, {}, [{ data: PNG() }]);
  check("a 4th photo through editing → 400", r.status === 400 && r.body.code === "TOO_MANY_PHOTOS", r.text);
  r = await edit(buyer, reviewId, { keepPhotos: JSON.stringify(["/uploads/products/somebody-elses.png"]) });
  check("can't claim someone else's photo", r.status === 400 && r.body.code === "BAD_PHOTOS");
  check("someone else can't edit it → 404", (await edit(buyer2, reviewId)).status === 404);
  check("the artisan can't edit the buyer's review → 404", (await edit(owner, reviewId)).status === 404);
  check("an admin can't edit it → 404", (await edit(admin, reviewId)).status === 404);
  check("the artisan can't delete the buyer's review → 404", (await send(`/reviews/${reviewId}`, { method: "DELETE", token: owner.token })).status === 404);
  check("an admin can't delete it → 404", (await send(`/reviews/${reviewId}`, { method: "DELETE", token: admin.token })).status === 404);
  check("…it's still there", Boolean(await Review.exists({ _id: reviewId, deletedAt: null })));

  await age(reviewId, 13.9);
  check("still editable just inside 14 days", (await edit(buyer, reviewId, { rating: 2, keepPhotos: JSON.stringify(editedPhotos) })).status === 200);
  await age(reviewId, 14.01);
  r = await edit(buyer, reviewId, { rating: 1 });
  check("locked after 14 days: edit → 403", r.status === 403 && r.body.code === "EDIT_WINDOW_CLOSED", `${r.status} ${r.body.code}`);
  r = await send(`/reviews/${reviewId}`, { method: "DELETE", token: buyer.token });
  check("locked after 14 days: delete → 403", r.status === 403 && r.body.code === "EDIT_WINDOW_CLOSED");
  check("…unchanged", (await Review.findById(reviewId)).rating === 2);
  r = await publicList(product, { token: buyer.token });
  check("…the page knows it's locked", r.body.reviews.find((x) => x.id === reviewId).own.editable === false);
  await age(reviewId, 1);

  // ── delete ──
  const toDeleteOrder = await mkOrder(buyer3, "completed", [second]);
  r = await write(buyer3, toDeleteOrder, { rating: 1, comment: "Bad" }, [{ data: PNG() }]);
  const toDelete = r.body;
  check("…review added", same(await rating(Product, second), [2, 2]), JSON.stringify(await rating(Product, second)));
  check("someone else can't delete it → 404", (await send(`/reviews/${toDelete.id}`, { method: "DELETE", token: buyer.token })).status === 404);
  r = await send(`/reviews/${toDelete.id}`, { method: "DELETE", token: buyer3.token });
  check("the buyer can delete within 14 days", r.status === 200 && r.body.deleted === true, r.text);
  check("…its photo is gone", !(await exists(toDelete.photos[0])));
  check("…it left the average", same(await rating(Product, second), [3, 1]), JSON.stringify(await rating(Product, second)));
  check("…and the list", !(await publicList(second)).body.reviews.some((x) => x.id === toDelete.id));
  check("…a second delete → 404", (await send(`/reviews/${toDelete.id}`, { method: "DELETE", token: buyer3.token })).status === 404);

  // ── artisan reply ──
  const reply = (who, id, text = "Thank you!") => send(`/reviews/${id}/reply`, { method: "POST", token: who.token, json: { text } });
  check("no login → 401", (await send(`/reviews/${reviewId}/reply`, { method: "POST", json: { text: "x" } })).status === 401);
  r = await reply(buyer, reviewId);
  check("the buyer can't reply → 403", r.status === 403 && r.body.code === "NOT_YOUR_SHOP");
  check("another shop's artisan can't reply → 403", (await reply(otherOwner, reviewId)).status === 403);
  check("an admin can't reply → 403", (await reply(admin, reviewId)).status === 403);
  check("an empty reply → 400", (await reply(owner, reviewId, " \u0000 ")).body.code === "EMPTY_REPLY");
  check("an over-long reply → 400", (await reply(owner, reviewId, "x".repeat(1001))).body.code === "REPLY_TOO_LONG");
  r = await publicList(product, { token: owner.token });
  check("the owner is offered a reply", r.body.reviews.find((x) => x.id === reviewId).canReply === true);
  const replyNotes = () => Notification.find({ user: buyer.user._id, type: "review_replied" }).lean();
  r = await reply(owner, reviewId, " Thank\u0007 you! ");
  check("the shop's artisan can reply once", r.status === 201 && r.body.reply.text === "Thank you!", r.text);
  r = await reply(owner, reviewId, "Second try");
  check("a second reply → 409", r.status === 409 && r.body.code === "REPLY_EXISTS");
  check("…the first stays", (await Review.findById(reviewId)).reply.text === "Thank you!");
  r = await publicList();
  const replied = r.body.reviews.find((x) => x.id === reviewId);
  check("the reply is public", replied.reply?.text === "Thank you!");
  check("…not offered again", (await publicList(product, { token: owner.token })).body.reviews.find((x) => x.id === reviewId).canReply === false);
  const repliedNotes = await replyNotes();
  check("the buyer is notified once", repliedNotes.length === 1);
  check("…linking to the new product route", repliedNotes[0].link === `/product/${product._id}#reviews`, repliedNotes[0].link);
  check("…with no reply text or personal data", !/Thank|Tuya|test\.invalid/.test(JSON.stringify(repliedNotes[0])) && same(Object.keys(repliedNotes[0].params).sort(), ["productId", "shopName", "title", "titleEn"]), JSON.stringify(repliedNotes[0].params));
  r = await send("/notifications", { token: buyer.token });
  check("it reaches the bell", r.body.items.some((n) => n.type === "review_replied"));
  r = await send("/notifications", { token: owner.token });
  check("the artisan's reaches the bell", r.body.items.some((n) => n.type === "review_received"));

  await Artisan.updateOne({ _id: otherShop._id }, { status: "suspended" });
  const closedOrder = await mkOrder(buyer2, "completed", [otherProduct], otherShop);
  const closedReview = await Review.create({ order: closedOrder._id, itemIndex: 0, product: otherProduct._id, artisan: otherShop._id, buyer: buyer2.user._id, displayName: "X", rating: 4 });
  r = await reply(otherOwner, closedReview._id);
  check("a suspended shop can't reply → 403", r.status === 403 && r.body.code === "SHOP_NOT_APPROVED");
  check("…and its product's reviews aren't public", (await publicList(otherProduct)).status === 404);
  await Artisan.updateOne({ _id: otherShop._id }, { status: "approved" });

  // ── admin hide ──
  const hide = (who, id, json = { reason: "Off topic" }) => send(`/admin/reviews/${id}/hide`, { method: "PUT", token: who.token, json });
  const before = await rating(Product, product);
  check("no login → 401", (await send(`/admin/reviews/${reviewId}/hide`, { method: "PUT", json: { reason: "x" } })).status === 401);
  check("a buyer can't hide → 403", (await hide(buyer, reviewId)).status === 403);
  check("the artisan can't hide → 403", (await hide(owner, reviewId)).status === 403);
  check("the reason is required", (await hide(admin, reviewId, {})).body.code === "REASON_REQUIRED");
  check("…not just spaces", (await hide(admin, reviewId, { reason: "   " })).body.code === "REASON_REQUIRED");
  check("…nor over 300 characters", (await hide(admin, reviewId, { reason: "x".repeat(301) })).body.code === "REASON_TOO_LONG");
  r = await send("/admin/reviews", { token: buyer.token });
  check("a buyer can't list for moderation → 403", r.status === 403);
  r = await hide(admin, reviewId);
  check("an admin can hide with a reason", r.status === 200 && r.body.hidden === true && r.body.hiddenReason === "Off topic", r.text);
  check("the admin view has no email or address", !/test\.invalid|Secret Street|97699|Secretsurname/.test(r.text), r.text);
  check("hiding twice → 409", (await hide(admin, reviewId)).status === 409);
  check("hidden reviews leave the product average", same(await rating(Product, product), [3, 1]), JSON.stringify(await rating(Product, product)));
  r = await publicList();
  check("…the public list", !r.body.reviews.some((x) => x.id === reviewId) && r.body.summary.count === 1);
  check("…the reason never appears publicly", !r.text.includes("Off topic"));
  check("…the breakdown", r.body.summary.breakdown[2] === 0);
  r = await send(`/artisans/${shop.slug}`);
  check("…and the shop average", r.body.ratingCount === 2, JSON.stringify(r.body.ratingCount));
  r = await edit(buyer, reviewId, { rating: 5 });
  check("the buyer can't edit a hidden review", r.status === 409 && r.body.code === "REVIEW_HIDDEN", `${r.status} ${r.body.code}`);
  r = await send(`/reviews/${reviewId}`, { method: "DELETE", token: buyer.token });
  check("…or delete it", r.status === 409 && r.body.code === "REVIEW_HIDDEN");
  await Review.updateOne({ _id: secondItemReview }, { hiddenAt: new Date(), hiddenReason: "x" });
  check("the artisan can't reply to a hidden review", (await reply(owner, secondItemReview)).status === 404);
  await Review.updateOne({ _id: secondItemReview }, { hiddenAt: null, hiddenReason: "" });
  r = await send(`/orders/${completed._id}`, { token: buyer.token });
  check("its buyer sees that it's hidden, and why", r.body.items[0].reviewState.review.hidden === true && r.body.items[0].reviewState.review.hiddenReason === "Off topic");
  r = await send("/admin/reviews?status=hidden", { token: admin.token });
  check("admins can list hidden reviews", r.status === 200 && r.body.reviews.some((x) => x.id === reviewId) && r.body.reviews.every((x) => x.hidden));
  check("…a bad filter → 400", (await send("/admin/reviews?status=$ne", { token: admin.token })).status === 400);
  r = await send(`/admin/reviews/${reviewId}/unhide`, { method: "PUT", token: admin.token });
  check("an admin can undo a hide", r.status === 200 && r.body.hidden === false && r.body.hiddenReason === "", r.text);
  check("…and it counts again", same(await rating(Product, product), before), JSON.stringify(await rating(Product, product)));

  // ── a deleted product ──
  const goneProduct = await mkProduct(shop, "Gone");
  const goneOrder = await mkOrder(buyer2, "completed", [goneProduct]);
  await write(buyer2, goneOrder, { rating: 1 });
  const shopWith = await rating(Artisan, shop);
  await send(`/products/${goneProduct._id}`, { method: "DELETE", token: owner.token });
  check("deleting a product doesn't erase its reviews from the shop's average", same(await rating(Artisan, shop), shopWith), JSON.stringify(await rating(Artisan, shop)));
  const goneOrder2 = await mkOrder(buyer3, "completed", [goneProduct]);
  r = await write(buyer3, goneOrder2);
  check("a deleted product can't get new reviews → 404", r.status === 404 && r.body.code === "PRODUCT_GONE", `${r.status} ${r.body.code}`);
  r = await send("/orders", { token: buyer3.token });
  check('…and has no "Write a review"', r.body.find((o) => o._id === String(goneOrder2._id))?.nextReviewItem === null);

  // ── pagination, newest first ──
  const pageProduct = await mkProduct(shop, "Paged");
  for (let i = 0; i < 23; i++) {
    const order = await mkOrder(buyer2, "completed", [pageProduct]);
    await Review.create({ order: order._id, itemIndex: 0, product: pageProduct._id, artisan: shop._id, buyer: buyer2.user._id, displayName: "P", rating: (i % 5) + 1, comment: `n${i}`, createdAt: new Date(Date.now() - (23 - i) * 60000) });
  }
  r = await publicList(pageProduct);
  check("page 1 has 10, newest first", r.body.reviews.length === 10 && r.body.reviews[0].comment === "n22" && r.body.reviews[9].comment === "n13" && r.body.pages === 3 && r.body.page === 1, JSON.stringify([r.body.reviews.length, r.body.pages]));
  r = await publicList(pageProduct, {}, "?page=3");
  check("the last page has the rest", r.body.reviews.length === 3 && r.body.reviews[2].comment === "n0");
  check("the summary counts all pages", r.body.summary.count === 23);
  r = await publicList(pageProduct, {}, "?page=abc");
  check("a bad page number → page 1", r.status === 200 && r.body.page === 1);
  check("a bad product id → 404", (await send("/products/nonsense/reviews")).status === 404);

  // ── only orders paid through PayPal ──
  const pay = await account("pay");
  const unpaidOrders = [
    ["no payment at all", { payment: undefined }],
    ["a payment that was never captured", { payment: { provider: "paypal", paypalOrderId: "X" } }],
    ["another provider", { payment: { provider: "manual", capturedAt: new Date() } }],
  ];
  for (const [what, over] of unpaidOrders) {
    const order = await mkOrder(pay, "completed", [product], shop, over);
    r = await write(pay, order);
    check(`can't review a Completed order with ${what} → 409 ORDER_NOT_PAID`, r.status === 409 && r.body.code === "ORDER_NOT_PAID", `${r.status} ${r.body.code}`);
    r = await send(`/orders/${order._id}`, { token: pay.token });
    check("…the order page says why", r.body.items[0].reviewState.block === "NOT_PAID" && r.body.items[0].reviewState.canReview === false);
  }
  r = await send("/orders", { token: pay.token });
  check('…and the order list has no "Write a review"', r.body.every((o) => o.nextReviewItem === null));
  check("…no review was stored", (await Review.countDocuments({ buyer: pay.user._id })) === 0);

  // ── 60 days after Completed ──
  const late = await account("late");
  const completedDaysAgo = (who, days, p = product) => mkOrder(who, "completed", [p], shop, { statusHistory: [{ status: "paid", at: daysAgo(days + 5) }, { status: "completed", at: daysAgo(days) }] });
  const tooLate = await completedDaysAgo(late, 60.1);
  r = await write(late, tooLate);
  check("past 60 days after Completed → 409 REVIEW_WINDOW_CLOSED", r.status === 409 && r.body.code === "REVIEW_WINDOW_CLOSED", `${r.status} ${r.body.code}`);
  r = await send(`/orders/${tooLate._id}`, { token: late.token });
  check("…the order page says why", r.body.items[0].reviewState.block === "WINDOW_CLOSED");
  r = await send("/orders", { token: late.token });
  check('…and the order list has no "Write a review"', r.body.find((o) => o._id === String(tooLate._id)).nextReviewItem === null);
  const noDate = await mkOrder(late, "completed", [product], shop, { statusHistory: [] });
  r = await write(late, noDate);
  check("no recorded Completed date → refused", r.status === 409 && r.body.code === "REVIEW_WINDOW_CLOSED", `${r.status} ${r.body.code}`);
  const justInTime = await completedDaysAgo(late, 59.9);
  r = await send("/orders", { token: late.token });
  check('just inside 60 days: "Write a review" shows', r.body.find((o) => o._id === String(justInTime._id)).nextReviewItem === 0);
  r = await write(late, justInTime);
  check("…and the review is accepted", r.status === 201, r.text);
  const oldDateFirst = await mkOrder(late, "shipped", [second], shop);
  r = await send(`/orders/${oldDateFirst._id}/status`, { method: "PUT", token: late.token, json: { status: "completed" } });
  check("confirming receipt records the date", r.status === 200 && r.body.status === "completed", r.text.slice(0, 120));
  r = await write(late, oldDateFirst);
  check("…so the real flow can be reviewed right away", r.status === 201, r.text);

  // ── writing a deleted review again ──
  const rw = await account("rw");
  const rwProduct = await mkProduct(shop, "Rewrite");
  const rwOrder = await mkOrder(rw, "completed", [rwProduct]);
  r = await write(rw, rwOrder, { rating: 5, comment: "First" }, [{ data: PNG() }]);
  const rwId = r.body.id;
  const rwCreated = (await Review.findById(rwId)).createdAt.getTime();
  const notesAfterFirst = await Notification.countDocuments({ user: owner.user._id, type: "review_received", "params.productId": String(rwProduct._id) });
  check("…written and counted", same(await rating(Product, rwProduct), [5, 1]));
  await send(`/reviews/${rwId}`, { method: "DELETE", token: rw.token });
  check("deleted: out of the average", same(await rating(Product, rwProduct), [0, 0]));
  r = await send(`/orders/${rwOrder._id}`, { token: rw.token });
  check("the order page offers writing it again, until the original date", r.body.items[0].reviewState.canReview === true && new Date(r.body.items[0].reviewState.rewriteUntil).getTime() === rwCreated + 14 * 86400000);
  r = await send("/orders", { token: rw.token });
  check('…and so does the list ("Write a review")', r.body.find((o) => o._id === String(rwOrder._id)).nextReviewItem === 0);
  await age(rwId, 13);
  const agedCreated = (await Review.findById(rwId)).createdAt.getTime();
  r = await write(rw, rwOrder, { rating: 2, comment: "Second" }, [{ data: PNG() }]);
  check("it can be written again inside the 14 days", r.status === 201 && r.body.id === rwId && r.body.rating === 2 && r.body.comment === "Second" && r.body.photos.length === 1, r.text);
  check("…on the same row, which doesn't restart the 14 days", (await Review.findById(rwId)).createdAt.getTime() === agedCreated);
  check("…and counts again", same(await rating(Product, rwProduct), [2, 1]));
  check("…with no second notification to the artisan", (await Notification.countDocuments({ user: owner.user._id, type: "review_received", "params.productId": String(rwProduct._id) })) === notesAfterFirst);
  r = await publicList(rwProduct);
  check('…and it says "edited"', r.body.reviews[0].edited === true && r.body.reviews[0].displayName === "Tuyarw");
  check("still one per item: writing again now → 409", (await write(rw, rwOrder)).body.code === "ALREADY_REVIEWED");
  await age(rwId, 14.01);
  check("the rewrite locks when the original 14 days end", (await edit(rw, rwId, { rating: 1 })).body.code === "EDIT_WINDOW_CLOSED");

  const rw2 = await account("rw2");
  const finalOrder = await mkOrder(rw2, "completed", [rwProduct]);
  r = await write(rw2, finalOrder, { rating: 4 });
  const finalId = r.body.id;
  await send(`/reviews/${finalId}`, { method: "DELETE", token: rw2.token });
  await age(finalId, 14.01);
  r = await write(rw2, finalOrder);
  check("after the 14 days a deleted review is final → 409", r.status === 409 && r.body.code === "DELETED_FINAL", `${r.status} ${r.body.code}`);
  r = await send(`/orders/${finalOrder._id}`, { token: rw2.token });
  check('…the order page says "deleted"', r.body.items[0].reviewState.block === "DELETED" && r.body.items[0].reviewState.canReview === false);
  r = await send("/orders", { token: rw2.token });
  check('…and the list has no "Write a review"', r.body.find((o) => o._id === String(finalOrder._id)).nextReviewItem === null);
  check("…no photos or text were kept", (await Review.findById(finalId)).comment === "" && (await Review.findById(finalId)).photos.length === 0);

  const rw3 = await account("rw3");
  const pastSixty = await completedDaysAgo(rw3, 59, rwProduct);
  r = await write(rw3, pastSixty, { rating: 3 });
  const pastSixtyId = r.body.id;
  await send(`/reviews/${pastSixtyId}`, { method: "DELETE", token: rw3.token });
  await Order.updateOne({ _id: pastSixty._id }, { statusHistory: [{ status: "completed", at: daysAgo(70) }] });
  r = await write(rw3, pastSixty, { rating: 4 });
  check("a rewrite inside its 14 days is allowed even past the 60 days", r.status === 201, r.text);
  await send(`/reviews/${pastSixtyId}`, { method: "DELETE", token: rw3.token });
  check("another's deleted review can't be taken over → 404", (await write(rw2, pastSixty)).status === 404);
  await Order.updateOne({ _id: pastSixty._id }, { payment: undefined, $unset: { payment: 1 } });
  check("a rewrite still needs a paid order", (await write(rw3, pastSixty)).body.code === "ORDER_NOT_PAID");

  // ── the artisan's reply: edit or delete for 14 days ──
  const rp = await account("rp");
  const rpOrder = await mkOrder(rp, "completed", [rwProduct]);
  r = await write(rp, rpOrder, { rating: 4, comment: "Nice" });
  const rpId = r.body.id;
  const editReply = (who, text = "Edited reply") => send(`/reviews/${rpId}/reply`, { method: "PUT", token: who.token, json: { text } });
  const dropReply = (who) => send(`/reviews/${rpId}/reply`, { method: "DELETE", token: who.token });
  const replyAge = async (days) => {
    const { modifiedCount } = await Review.collection.updateOne({ _id: new mongoose.Types.ObjectId(rpId) }, { $set: { replyFirstAt: daysAgo(days), ...(await Review.exists({ _id: rpId, reply: { $exists: true } }) && { "reply.at": daysAgo(days) }) } });
    if (modifiedCount !== 1) throw new Error("the reply wasn't aged");
  };
  const firstReplyAt = async () => (await Review.findById(rpId)).replyFirstAt.getTime();
  const rpNotes = () => Notification.countDocuments({ user: rp.user._id, type: "review_replied" });
  const rpShown = async (who) => (await publicList(rwProduct, who ? { token: who.token } : {})).body.reviews.find((x) => x.id === rpId);
  check("editing a reply that doesn't exist → 404 NO_REPLY", (await editReply(owner)).body.code === "NO_REPLY");
  check("deleting a reply that doesn't exist → 404 NO_REPLY", (await dropReply(owner)).body.code === "NO_REPLY");
  check("…the owner isn't offered changes yet", (await rpShown(owner)).canEditReply === false);
  r = await send(`/reviews/${rpId}/reply`, { method: "POST", token: owner.token, json: { text: "Original reply" } });
  check("the artisan posts a reply", r.status === 201 && r.body.reply.edited === false, r.text);
  const postedAt = r.body.reply.at;
  check("…the buyer is notified once", (await rpNotes()) === 1);
  check("…and the owner is offered changes", (await rpShown(owner)).canEditReply === true);
  check("…a visitor isn't", (await rpShown()).canEditReply === false);
  check("…nor the buyer", (await rpShown(rp)).canEditReply === false);
  for (const [who, name] of [[rp, "the buyer"], [otherOwner, "another artisan"], [admin, "an admin"]]) {
    r = await editReply(who);
    check(`${name} can't edit the reply → 403`, r.status === 403 && r.body.code === "NOT_YOUR_SHOP", `${r.status}`);
    r = await dropReply(who);
    check(`${name} can't delete the reply → 403`, r.status === 403 && r.body.code === "NOT_YOUR_SHOP", `${r.status}`);
  }
  check("no login → 401", (await send(`/reviews/${rpId}/reply`, { method: "PUT", json: { text: "x" } })).status === 401);
  check("an empty edit → 400", (await editReply(owner, "  ")).body.code === "EMPTY_REPLY");
  check("an over-long edit → 400", (await editReply(owner, "x".repeat(1001))).body.code === "REPLY_TOO_LONG");
  r = await editReply(owner, " Edited\u0007 reply ");
  check("the artisan can edit it; text cleaned like chat", r.status === 200 && r.body.reply.text === "Edited reply" && r.body.reply.edited === true, r.text);
  check("…the posting date stays", new Date(r.body.reply.at).getTime() === new Date(postedAt).getTime());
  check("…no notification on edit", (await rpNotes()) === 1);
  check("…it's public, marked edited", (await rpShown()).reply.text === "Edited reply" && (await rpShown()).reply.edited === true);
  r = await send(`/reviews/${rpId}/reply`, { method: "POST", token: owner.token, json: { text: "A second reply" } });
  check("still one reply per review → 409", r.status === 409 && r.body.code === "REPLY_EXISTS");
  await replyAge(13.9);
  check("still editable just inside 14 days", (await editReply(owner, "Later edit")).status === 200);
  await replyAge(14.01);
  r = await editReply(owner, "Too late");
  check("locked after 14 days: edit → 403", r.status === 403 && r.body.code === "REPLY_LOCKED", `${r.status} ${r.body.code}`);
  r = await dropReply(owner);
  check("locked after 14 days: delete → 403", r.status === 403 && r.body.code === "REPLY_LOCKED");
  check("…unchanged, and no longer offered", (await rpShown(owner)).reply.text === "Later edit" && (await rpShown(owner)).canEditReply === false);
  await replyAge(1);
  r = await dropReply(owner);
  check("the artisan can delete it within 14 days", r.status === 200 && r.body.deleted === true, r.text);
  check("…it's gone from the page", (await rpShown()).reply === null);
  check("…no notification on delete", (await rpNotes()) === 1);
  const firstAt = await firstReplyAt();
  check("…a new one is offered, with the original end date", (await rpShown(owner)).canReply === true && (await rpShown(owner)).canEditReply === false && new Date((await rpShown(owner)).replyUntil).getTime() === firstAt + 14 * 86400000);
  check("…a visitor sees neither the offer nor the date", (await rpShown()).canReply === false && !("replyUntil" in (await rpShown())));
  check("…editing while it's deleted → 404", (await editReply(owner)).status === 404);
  await replyAge(13);
  const agedFirstAt = await firstReplyAt();
  r = await send(`/reviews/${rpId}/reply`, { method: "POST", token: otherOwner.token, json: { text: "Not mine" } });
  check("another artisan still can't post one → 403", r.status === 403 && r.body.code === "NOT_YOUR_SHOP");
  r = await send(`/reviews/${rpId}/reply`, { method: "POST", token: owner.token, json: { text: "Second attempt" } });
  check("the artisan can post a new one within the 14 days", r.status === 201 && r.body.reply.text === "Second attempt" && r.body.reply.edited === true, r.text);
  check("…counted from the first reply, not restarted", (await firstReplyAt()) === agedFirstAt && new Date(r.body.replyUntil).getTime() === agedFirstAt + 14 * 86400000);
  check("…with no second notification to the buyer", (await rpNotes()) === 1);
  check("…it's public", (await rpShown()).reply.text === "Second attempt");
  r = await send(`/reviews/${rpId}/reply`, { method: "POST", token: owner.token, json: { text: "A third" } });
  check("…still one at a time → 409 REPLY_EXISTS", r.status === 409 && r.body.code === "REPLY_EXISTS");
  await replyAge(14.01);
  check("the new one locks when the original 14 days end", (await editReply(owner, "Late")).body.code === "REPLY_LOCKED" && (await dropReply(owner)).body.code === "REPLY_LOCKED");
  await replyAge(13);
  check("…and can be deleted again before that", (await dropReply(owner)).status === 200);
  await replyAge(14.01);
  check("after the 14 days a deleted reply is final: not offered", (await rpShown(owner)).canReply === false);
  r = await send(`/reviews/${rpId}/reply`, { method: "POST", token: owner.token, json: { text: "Too late" } });
  check("…and refused → 409 REPLY_DELETED", r.status === 409 && r.body.code === "REPLY_DELETED", `${r.status} ${r.body.code}`);
  check("…nothing was stored", (await rpShown()).reply === null);
  check("the review itself is untouched", (await rpShown()).comment === "Nice");
  await send(`/reviews/${rpId}`, { method: "DELETE", token: rp.token });
  await write(rp, rpOrder, { rating: 3, comment: "New text" });
  r = await send(`/reviews/${rpId}/reply`, { method: "POST", token: owner.token, json: { text: "To the new text" } });
  check("a rewritten review is new content: it can get a reply", r.status === 201, r.text);
  check("…with its own 14 days", (await rpShown(owner)).canEditReply === true && Date.now() - (await firstReplyAt()) < 60000);
  check("…and it notifies the buyer", (await rpNotes()) === 2);

  // ── hidden products ──
  const hiddenBuyer = await account("hid");
  const hideMe = await mkProduct(shop, "HideMe");
  await write(hiddenBuyer, await mkOrder(hiddenBuyer, "completed", [hideMe]), { rating: 1 });
  const shopBeforeHiding = await rating(Artisan, shop);
  await Product.updateOne({ _id: hideMe._id }, { isHidden: true });
  await write(hiddenBuyer, await mkOrder(hiddenBuyer, "completed", [hideMe]), { rating: 1 });
  check("reviews of a hidden product still count in the shop's average", (await rating(Artisan, shop))[1] === shopBeforeHiding[1] + 1, JSON.stringify([shopBeforeHiding, await rating(Artisan, shop)]));
  check("…while the reviews themselves aren't public", (await publicList(hideMe)).status === 404);

  // ── rate limit ──
  const limitOrder = await mkOrder(limited, "completed");
  const statuses = [];
  for (let i = 0; i < 11; i++) statuses.push((await send("/reviews", { method: "POST", token: limited.token, form: formOf({ orderId: limitOrder._id, itemIndex: 0, rating: 9 }) })).status);
  check("the first 10 attempts are looked at", statuses.slice(0, 10).every((s) => s === 400), statuses.join());
  r = await write(limited, limitOrder);
  check("then 429 RATE_LIMITED", statuses[10] === 429 && r.status === 429 && r.body.code === "RATE_LIMITED", statuses.join());
  check("per user: another buyer isn't affected", (await write(buyer3, await mkOrder(buyer3, "completed"))).status === 201);
} catch (err) {
  check("no unexpected error", false, err.stack);
} finally {
  await stopTestEnv();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

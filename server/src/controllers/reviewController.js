const mongoose = require("mongoose");
const Review = require("../models/Review");
const Order = require("../models/Order");
const Product = require("../models/Product");
const Artisan = require("../models/Artisan");
const User = require("../models/User");
const { notify } = require("../utils/notify");
const { cleanText } = require("../utils/text");
const { isShopLive } = require("../utils/shops");
const { saveReviewPhotos, deleteReviewPhoto, MAX_REVIEW_PHOTOS } = require("../utils/imageStorage");
const { EDIT_WINDOW_MS, VISIBLE, displayNameOf, isEditable, canRewrite, isReplyEditable, replyView, isPaidByPayPal, withinWriteWindow, refreshRatings, ownReviewView } = require("../utils/reviews");
const { visibleTo } = require("./productController");

// Verified reviews. Everything is checked here, whatever the UI shows: only the buyer of a
// completed order item paid through PayPal can review it, once, within 60 days of completion,
// and never their own shop's product.
// Public responses are built by hand: a first name and the review, never an email, address,
// phone, buyer id or anything about the order.
const COMMENT_MAX = 1000;
const REPLY_MAX = 1000;
const REASON_MAX = 300;
const PAGE = 10;
const ADMIN_PAGE = 20;

const fail = (res, status, code, error) => res.status(status).json({ error, code });
const notFound = (res) => fail(res, 404, "NOT_FOUND", "Review not found");
const parseRating = (v) => ((typeof v === "string" && /^[1-5]$/.test(v)) || (Number.isInteger(v) && v >= 1 && v <= 5) ? Number(v) : null);
const pageOf = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 100000 ? n : 1;
};
// Notification links open the product page at its reviews.
const reviewsLink = (productId) => `/product/${productId}#reviews`;
const removePhotos = (urls) => Promise.all(urls.map(deleteReviewPhoto));

function readComment(res, body) {
  if (body?.comment !== undefined && typeof body.comment !== "string") { fail(res, 400, "BAD_COMMENT", "Comment must be text"); return null; }
  const comment = cleanText(body?.comment);
  if (comment.length > COMMENT_MAX) { fail(res, 400, "COMMENT_TOO_LONG", `Comments can be up to ${COMMENT_MAX} characters`); return null; }
  return comment;
}

// ── write ──
// POST /api/reviews, multipart: orderId, itemIndex, rating, comment?, up to 3 "photos".
async function createReview(req, res) {
  const { orderId, itemIndex } = req.body || {};
  if (typeof orderId !== "string" || !mongoose.isValidObjectId(orderId) || typeof itemIndex !== "string" || !/^\d{1,3}$/.test(itemIndex)) {
    return fail(res, 400, "BAD_ITEM", "orderId and itemIndex are required");
  }
  // Someone else's order is the same 404 as one that doesn't exist.
  const order = await Order.findOne({ _id: orderId, user: req.user.id });
  const index = Number(itemIndex);
  const item = order?.items[index];
  if (!item) return fail(res, 404, "ORDER_NOT_FOUND", "Order item not found");
  if (order.status !== "completed") return fail(res, 409, "ORDER_NOT_COMPLETED", "You can review this once the order is completed");
  if (!isPaidByPayPal(order)) return fail(res, 409, "ORDER_NOT_PAID", "Only orders paid through PayPal can be reviewed");

  const product = await Product.findById(item.product).select("title titleEn artisan");
  if (!product) return fail(res, 404, "PRODUCT_GONE", "This product no longer exists");
  const shop = await Artisan.findById(product.artisan).select("user");
  if (!shop) return fail(res, 404, "PRODUCT_GONE", "This product no longer exists");
  if (shop.user.equals(req.user.id)) return fail(res, 403, "OWN_PRODUCT", "You can't review your own shop's products");

  // Writing a deleted review again depends only on its original 14 days: the buyer wrote it
  // in time, so the 60 days don't apply to the rewrite.
  const existing = await Review.findOne({ order: order._id, itemIndex: index });
  if (existing && !existing.deletedAt) return fail(res, 409, "ALREADY_REVIEWED", "You've already reviewed this item");
  if (existing && !canRewrite(existing)) return fail(res, 409, "DELETED_FINAL", "This review was deleted and can't be written again");
  if (!existing && !withinWriteWindow(order)) return fail(res, 409, "REVIEW_WINDOW_CLOSED", "Reviews can be written for 60 days after an order is completed");

  const rating = parseRating(req.body.rating);
  if (rating === null) return fail(res, 400, "BAD_RATING", "Rating must be a whole number from 1 to 5");
  const comment = readComment(res, req.body);
  if (comment === null) return undefined;

  // Storage is only touched once everything above is valid.
  const user = await User.findById(req.user.id).select("name");
  const photos = await saveReviewPhotos(req.files || []);
  if (existing) {
    // Same row, so createdAt (and the 14 days) stay. Like an edit, it notifies nobody.
    const rewritten = await Review.findOneAndUpdate(
      { _id: existing._id, buyer: req.user.id, deletedAt: { $ne: null }, createdAt: { $gt: new Date(Date.now() - EDIT_WINDOW_MS) } },
      { $set: { deletedAt: null, displayName: displayNameOf(user?.name), rating, comment, photos, editedAt: new Date() } },
      { new: true },
    );
    if (!rewritten) {
      await removePhotos(photos);
      return fail(res, 409, "ALREADY_REVIEWED", "You've already reviewed this item"); // two at once
    }
    await refreshRatings(rewritten);
    return res.status(201).json(ownReviewView(rewritten));
  }
  let review;
  try {
    review = await Review.create({
      order: order._id, itemIndex: index, product: product._id, artisan: product.artisan, buyer: req.user.id,
      displayName: displayNameOf(user?.name), rating, comment, photos,
    });
  } catch (err) {
    await removePhotos(photos);
    if (err.code === 11000) return fail(res, 409, "ALREADY_REVIEWED", "You've already reviewed this item"); // two at once
    throw err;
  }
  await refreshRatings(review);
  await notify(shop.user, "review_received", { productId: product._id, title: product.title, titleEn: product.titleEn, rating }, reviewsLink(product._id));
  res.status(201).json(ownReviewView(review));
}

// The caller's own review, still open to changes. Otherwise sends the error and returns null.
async function loadOwnEditable(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) { notFound(res); return null; }
  const review = await Review.findOne({ _id: req.params.id, buyer: req.user.id, deletedAt: null });
  if (!review) { notFound(res); return null; }
  if (review.hiddenAt) { fail(res, 409, "REVIEW_HIDDEN", "An admin has hidden this review, so it can't be changed"); return null; }
  if (!isEditable(review)) { fail(res, 403, "EDIT_WINDOW_CLOSED", "Reviews can only be changed for 14 days"); return null; }
  return review;
}

// PUT /api/reviews/:id, multipart: rating, comment?, keepPhotos? (JSON list of current photo
// URLs to keep; without it all stay), new "photos". Buyer only, within 14 days.
async function updateReview(req, res) {
  const review = await loadOwnEditable(req, res);
  if (!review) return undefined;
  const rating = parseRating(req.body?.rating);
  if (rating === null) return fail(res, 400, "BAD_RATING", "Rating must be a whole number from 1 to 5");
  const comment = readComment(res, req.body);
  if (comment === null) return undefined;

  let keep = review.photos;
  if (req.body.keepPhotos !== undefined) {
    try { keep = JSON.parse(req.body.keepPhotos); } catch { keep = null; }
    if (!Array.isArray(keep) || !keep.every((url) => review.photos.includes(url)) || new Set(keep).size !== keep.length) {
      return fail(res, 400, "BAD_PHOTOS", "keepPhotos can only list this review's own photos");
    }
  }
  const files = req.files || [];
  if (keep.length + files.length > MAX_REVIEW_PHOTOS) return fail(res, 400, "TOO_MANY_PHOTOS", `A review can have at most ${MAX_REVIEW_PHOTOS} photos`);

  const added = await saveReviewPhotos(files);
  const removed = review.photos.filter((url) => !keep.includes(url));
  // Conditional on the photos read above, so two edits at once can't lose track of a file.
  const updated = await Review.findOneAndUpdate(
    { _id: review._id, buyer: req.user.id, ...VISIBLE, photos: [...review.photos] },
    { $set: { rating, comment, photos: [...keep, ...added], editedAt: new Date() } },
    { new: true },
  );
  if (!updated) {
    await removePhotos(added);
    return fail(res, 409, "REVIEW_CHANGED", "This review just changed. Please reload and try again");
  }
  await removePhotos(removed);
  await refreshRatings(updated);
  res.json(ownReviewView(updated));
}

// DELETE /api/reviews/:id. Buyer only, within 14 days. It can be written again in what's left of
// them (see Review.deletedAt). The artisan's reply goes with it, and a rewrite can get a new one.
async function deleteReview(req, res) {
  const review = await loadOwnEditable(req, res);
  if (!review) return undefined;
  const deleted = await Review.findOneAndUpdate(
    { _id: review._id, buyer: req.user.id, ...VISIBLE },
    { $set: { deletedAt: new Date(), comment: "", photos: [], displayName: "" }, $unset: { reply: 1, replyDeletedAt: 1 } },
  );
  if (!deleted) return notFound(res);
  await removePhotos(deleted.photos);
  await refreshRatings(review);
  res.json({ deleted: true });
}

function readReply(res, body) {
  if (body?.text !== undefined && typeof body.text !== "string") { fail(res, 400, "EMPTY_REPLY", "Write a reply first"); return null; }
  const text = cleanText(body?.text);
  if (!text) { fail(res, 400, "EMPTY_REPLY", "Write a reply first"); return null; }
  if (text.length > REPLY_MAX) { fail(res, 400, "REPLY_TOO_LONG", `Replies can be up to ${REPLY_MAX} characters`); return null; }
  return text;
}

// POST /api/reviews/:id/reply { text }: the owning artisan's one public reply. The artisan has
// no way to change the review itself.
async function replyToReview(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
  const review = await Review.findOne({ _id: req.params.id, ...VISIBLE });
  if (!review) return notFound(res);
  const shop = await Artisan.findOne({ _id: review.artisan, user: req.user.id }).select("shopName status");
  if (!shop) return fail(res, 403, "NOT_YOUR_SHOP", "Only this shop's artisan can reply");
  if (!isShopLive(shop)) return fail(res, 403, "SHOP_NOT_APPROVED", "Your shop must be approved to reply");
  if (review.replyDeletedAt) return fail(res, 409, "REPLY_DELETED", "The reply to this review was deleted. Each review gets one reply");
  const text = readReply(res, req.body);
  if (text === null) return undefined;

  // Conditional, so a double click can't reply twice.
  const updated = await Review.findOneAndUpdate(
    { _id: review._id, ...VISIBLE, reply: { $exists: false }, replyDeletedAt: null },
    { $set: { reply: { text, at: new Date() } } },
    { new: true },
  );
  if (!updated) return fail(res, 409, "REPLY_EXISTS", "This review already has a reply");
  const product = await Product.findById(review.product).select("title titleEn");
  await notify(review.buyer, "review_replied", { productId: review.product, title: product?.title, titleEn: product?.titleEn, shopName: shop.shopName }, reviewsLink(review.product));
  res.status(201).json({ reply: replyView(updated.reply) });
}

// The caller's own reply, still open to changes. Otherwise sends the error and returns null.
async function loadOwnReply(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) { notFound(res); return null; }
  const review = await Review.findOne({ _id: req.params.id, ...VISIBLE });
  if (!review) { notFound(res); return null; }
  const shop = await Artisan.findOne({ _id: review.artisan, user: req.user.id }).select("status");
  if (!shop) { fail(res, 403, "NOT_YOUR_SHOP", "Only this shop's artisan can change its reply"); return null; }
  if (!isShopLive(shop)) { fail(res, 403, "SHOP_NOT_APPROVED", "Your shop must be approved to change a reply"); return null; }
  if (!review.reply) { fail(res, 404, "NO_REPLY", "This review has no reply"); return null; }
  if (!isReplyEditable(review)) { fail(res, 403, "REPLY_LOCKED", "Replies can only be changed for 14 days"); return null; }
  return review;
}

// PUT /api/reviews/:id/reply { text }: within 14 days of posting; editing doesn't restart them
// or notify the buyer.
async function updateReply(req, res) {
  const review = await loadOwnReply(req, res);
  if (!review) return undefined;
  const text = readReply(res, req.body);
  if (text === null) return undefined;
  const updated = await Review.findOneAndUpdate(
    { _id: review._id, ...VISIBLE, reply: { $exists: true } },
    { $set: { "reply.text": text, "reply.editedAt": new Date() } },
    { new: true },
  );
  if (!updated) return fail(res, 404, "NO_REPLY", "This review has no reply");
  return res.json({ reply: replyView(updated.reply) });
}

// DELETE /api/reviews/:id/reply: within 14 days of posting. No new reply can follow, and the
// buyer isn't notified.
async function deleteReply(req, res) {
  const review = await loadOwnReply(req, res);
  if (!review) return undefined;
  const updated = await Review.findOneAndUpdate(
    { _id: review._id, ...VISIBLE, reply: { $exists: true } },
    { $set: { replyDeletedAt: new Date() }, $unset: { reply: 1 } },
  );
  if (!updated) return fail(res, 404, "NO_REPLY", "This review has no reply");
  return res.json({ deleted: true });
}

// ── read ──
// One review as anyone may see it. Only the buyer also gets what's needed to edit it.
function publicView(r, viewerId, isOwner) {
  const mine = Boolean(viewerId) && String(r.buyer) === String(viewerId);
  return {
    id: r._id,
    rating: r.rating,
    comment: r.comment,
    photos: r.photos,
    displayName: r.displayName,
    verified: true,
    createdAt: r.createdAt,
    edited: Boolean(r.editedAt),
    reply: replyView(r.reply),
    mine,
    canReply: isOwner && !r.reply && !r.replyDeletedAt,
    canEditReply: isOwner && isReplyEditable(r),
    ...(mine && { own: { orderId: r.order, itemIndex: r.itemIndex, editable: isEditable(r) } }),
  };
}

// GET /api/products/:id/reviews?page=1: newest first, with the average and the 5-to-1 breakdown.
// Login optional. Follows the product's own visibility (hidden product, closed shop: 404).
async function listProductReviews(req, res) {
  const missing = () => res.status(404).json({ error: "Product not found" });
  if (!mongoose.isValidObjectId(req.params.id)) return missing();
  const product = await Product.findOne({ _id: req.params.id, ...(await visibleTo(req.user)) }).select("artisan");
  if (!product) return missing();

  const filter = { product: product._id, ...VISIBLE };
  const page = pageOf(req.query.page);
  const [groups, reviews, isOwner] = await Promise.all([
    Review.aggregate([{ $match: filter }, { $group: { _id: "$rating", n: { $sum: 1 } } }]),
    Review.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * PAGE).limit(PAGE).lean(),
    req.user ? Artisan.exists({ _id: product.artisan, user: req.user.id }) : null,
  ]);
  const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  groups.forEach((g) => { breakdown[g._id] = g.n; });
  const count = groups.reduce((sum, g) => sum + g.n, 0);
  const sum = groups.reduce((total, g) => total + g._id * g.n, 0);
  res.json({
    summary: { count, average: count ? Math.round((sum / count) * 100) / 100 : 0, breakdown },
    reviews: reviews.map((r) => publicView(r, req.user?.id, Boolean(isOwner))),
    page,
    pages: Math.max(1, Math.ceil(count / PAGE)),
  });
}

// ── admin ──
const adminView = (r) => ({
  id: r._id,
  rating: r.rating,
  comment: r.comment,
  photos: r.photos,
  displayName: r.displayName,
  createdAt: r.createdAt,
  reply: replyView(r.reply),
  hidden: Boolean(r.hiddenAt),
  hiddenReason: r.hiddenAt ? r.hiddenReason : "",
  product: r.product ? { id: r.product._id, title: r.product.title, titleEn: r.product.titleEn || "" } : null,
  shopName: r.artisan?.shopName || "",
});

// GET /api/admin/reviews?status=hidden&page=1, newest first.
async function adminListReviews(req, res) {
  const { status } = req.query;
  if (status !== undefined && status !== "hidden") return res.status(400).json({ error: "status must be hidden, or left out" });
  const filter = { deletedAt: null, ...(status === "hidden" && { hiddenAt: { $ne: null } }) };
  const page = pageOf(req.query.page);
  const [total, reviews] = await Promise.all([
    Review.countDocuments(filter),
    Review.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * ADMIN_PAGE).limit(ADMIN_PAGE)
      .populate("product", "title titleEn").populate("artisan", "shopName").lean(),
  ]);
  res.json({ reviews: reviews.map(adminView), page, pages: Math.max(1, Math.ceil(total / ADMIN_PAGE)) });
}

async function setHidden(req, res, condition, update) {
  if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
  const review = await Review.findOneAndUpdate({ _id: req.params.id, deletedAt: null, ...condition }, update, { new: true });
  if (!review) {
    return (await Review.exists({ _id: req.params.id, deletedAt: null }))
      ? fail(res, 409, "BAD_TRANSITION", "This review is already in that state")
      : notFound(res);
  }
  await refreshRatings(review);
  await review.populate([{ path: "product", select: "title titleEn" }, { path: "artisan", select: "shopName" }]);
  return res.json(adminView(review));
}

// PUT /api/admin/reviews/:id/hide { reason } (required)
async function hideReview(req, res) {
  if (req.body?.reason !== undefined && typeof req.body.reason !== "string") return fail(res, 400, "REASON_REQUIRED", "Give a reason");
  const reason = cleanText(req.body?.reason);
  if (!reason) return fail(res, 400, "REASON_REQUIRED", "Give a reason");
  if (reason.length > REASON_MAX) return fail(res, 400, "REASON_TOO_LONG", `The reason can be up to ${REASON_MAX} characters`);
  return setHidden(req, res, { hiddenAt: null }, { $set: { hiddenAt: new Date(), hiddenReason: reason, hiddenBy: req.user.id } });
}

// PUT /api/admin/reviews/:id/unhide: undoes a hide made by mistake.
const unhideReview = (req, res) => setHidden(req, res, { hiddenAt: { $ne: null } }, { $set: { hiddenAt: null, hiddenReason: "" }, $unset: { hiddenBy: 1 } });

module.exports = { createReview, updateReview, deleteReview, replyToReview, updateReply, deleteReply, listProductReviews, adminListReviews, hideReview, unhideReview };

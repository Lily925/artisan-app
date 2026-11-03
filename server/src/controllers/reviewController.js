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
const { VISIBLE, displayNameOf, isEditable, refreshRatings, ownReviewView } = require("../utils/reviews");
const { visibleTo } = require("./productController");

// Verified reviews. Everything is checked here, whatever the UI shows: only the buyer of a
// completed order item can review it, once, and never their own shop's product.
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

  const product = await Product.findById(item.product).select("title titleEn artisan");
  if (!product) return fail(res, 404, "PRODUCT_GONE", "This product no longer exists");
  const shop = await Artisan.findById(product.artisan).select("user");
  if (!shop) return fail(res, 404, "PRODUCT_GONE", "This product no longer exists");
  if (shop.user.equals(req.user.id)) return fail(res, 403, "OWN_PRODUCT", "You can't review your own shop's products");

  const rating = parseRating(req.body.rating);
  if (rating === null) return fail(res, 400, "BAD_RATING", "Rating must be a whole number from 1 to 5");
  const comment = readComment(res, req.body);
  if (comment === null) return undefined;
  if (await Review.exists({ order: order._id, itemIndex: index })) return fail(res, 409, "ALREADY_REVIEWED", "You've already reviewed this item");

  // Storage is only touched once everything above is valid.
  const user = await User.findById(req.user.id).select("name");
  const photos = await saveReviewPhotos(req.files || []);
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

// DELETE /api/reviews/:id. Buyer only, within 14 days. See Review.deletedAt: the item stays used.
async function deleteReview(req, res) {
  const review = await loadOwnEditable(req, res);
  if (!review) return undefined;
  const deleted = await Review.findOneAndUpdate(
    { _id: review._id, buyer: req.user.id, ...VISIBLE },
    { $set: { deletedAt: new Date(), comment: "", photos: [], displayName: "" }, $unset: { reply: 1 } },
  );
  if (!deleted) return notFound(res);
  await removePhotos(deleted.photos);
  await refreshRatings(review);
  res.json({ deleted: true });
}

// POST /api/reviews/:id/reply { text }: the owning artisan's one public reply. It stays as
// written. The artisan has no way to change the review itself.
async function replyToReview(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
  const review = await Review.findOne({ _id: req.params.id, ...VISIBLE });
  if (!review) return notFound(res);
  const shop = await Artisan.findOne({ _id: review.artisan, user: req.user.id }).select("shopName status");
  if (!shop) return fail(res, 403, "NOT_YOUR_SHOP", "Only this shop's artisan can reply");
  if (!isShopLive(shop)) return fail(res, 403, "SHOP_NOT_APPROVED", "Your shop must be approved to reply");
  if (req.body?.text !== undefined && typeof req.body.text !== "string") return fail(res, 400, "EMPTY_REPLY", "Write a reply first");
  const text = cleanText(req.body?.text);
  if (!text) return fail(res, 400, "EMPTY_REPLY", "Write a reply first");
  if (text.length > REPLY_MAX) return fail(res, 400, "REPLY_TOO_LONG", `Replies can be up to ${REPLY_MAX} characters`);

  // Conditional, so a double click can't reply twice.
  const updated = await Review.findOneAndUpdate(
    { _id: review._id, ...VISIBLE, reply: { $exists: false } },
    { $set: { reply: { text, at: new Date() } } },
    { new: true },
  );
  if (!updated) return fail(res, 409, "REPLY_EXISTS", "This review already has a reply");
  const product = await Product.findById(review.product).select("title titleEn");
  await notify(review.buyer, "review_replied", { productId: review.product, title: product?.title, titleEn: product?.titleEn, shopName: shop.shopName }, reviewsLink(review.product));
  res.status(201).json({ reply: { text: updated.reply.text, at: updated.reply.at } });
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
    reply: r.reply ? { text: r.reply.text, at: r.reply.at } : null,
    mine,
    canReply: isOwner && !r.reply,
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
  reply: r.reply ? { text: r.reply.text, at: r.reply.at } : null,
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

module.exports = { createReview, updateReview, deleteReview, replyToReview, listProductReviews, adminListReviews, hideReview, unhideReview };

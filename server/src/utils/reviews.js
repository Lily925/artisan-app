const Review = require("../models/Review");
const Product = require("../models/Product");
const Artisan = require("../models/Artisan");

const EDIT_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
// What the public averages and lists count.
const VISIBLE = { hiddenAt: null, deletedAt: null };

// The first word of the account name. Empty if that looks like an email or a phone number
// (the name is free text at sign-up); the frontend then shows a generic "Buyer".
function displayNameOf(name) {
  const first = String(name || "").trim().split(/\s+/)[0] || "";
  if (first.includes("@") || (first.match(/\d/g) || []).length >= 5) return "";
  return first.slice(0, 40);
}

const editableUntil = (review) => new Date(new Date(review.createdAt).getTime() + EDIT_WINDOW_MS);
const isEditable = (review, now = Date.now()) => !review.hiddenAt && !review.deletedAt && editableUntil(review).getTime() > now;

// count and average of the visible reviews matching a filter.
async function ratingOf(match) {
  const [row] = await Review.aggregate([
    { $match: { ...match, ...VISIBLE } },
    { $group: { _id: null, count: { $sum: 1 }, sum: { $sum: "$rating" } } },
  ]);
  return { ratingCount: row?.count || 0, ratingAvg: row ? Math.round((row.sum / row.count) * 100) / 100 : 0 };
}

// Recomputed from the reviews each time, so a repeat or a failure can't drift the numbers.
// A shop's average includes reviews of products it has since deleted: deleting a product must
// not be a way to remove bad reviews. Never throws: the review itself is already saved.
async function refreshRatings(review) {
  try {
    await Promise.all([
      ratingOf({ product: review.product }).then((r) => Product.updateOne({ _id: review.product }, { $set: r }, { timestamps: false })),
      ratingOf({ artisan: review.artisan }).then((r) => Artisan.updateOne({ _id: review.artisan }, { $set: r }, { timestamps: false })),
    ]);
  } catch (err) {
    console.error(`Rating totals not updated: ${err.message}`);
  }
}

// The buyer's own view of their review, on their order page.
const ownReviewView = (r) => ({
  id: r._id,
  rating: r.rating,
  comment: r.comment,
  photos: r.photos,
  createdAt: r.createdAt,
  editedAt: r.editedAt || null,
  editableUntil: editableUntil(r),
  editable: isEditable(r),
  reply: r.reply ? { text: r.reply.text, at: r.reply.at } : null,
  hidden: Boolean(r.hiddenAt),
  hiddenReason: r.hiddenAt ? r.hiddenReason : "",
});

// For a buyer's orders: order id -> per item { canReview, block, review }. block says why an
// item can't be reviewed: NOT_COMPLETED, OWN_PRODUCT, PRODUCT_GONE or DELETED.
async function reviewStateFor(orders, userId) {
  const completed = orders.filter((o) => o.status === "completed");
  const [reviews, products, ownShop] = await Promise.all([
    Review.find({ order: { $in: completed.map((o) => o._id) } }).lean(),
    Product.find({ _id: { $in: completed.flatMap((o) => o.items.map((i) => i.product)) } }).select("artisan").lean(),
    Artisan.findOne({ user: userId }).select("_id").lean(),
  ]);
  const byKey = new Map(reviews.map((r) => [`${r.order}:${r.itemIndex}`, r]));
  const productById = new Map(products.map((p) => [String(p._id), p]));
  const state = new Map();
  for (const order of orders) {
    state.set(String(order._id), order.items.map((item, index) => {
      if (order.status !== "completed") return { canReview: false, block: "NOT_COMPLETED", review: null };
      const review = byKey.get(`${order._id}:${index}`);
      if (review?.deletedAt) return { canReview: false, block: "DELETED", review: null };
      if (review) return { canReview: false, block: null, review: ownReviewView(review) };
      const product = productById.get(String(item.product));
      if (!product) return { canReview: false, block: "PRODUCT_GONE", review: null };
      if (ownShop && String(product.artisan) === String(ownShop._id)) return { canReview: false, block: "OWN_PRODUCT", review: null };
      return { canReview: true, block: null, review: null };
    }));
  }
  return state;
}

module.exports = { EDIT_WINDOW_MS, VISIBLE, displayNameOf, editableUntil, isEditable, refreshRatings, ownReviewView, reviewStateFor };

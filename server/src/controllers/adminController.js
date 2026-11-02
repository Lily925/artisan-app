const mongoose = require("mongoose");
const Artisan = require("../models/Artisan");
const Product = require("../models/Product");
const { SHOP_STATUSES } = require("../utils/shops");
const { notify } = require("../utils/notify");

// Admin only (see routes/adminRoutes). Shops are listed with the owner's name only: no
// email, phone or payout email.
const ADMIN_SHOP_FIELDS = "shopName slug bio location status statusReason reviewedAt createdAt user";
const REASON_MAX = 300;

const shopView = (a, productCounts) => ({
  id: a._id,
  shopName: a.shopName,
  slug: a.slug || "",
  description: a.bio || "",
  location: a.location || "",
  status: a.status || "approved", // no status = from before approval existed
  statusReason: a.statusReason || "",
  createdAt: a.createdAt,
  reviewedAt: a.reviewedAt || null,
  owner: a.user?.name || "",
  productCount: productCounts.get(String(a._id)) || 0,
});

// GET /api/admin/shops?status=pending|approved|rejected|suspended (omit for all).
// Pending shops: oldest first (review queue); otherwise newest first.
async function listShops(req, res) {
  const { status } = req.query;
  if (status !== undefined && !SHOP_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of ${SHOP_STATUSES.join(", ")}` });
  }
  const filter = !status ? {} : status === "approved" ? { status: { $in: ["approved", null] } } : { status };
  const shops = await Artisan.find(filter).select(ADMIN_SHOP_FIELDS).populate("user", "name")
    .sort({ createdAt: status === "pending" ? 1 : -1 });
  const counts = await Product.aggregate([
    { $match: { artisan: { $in: shops.map((a) => a._id) } } },
    { $group: { _id: "$artisan", n: { $sum: 1 } } },
  ]);
  const productCounts = new Map(counts.map((c) => [String(c._id), c.n]));
  res.json(shops.map((a) => shopView(a, productCounts)));
}

// Allowed status changes: action -> [statuses it applies to, resulting status].
const ACTIONS = {
  approve: [["pending", "rejected"], "approved"],
  reject: [["pending"], "rejected"],
  suspend: [["approved"], "suspended"],
  unsuspend: [["suspended"], "approved"],
};

// PUT /api/admin/shops/:id/:action  { reason? } (reason only for reject / suspend)
async function changeShopStatus(req, res) {
  const rule = Object.hasOwn(ACTIONS, req.params.action) ? ACTIONS[req.params.action] : null;
  if (!rule) return res.status(404).json({ error: "Unknown action" });
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Shop not found" });
  const reason = req.body?.reason === undefined ? "" : req.body.reason;
  if (typeof reason !== "string" || reason.trim().length > REASON_MAX) {
    return res.status(400).json({ error: `Reason must be text of ${REASON_MAX} characters or fewer` });
  }

  const shop = await Artisan.findById(req.params.id).select(ADMIN_SHOP_FIELDS).populate("user", "name");
  if (!shop) return res.status(404).json({ error: "Shop not found" });
  const [from, to] = rule;
  const current = shop.status || "approved";
  if (!from.includes(current)) {
    return res.status(409).json({ error: `Can't ${req.params.action} a shop that is ${current}`, code: "BAD_TRANSITION" });
  }

  shop.status = to;
  shop.statusReason = ["rejected", "suspended"].includes(to) ? reason.trim() : "";
  shop.reviewedAt = new Date();
  shop.reviewedBy = req.user.id;
  await shop.save();
  // Unsuspending also lands on "approved": the shop is live again.
  await notify(shop.user?._id, `shop_${to}`, { shopId: shop._id, ...(to === "rejected" && { reason: shop.statusReason }) }, "/profile");
  const productCount = await Product.countDocuments({ artisan: shop._id });
  res.json(shopView(shop, new Map([[String(shop._id), productCount]])));
}

module.exports = { listShops, changeShopStatus };

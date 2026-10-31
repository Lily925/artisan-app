const mongoose = require("mongoose");
const Cart = require("../models/Cart");
const Order = require("../models/Order");
const Product = require("../models/Product");
const Artisan = require("../models/Artisan");
const { VIDEO_TIERS } = require("../config/constants");
const { offersPatron } = require("../utils/pricing");
const { orderTotals } = require("../utils/orderTotals");
const payouts = require("../utils/payouts");
const { shopIsLive } = require("../utils/shops");

// Turns the buyer's cart into order items + totals, or explains why it can't be ordered.
// Used by PayPal checkout (paymentController.js). Returns { cart, items, totals } or { error }.
async function buildOrderFromCart(userId) {
  const fail = (status, error, code) => ({ error: { status, body: { error, ...(code && { code }) } } });
  const cart = await Cart.findOne({ user: userId }).populate("items.product");
  // Products deleted since they were added are already pulled from carts, but be safe.
  const lines = (cart?.items || []).filter((i) => i.product);
  if (lines.length === 0) return fail(400, "Cart is empty", "CART_EMPTY");
  const shops = new Set(lines.map((i) => String(i.product.artisan)));
  if (shops.size > 1) return fail(409, "An order can only contain products from one shop", "OTHER_SHOP");
  // Hidden products, or a shop that was suspended since they were added.
  const hidden = (await shopIsLive(lines[0].product.artisan)) ? lines.find((i) => i.product.isHidden) : lines[0];
  if (hidden) {
    return fail(409, `"${hidden.product.titleEn || hidden.product.title}" isn't available right now. Remove it from your cart.`, "PRODUCT_UNAVAILABLE");
  }
  const noPatron = lines.find((i) => i.tier === "patron" && !offersPatron(i.product));
  if (noPatron) {
    return fail(400, `The Patron tier is no longer offered for "${noPatron.product.titleEn || noPatron.product.title}". Remove it from your cart.`, "PATRON_UNAVAILABLE");
  }

  // Prices are re-read from the Product documents here, never trusted from the client.
  // The Patron bonus is copied too, so later product edits don't change what was promised.
  const items = lines.map((i) => ({
    product: i.product._id,
    artisan: i.product.artisan,
    title: i.product.title,
    image: i.product.images?.[0] || "", // cover snapshot
    titleEn: i.product.titleEn || "", // only used for the PayPal item name
    tier: i.tier,
    unitPrice: i.product.pricingTiers[i.tier].price,
    qty: i.qty,
    ...(i.tier === "patron" && { patronBonus: { mn: i.product.patronBonus.mn, en: i.product.patronBonus.en } }),
  }));
  // Same function as the cart preview, so the charged total matches what the buyer saw.
  return { cart, items, totals: orderTotals(items) };
}

// Orders are only created after a captured PayPal payment (POST /api/payments/paypal/...).
async function createOrder(req, res) {
  res.status(410).json({ error: "Checkout is through PayPal: POST /api/payments/paypal/orders", code: "USE_PAYPAL" });
}

async function listOrders(req, res) {
  // The buyer's own orders, without the artisan's payout details.
  const orders = await Order.find({ user: req.user.id })
    .select("-releases.receiver -releases.error -releases.senderBatchId -releases.payoutBatchId")
    .sort({ createdAt: -1 });
  res.json(orders);
}

// ── Order detail, milestones and video delivery ──
// Milestones: Ordered (pending = not paid, or paid) -> In production -> Shipped -> Completed.
// The order's artisan moves it forward one step at a time up to Shipped, starting only once
// it's paid; only the buyer can confirm receipt (Shipped -> Completed), which is where escrow
// release will hook in later. Unpaid orders (all from before PayPal) can't be advanced.
const MILESTONES = ["pending", "in_production", "shipped", "completed"];
const stepOf = (status) => (status === "paid" ? 0 : MILESTONES.indexOf(status));
const ARTISAN_NEXT = { paid: "in_production", in_production: "shipped" };
const BUYER_NEXT = { shipped: "completed" };
const MAX_VIDEO_URL = 500;

const needsVideo = (item) => VIDEO_TIERS.includes(item.tier);

// The shop an order belongs to. Items carry their artisan since the dashboard was added;
// older items are matched through their product. Null if it can't be told or is mixed.
async function orderArtisanId(order) {
  const ids = new Set(order.items.filter((i) => i.artisan).map((i) => String(i.artisan)));
  const legacy = order.items.filter((i) => !i.artisan).map((i) => i.product);
  if (legacy.length) {
    const products = await Product.find({ _id: { $in: legacy } }).select("artisan");
    if (products.length < legacy.length) return null; // a deleted product: shop unknown
    products.forEach((p) => ids.add(String(p.artisan)));
  }
  return ids.size === 1 ? [...ids][0] : null;
}

// Loads an order the caller may see: its buyer, or the artisan whose shop it belongs to.
// Anyone else gets 404, so other users can't even tell the order exists.
async function loadOrderForCaller(req, res) {
  const notFound = () => { res.status(404).json({ error: "Order not found" }); return null; };
  if (!mongoose.isValidObjectId(req.params.id)) return notFound();
  const order = await Order.findById(req.params.id);
  if (!order) return notFound();
  const [artisanId, myArtisan] = await Promise.all([
    orderArtisanId(order),
    Artisan.findOne({ user: req.user.id }).select("_id"),
  ]);
  const isBuyer = order.user.equals(req.user.id);
  const isArtisan = Boolean(myArtisan && artisanId && myArtisan._id.equals(artisanId));
  if (!isBuyer && !isArtisan) return notFound();
  return { order, artisanId, isBuyer, isArtisan };
}

// What the order page shows. Never includes anything about the buyer (name, email, id).
async function orderDetail({ order, artisanId, isBuyer, isArtisan }) {
  const [shop, products] = await Promise.all([
    artisanId ? Artisan.findById(artisanId).select("shopName instagramHandle user").populate("user", "name") : null,
    Product.find({ _id: { $in: order.items.map((i) => i.product) } }).select("titleEn images category"),
  ]);
  const productById = new Map(products.map((p) => [String(p._id), p]));
  const reachedAt = (status) => {
    const event = order.statusHistory.find((e) => e.status === status || (status === "pending" && e.status === "paid"));
    if (event) return event.at;
    return status === "pending" ? order.createdAt : null; // older orders have no history
  };
  const cancelled = order.status === "cancelled";
  const step = stepOf(order.status);
  const missingVideos = order.items.filter((i) => needsVideo(i) && !i.deliveryVideoUrl).length;
  const artisanNext = isArtisan ? ARTISAN_NEXT[order.status] || null : null;

  return {
    id: order._id,
    createdAt: order.createdAt,
    status: order.status,
    viewer: { isBuyer, isArtisan },
    shop: shop ? { shopName: shop.shopName || "", ownerName: shop.user?.name || "", instagramHandle: shop.instagramHandle || "" } : null,
    milestones: MILESTONES.map((status, i) => ({
      status,
      reached: !cancelled && i <= step,
      at: !cancelled && i <= step ? reachedAt(status) : null,
    })),
    items: order.items.map((item, index) => {
      const product = productById.get(String(item.product));
      return {
        index,
        title: item.title,
        titleEn: product?.titleEn || "",
        image: item.image || product?.images?.[0] || "",
        category: product?.category || "",
        tier: item.tier,
        unitPrice: item.unitPrice,
        qty: item.qty,
        patronBonus: item.tier === "patron" ? { mn: item.patronBonus?.mn || "", en: item.patronBonus?.en || "" } : null,
        needsVideo: needsVideo(item),
        deliveryVideoUrl: item.deliveryVideoUrl || "",
      };
    }),
    subtotal: order.subtotal,
    commissionFee: order.commissionFee,
    shipping: order.shipping,
    total: order.total,
    // Only this order's buyer and artisan ever get here; the artisan needs it to send the parcel.
    shippingAddress: order.shippingAddress || null,
    payout: payoutView(order, isArtisan),
    // Both sides see whether and when it was paid; only the buyer gets the PayPal reference.
    payment: order.payment?.capturedAt
      ? { paid: true, provider: order.payment.provider, capturedAt: order.payment.capturedAt, ...(isBuyer && { reference: order.payment.captureId }) }
      : { paid: false },
    actions: {
      artisanNext,
      // An unpaid order (from before payments existed) can't go into production.
      artisanWaitingForPayment: isArtisan && order.status === "pending",
      // Shipping a Story/Patron order needs every video attached first.
      artisanBlockedBy: artisanNext === "shipped" && missingVideos > 0 ? "missing_video" : null,
      buyerNext: isBuyer ? BUYER_NEXT[order.status] || null : null,
      canEditVideo: isArtisan && !["completed", "cancelled"].includes(order.status),
    },
  };
}

// Released vs held for the order page. The buyer sees amounts and states only; the artisan
// also sees PayPal's status and why a payout is waiting.
function payoutView(order, isArtisan) {
  if (!order.releases?.length) {
    if (!payouts.isPaidOrder(order)) return null; // unpaid (pre-PayPal) orders have nothing to release
    return payoutView({ releases: payouts.buildReleases(order) }, isArtisan);
  }
  const releases = order.releases.map((r) => ({
    milestone: r.milestone, percent: r.percent, amount: r.amount, status: r.status,
    ...(isArtisan && { payoutItemStatus: r.payoutItemStatus || null, sentAt: r.sentAt || null, paidAt: r.paidAt || null, error: r.error || null }),
  }));
  const net = order.releases.reduce((s, r) => s + Math.round(r.amount * 100), 0) / 100;
  return { net, ...payouts.summarize(order.releases), releases };
}

async function getOrder(req, res) {
  const access = await loadOrderForCaller(req, res);
  if (!access) return;
  // Pick up PayPal's latest payout status (PENDING -> SUCCESS etc.) before showing it.
  if (access.order.releases?.some((r) => r.status === "sent")) {
    access.order = await payouts.refreshSentReleases(access.order._id);
  }
  res.json(await orderDetail(access));
}

// Orders placed with the logged-in artisan's shop, newest first. No buyer details.
async function listShopOrders(req, res) {
  const artisan = await Artisan.findOne({ user: req.user.id }).select("_id");
  if (!artisan) return res.status(404).json({ error: "No artisan profile is linked to this account" });
  const productIds = (await Product.find({ artisan: artisan._id }).select("_id")).map((p) => p._id);
  const orders = await Order.find({
    $or: [{ "items.artisan": artisan._id }, { "items.product": { $in: productIds } }],
  }).sort({ createdAt: -1 });
  res.json(orders.map((o) => ({
    id: o._id,
    createdAt: o.createdAt,
    status: o.status,
    units: o.items.reduce((sum, i) => sum + i.qty, 0),
    subtotal: o.subtotal,
    tiers: [...new Set(o.items.map((i) => i.tier))],
    videosMissing: o.items.filter((i) => needsVideo(i) && !i.deliveryVideoUrl).length,
  })));
}

// Body { status }: the next milestone. One step at a time, never backwards.
async function advanceOrder(req, res) {
  const access = await loadOrderForCaller(req, res);
  if (!access) return;
  const { order, isBuyer, isArtisan } = access;
  const wanted = req.body?.status;

  const artisanNext = isArtisan ? ARTISAN_NEXT[order.status] : undefined;
  const buyerNext = isBuyer ? BUYER_NEXT[order.status] : undefined;
  if (!wanted || (wanted !== artisanNext && wanted !== buyerNext)) {
    const next = artisanNext || buyerNext;
    return res.status(409).json({
      error: next
        ? `Orders move one step at a time; the next step is "${next}"`
        : `You can't change this order's status now (it is "${order.status}")`,
      code: "BAD_STEP",
    });
  }
  if (wanted === "shipped" && order.items.some((i) => needsVideo(i) && !i.deliveryVideoUrl)) {
    return res.status(409).json({ error: "Attach the video link for every Story/Patron item before marking the order shipped", code: "MISSING_VIDEO" });
  }

  // Conditional on the current status, so two clicks (or two tabs) can't skip a step.
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, status: order.status },
    { $set: { status: wanted }, $push: { statusHistory: { status: wanted, at: new Date() } } },
    { new: true }
  );
  if (!updated) return res.status(409).json({ error: "This order was just updated. Reload and try again.", code: "BAD_STEP" });
  // Release this milestone's payout (and retry any earlier one still waiting). A PayPal
  // problem doesn't undo the step: the release stays pending/failed and shows on the page.
  let latest = updated;
  try {
    latest = (await payouts.processOrderReleases(updated._id)) || updated;
  } catch (err) {
    console.error(`Releasing payouts for order ${updated._id} failed: ${err.message}`);
  }
  res.json(await orderDetail({ ...access, order: latest }));
}

// Accepts only absolute https:// links (no embedded credentials), up to MAX_VIDEO_URL characters.
function cleanVideoUrl(value) {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw || raw.length > MAX_VIDEO_URL) return null;
  let url;
  try { url = new URL(raw); } catch { return null; }
  if (url.protocol !== "https:" || !url.hostname.includes(".") || url.username || url.password) return null;
  return url.href;
}

// Body { url }: the artisan attaches (or replaces) the video for one Story/Patron item.
async function setItemVideo(req, res) {
  const access = await loadOrderForCaller(req, res);
  if (!access) return;
  const { order, isArtisan } = access;
  if (!isArtisan) return res.status(403).json({ error: "Only the shop that made this order can add its video" });

  const index = Number(req.params.index);
  const item = Number.isInteger(index) ? order.items[index] : undefined;
  if (!item) return res.status(404).json({ error: "Order item not found" });
  if (!needsVideo(item)) return res.status(400).json({ error: "Basic items don't include a video" });
  const url = cleanVideoUrl(req.body?.url);
  if (!url) return res.status(400).json({ error: "Enter a full https:// link to the video", code: "BAD_URL" });

  const updated = await Order.findOneAndUpdate(
    { _id: order._id, status: { $nin: ["completed", "cancelled"] } },
    { $set: { [`items.${index}.deliveryVideoUrl`]: url } },
    { new: true }
  );
  if (!updated) return res.status(409).json({ error: "This order is closed" });
  res.json(await orderDetail({ ...access, order: updated }));
}

module.exports = { createOrder, listOrders, getOrder, listShopOrders, advanceOrder, setItemVideo, buildOrderFromCart };

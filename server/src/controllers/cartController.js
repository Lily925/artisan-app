const Cart = require("../models/Cart");
const Product = require("../models/Product");
const { TIERS } = require("../config/constants");
const { offersPatron } = require("../utils/pricing");
const { orderTotals } = require("../utils/orderTotals");

const PRODUCT_POPULATE = {
  path: "items.product",
  populate: { path: "artisan", populate: { path: "user", select: "name" } },
};

async function getOrCreateCart(userId) {
  let cart = await Cart.findOne({ user: userId });
  if (!cart) cart = await Cart.create({ user: userId, items: [] });
  return cart;
}

// The cart plus its totals, computed by the same function checkout uses (the frontend
// shows these instead of doing its own math).
function withTotals(cart) {
  const lines = cart.items.filter((i) => i.product).map((i) => ({ unitPrice: i.product.pricingTiers[i.tier].price, qty: i.qty }));
  return { ...cart.toJSON(), totals: orderTotals(lines) };
}

async function getCart(req, res) {
  const cart = await getOrCreateCart(req.user.id);
  await cart.populate(PRODUCT_POPULATE);
  res.json(withTotals(cart));
}

async function addItem(req, res) {
  const { productId, tier, qty } = req.body;
  if (!productId || !TIERS.includes(tier)) {
    return res.status(400).json({ error: `productId and tier (${TIERS.join("/")}) are required` });
  }
  const quantity = Math.max(1, Number(qty) || 1);

  const product = await Product.findById(productId);
  if (!product) return res.status(404).json({ error: "Product not found" });
  if (tier === "patron" && !offersPatron(product)) {
    return res.status(400).json({ error: "The Patron tier isn't offered for this product", code: "PATRON_UNAVAILABLE" });
  }

  const cart = await getOrCreateCart(req.user.id);
  // One shop per order (each order has a single artisan who runs its milestones),
  // so the cart only holds one shop's products at a time.
  const others = await Product.exists({
    _id: { $in: cart.items.map((i) => i.product) },
    artisan: { $ne: product.artisan },
  });
  if (others) {
    return res.status(409).json({ error: "Your cart has products from another shop. Check out or empty your cart first.", code: "OTHER_SHOP" });
  }
  const existing = cart.items.find((i) => i.product.toString() === productId && i.tier === tier);
  if (existing) existing.qty += quantity;
  else cart.items.push({ product: productId, tier, qty: quantity });

  await cart.save();
  await cart.populate(PRODUCT_POPULATE);
  res.status(201).json(withTotals(cart));
}

async function updateItem(req, res) {
  const { productId, tier, qty } = req.body;
  if (!productId || !TIERS.includes(tier) || !Number.isInteger(qty) || qty < 1) {
    return res.status(400).json({ error: `productId, tier (${TIERS.join("/")}), and a qty >= 1 are required` });
  }

  const cart = await getOrCreateCart(req.user.id);
  const item = cart.items.find((i) => i.product.toString() === productId && i.tier === tier);
  if (!item) return res.status(404).json({ error: "Item not in cart" });

  item.qty = qty;
  await cart.save();
  await cart.populate(PRODUCT_POPULATE);
  res.json(withTotals(cart));
}

async function removeItem(req, res) {
  const { productId, tier } = req.body;
  if (!productId || !TIERS.includes(tier)) {
    return res.status(400).json({ error: `productId and tier (${TIERS.join("/")}) are required` });
  }

  const cart = await getOrCreateCart(req.user.id);
  cart.items = cart.items.filter((i) => !(i.product.toString() === productId && i.tier === tier));
  await cart.save();
  await cart.populate(PRODUCT_POPULATE);
  res.json(withTotals(cart));
}

module.exports = { getCart, addItem, updateItem, removeItem };

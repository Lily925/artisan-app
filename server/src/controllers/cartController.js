const Cart = require("../models/Cart");
const Product = require("../models/Product");
const { TIERS } = require("../config/constants");

const PRODUCT_POPULATE = {
  path: "items.product",
  populate: { path: "artisan", populate: { path: "user", select: "name" } },
};

async function getOrCreateCart(userId) {
  let cart = await Cart.findOne({ user: userId });
  if (!cart) cart = await Cart.create({ user: userId, items: [] });
  return cart;
}

async function getCart(req, res) {
  const cart = await getOrCreateCart(req.user.id);
  await cart.populate(PRODUCT_POPULATE);
  res.json(cart);
}

async function addItem(req, res) {
  const { productId, tier, qty } = req.body;
  if (!productId || !TIERS.includes(tier)) {
    return res.status(400).json({ error: `productId and tier (${TIERS.join("/")}) are required` });
  }
  const quantity = Math.max(1, Number(qty) || 1);

  const product = await Product.findById(productId);
  if (!product) return res.status(404).json({ error: "Product not found" });

  const cart = await getOrCreateCart(req.user.id);
  const existing = cart.items.find((i) => i.product.toString() === productId && i.tier === tier);
  if (existing) existing.qty += quantity;
  else cart.items.push({ product: productId, tier, qty: quantity });

  await cart.save();
  await cart.populate(PRODUCT_POPULATE);
  res.status(201).json(cart);
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
  res.json(cart);
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
  res.json(cart);
}

module.exports = { getCart, addItem, updateItem, removeItem };

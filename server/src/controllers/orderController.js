const Cart = require("../models/Cart");
const Order = require("../models/Order");
const { COMMISSION_RATE, FLAT_SHIPPING_USD } = require("../config/constants");

function round2(n) {
  return Math.round(n * 100) / 100;
}

async function createOrder(req, res) {
  const cart = await Cart.findOne({ user: req.user.id }).populate("items.product");
  if (!cart || cart.items.length === 0) {
    return res.status(400).json({ error: "Cart is empty" });
  }

  // Prices are re-read from the Product documents here, never trusted from the client.
  const items = cart.items.map((i) => ({
    product: i.product._id,
    title: i.product.title,
    tier: i.tier,
    unitPrice: i.product.pricingTiers[i.tier].price,
    qty: i.qty,
  }));

  const subtotal = round2(items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0));
  const commissionFee = round2(subtotal * COMMISSION_RATE);
  const shipping = FLAT_SHIPPING_USD;
  const total = round2(subtotal + commissionFee + shipping);

  const order = await Order.create({
    user: req.user.id,
    items,
    subtotal,
    commissionFee,
    shipping,
    total,
  });

  cart.items = [];
  await cart.save();

  res.status(201).json(order);
}

async function listOrders(req, res) {
  const orders = await Order.find({ user: req.user.id }).sort({ createdAt: -1 });
  res.json(orders);
}

module.exports = { createOrder, listOrders };

const mongoose = require("mongoose");
const Cart = require("../models/Cart");
const Order = require("../models/Order");
const Checkout = require("../models/Checkout");
const paypal = require("../utils/paypal");
const { buildOrderFromCart } = require("./orderController");
const { buildReleases } = require("../utils/payouts");

// PayPal checkout (Orders v2, intent CAPTURE). The browser only ever sends a PayPal order id;
// amounts are always computed here from the buyer's cart, and the order is created only after
// PayPal reports the payment as captured for exactly that amount.
//   1. POST /api/payments/paypal/orders            -> { id } for the PayPal buttons
//   2. buyer approves in the PayPal window
//   3. POST /api/payments/paypal/orders/:id/capture -> { orderId } of the new paid order

const money = (n) => n.toFixed(2);

// Shipping address from the cart form. Returns { address } or { error }.
const ADDRESS_FIELDS = { name: [2, 100], address: [5, 200], city: [2, 100], country: [2, 60], phone: [6, 30] };
function readShippingAddress(body) {
  const input = body?.shippingAddress;
  if (!input || typeof input !== "object") return { error: "Enter a shipping address" };
  const address = {};
  for (const [field, [min, max]] of Object.entries(ADDRESS_FIELDS)) {
    const value = typeof input[field] === "string" ? input[field].trim().replace(/\s+/g, " ") : "";
    if (value.length < min || value.length > max) return { error: `Shipping address: ${field} must be ${min}-${max} characters`, field };
    address[field] = value;
  }
  if (!/^\+?[0-9][0-9 ()-]{4,28}$/.test(address.phone) || address.phone.replace(/\D/g, "").length < 6) {
    return { error: "Shipping address: enter a phone number (digits, spaces, +, -, brackets)", field: "phone" };
  }
  return { address };
}
const TIER_NAME = { basic: "Basic", story: "Story", patron: "Patron" };

function paypalError(res, err) {
  if (!(err instanceof paypal.PayPalError)) throw err;
  console.error(`PayPal error ${err.status} ${err.issue || ""} debug_id=${err.debugId || "-"}`);
  const status = err.status >= 500 || err.status === 401 ? 502 : 422;
  return res.status(status).json({ error: "PayPal couldn't process this payment. Please try again.", code: err.issue || "PAYPAL_ERROR" });
}

async function createPaypalOrder(req, res) {
  const { address, error: addressError, field } = readShippingAddress(req.body);
  if (addressError) return res.status(400).json({ error: addressError, code: "BAD_ADDRESS", field });
  const built = await buildOrderFromCart(req.user.id);
  if (built.error) return res.status(built.error.status).json(built.error.body);
  const { items, totals } = built;

  // Our id for this attempt doubles as the idempotency key and PayPal's reference/custom id.
  const checkoutId = new mongoose.Types.ObjectId();
  let created;
  try {
    created = await paypal.createOrder({
      intent: "CAPTURE",
      purchase_units: [{
        reference_id: String(checkoutId),
        custom_id: String(checkoutId),
        description: "Artisan marketplace order",
        amount: {
          currency_code: "USD",
          value: money(totals.total),
          breakdown: {
            item_total: { currency_code: "USD", value: money(totals.subtotal) },
            shipping: { currency_code: "USD", value: money(totals.shipping) },
            handling: { currency_code: "USD", value: money(totals.commissionFee) }, // 15% platform fee
          },
        },
        items: items.map((i) => ({
          name: `${i.titleEn || i.title} (${TIER_NAME[i.tier]})`.slice(0, 127),
          quantity: String(i.qty),
          unit_amount: { currency_code: "USD", value: money(i.unitPrice) },
          category: "PHYSICAL_GOODS",
        })),
      }],
      // No shipping address is collected yet (see HANDOFF); the brand name shows in the PayPal window.
      application_context: { brand_name: "Artisan", shipping_preference: "NO_SHIPPING", user_action: "PAY_NOW" },
    }, `create-${checkoutId}`);
  } catch (err) {
    return paypalError(res, err);
  }

  await Checkout.create({
    _id: checkoutId, user: req.user.id, paypalOrderId: created.id,
    items: items.map(({ titleEn, ...item }) => item), ...totals, currency: "USD", shippingAddress: address,
  });
  res.status(201).json({ id: created.id });
}

async function capturePaypalOrder(req, res) {
  const checkout = await Checkout.findOne({ paypalOrderId: String(req.params.id), user: req.user.id });
  if (!checkout) return res.status(404).json({ error: "Payment not found" });
  if (checkout.status === "completed") return res.json({ orderId: checkout.order, alreadyCaptured: true });

  // Claim it, so a double click or a second tab can't capture or create the order twice.
  const claimed = await Checkout.findOneAndUpdate(
    { _id: checkout._id, status: { $in: ["created", "failed"] } },
    { $set: { status: "capturing", failure: "" }, $inc: { attempts: 1 } },
    { new: true }
  );
  if (!claimed) return res.status(409).json({ error: "This payment is already being processed", code: "IN_PROGRESS" });

  let result;
  try {
    result = await paypal.captureOrder(checkout.paypalOrderId, `capture-${checkout._id}-${claimed.attempts}`);
  } catch (err) {
    // Captured on an earlier attempt whose response never reached us: PayPal won't charge
    // twice, so read the captured order and carry on creating ours.
    if (err instanceof paypal.PayPalError && err.issue === "ORDER_ALREADY_CAPTURED") {
      try { result = await paypal.getOrder(checkout.paypalOrderId); } catch (e) { err = e; }
    }
    if (!result) {
      await Checkout.updateOne({ _id: checkout._id }, { $set: { status: "failed", failure: err.issue || err.message } });
      return paypalError(res, err);
    }
  }

  const capture = result.purchase_units?.[0]?.payments?.captures?.[0];
  const amountOk = capture?.amount?.currency_code === "USD" && capture?.amount?.value === money(checkout.total);
  if (result.status !== "COMPLETED" || capture?.status !== "COMPLETED" || !amountOk) {
    // Money may have moved (e.g. a PENDING capture) - keep everything for a manual check.
    const reason = !amountOk ? "AMOUNT_MISMATCH" : `CAPTURE_${capture?.status || result.status}`;
    await Checkout.updateOne({ _id: checkout._id }, { $set: { status: "failed", failure: reason } });
    console.error(`PayPal capture not accepted: checkout ${checkout._id} ${reason}`);
    return res.status(402).json({ error: "The payment wasn't completed. You haven't been charged unless PayPal says otherwise.", code: reason });
  }

  const now = new Date();
  const order = await Order.create({
    user: checkout.user,
    items: checkout.items,
    subtotal: checkout.subtotal,
    commissionFee: checkout.commissionFee,
    shipping: checkout.shipping,
    total: checkout.total,
    status: "paid",
    statusHistory: [{ status: "paid", at: now }],
    ...(checkout.shippingAddress && { shippingAddress: checkout.shippingAddress }),
    // The artisan's 30/30/40 milestone payouts, all held until each milestone is reached.
    releases: buildReleases({ total: checkout.total, commissionFee: checkout.commissionFee }),
    payment: {
      provider: "paypal", paypalOrderId: checkout.paypalOrderId, captureId: capture.id,
      amount: checkout.total, currency: "USD", capturedAt: capture.create_time ? new Date(capture.create_time) : now,
    },
  });
  await Checkout.updateOne({ _id: checkout._id }, { $set: { status: "completed", order: order._id } });
  // Remove what was paid for from the cart (anything added meanwhile stays).
  const cart = await Cart.findOne({ user: checkout.user });
  if (cart) {
    const paid = new Set(checkout.items.map((i) => `${i.product}|${i.tier}`));
    cart.items = cart.items.filter((i) => !paid.has(`${i.product}|${i.tier}`));
    await cart.save();
  }
  res.status(201).json({ orderId: order._id });
}

// Public: lets the cart label sandbox payments as test mode. No credentials here.
function paypalConfig(req, res) {
  res.json({ mode: paypal.MODE, currency: "USD" });
}

module.exports = { createPaypalOrder, capturePaypalOrder, paypalConfig };

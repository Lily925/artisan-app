const mongoose = require("mongoose");

// One PayPal checkout attempt: the items and totals the buyer approved on PayPal, so the
// order is created from exactly what was paid for (not from a cart that changed meanwhile).
// status: created (PayPal order made, waiting for approval) -> capturing -> completed,
// or failed. The real Order only exists once the payment is captured.
const checkoutSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    paypalOrderId: { type: String, required: true, unique: true },
    items: { type: Array, required: true }, // order item snapshots (see Order.items)
    subtotal: { type: Number, required: true },
    commissionFee: { type: Number, required: true },
    shipping: { type: Number, required: true },
    total: { type: Number, required: true },
    currency: { type: String, default: "USD" },
    shippingAddress: { type: Object }, // validated at checkout; copied onto the order
    status: { type: String, enum: ["created", "capturing", "completed", "failed"], default: "created" },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    failure: { type: String, default: "" }, // PayPal issue code / reason, for support
    attempts: { type: Number, default: 0 }, // capture attempts (part of PayPal's request id)
  },
  { timestamps: true }
);

module.exports = mongoose.model("Checkout", checkoutSchema);

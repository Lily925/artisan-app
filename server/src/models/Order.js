const mongoose = require("mongoose");
const { TIERS } = require("../config/constants");

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    // Seller at the time of the order, so sales still count after a product is deleted.
    // Orders placed before this field existed don't have it (matched via the product instead).
    artisan: { type: mongoose.Schema.Types.ObjectId, ref: "Artisan" },
    title: { type: String, required: true },
    tier: { type: String, enum: TIERS, required: true },
    unitPrice: { type: Number, required: true },
    qty: { type: Number, required: true },
    // Patron only: the bonus as promised when the order was placed (later product edits don't change it).
    patronBonus: { mn: { type: String, default: "" }, en: { type: String, default: "" } },
    // Story/Patron only: https link to the artisan's video. Only the order's buyer and artisan see it.
    deliveryVideoUrl: { type: String, default: "" },
  },
  { _id: false }
);

// Where the artisan sends the order. Collected at checkout; shown only to the order's
// buyer and artisan. Orders from before 2026-10-12 have none.
const shippingAddressSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    address: { type: String, required: true },
    city: { type: String, required: true },
    country: { type: String, required: true },
    phone: { type: String, required: true },
  },
  { _id: false }
);

// One milestone payout to the artisan (see utils/payouts.js). Amounts in USD.
// status: held -> due (milestone reached) -> sending -> sent -> paid,
//         or pending_payout (no payout email yet) / failed (see error).
const releaseSchema = new mongoose.Schema(
  {
    milestone: { type: String, enum: ["in_production", "shipped", "completed"], required: true },
    percent: { type: Number, required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ["held", "due", "pending_payout", "sending", "sent", "paid", "failed"], default: "held" },
    dueAt: { type: Date },
    senderBatchId: { type: String }, // our id for the PayPal payout batch: one per release, so it can't be paid twice
    payoutBatchId: { type: String }, // PayPal's batch id once PayPal accepted the payout
    payoutItemStatus: { type: String }, // PayPal's latest item status (PENDING, SUCCESS, UNCLAIMED, ...)
    receiver: { type: String }, // payout email used (artisan-only)
    sentAt: { type: Date },
    paidAt: { type: Date },
    error: { type: String },
  },
  { _id: false }
);

// When each milestone was reached. Orders placed before milestones existed have none;
// their "Ordered" date is createdAt.
const statusEventSchema = new mongoose.Schema(
  { status: { type: String, required: true }, at: { type: Date, required: true } },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    items: { type: [orderItemSchema], required: true },
    subtotal: { type: Number, required: true },
    commissionFee: { type: Number, required: true },
    shipping: { type: Number, required: true },
    total: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "paid", "in_production", "shipped", "completed", "cancelled"],
      default: "pending",
    },
    statusHistory: { type: [statusEventSchema], default: [] },
    shippingAddress: { type: shippingAddressSchema, default: undefined },
    // Artisan payouts: 30% at In production, 30% at Shipped, 40% at Completed of
    // total - commissionFee (item prices + shipping). Created when the payment is captured.
    releases: { type: [releaseSchema], default: undefined },
    // Set when the order was paid through PayPal (orders placed before payments have none).
    payment: {
      provider: { type: String },
      paypalOrderId: { type: String },
      captureId: { type: String },
      amount: { type: Number },
      currency: { type: String },
      capturedAt: { type: Date },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);

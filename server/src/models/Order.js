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
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);

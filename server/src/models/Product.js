const mongoose = require("mongoose");

const tierSchema = new mongoose.Schema(
  {
    price: { type: Number, required: true },
    label: { type: String, default: "" },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    titleEn: { type: String, trim: true },
    description: { type: String, default: "" },
    category: { type: String, required: true, trim: true },
    artisan: { type: mongoose.Schema.Types.ObjectId, ref: "Artisan", required: true },
    pricingTiers: {
      basic: { type: tierSchema, required: true },
      story: { type: tierSchema, required: true },
      patron: { type: tierSchema, required: true },
    },
    images: { type: [String], default: [] },
    // Users who liked this product. Hidden from API responses; only likeCount is public.
    likedBy: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], default: [], select: false },
    likeCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);

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
    // What a Patron buyer gets on top of Story, written by the artisan (MN + EN).
    // Both empty = the Patron tier isn't offered for this product.
    patronBonus: {
      mn: { type: String, trim: true, maxlength: 100, default: "" },
      en: { type: String, trim: true, maxlength: 100, default: "" },
    },
    images: { type: [String], default: [] },
    // Users who liked this product. Hidden from API responses; only likeCount is public.
    likedBy: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], default: [], select: false },
    likeCount: { type: Number, default: 0, min: 0 },
    // Product-page views, deduplicated per viewer per 24h (see utils/productViews.js).
    // Private to the owning artisan's dashboard, so hidden from API responses.
    viewCount: { type: Number, default: 0, min: 0, select: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);

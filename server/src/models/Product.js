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
    // Up to 5 photo URLs/paths in display order; images[0] is the cover (cards, cart, orders).
    images: {
      type: [String],
      default: [],
      validate: { validator: (v) => v.length <= 5, message: "A product can have at most 5 photos" },
    },
    // Legacy single photo (older data model). Never written any more; read as images[0] (see below).
    image: { type: String, select: true },
    // Hidden products are left out of the public catalog, shop/portfolio pages, artisan
    // matching, carts and checkout. Only the owning artisan still sees them (marked
    // isHidden: true) and can open their product page.
    isHidden: { type: Boolean, default: false, index: true },
    // Users who liked this product. Hidden from API responses; only likeCount is public.
    likedBy: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], default: [], select: false },
    likeCount: { type: Number, default: 0, min: 0 },
    // Product-page views, deduplicated per viewer per 24h (see utils/productViews.js).
    // Private to the owning artisan's dashboard, so hidden from API responses.
    viewCount: { type: Number, default: 0, min: 0, select: false },
  },
  { timestamps: true }
);

// Backward compatibility: a document that only has the old single `image` field is read as
// images: [image], so it displays like any other product (and is stored that way on next save).
productSchema.post("init", function migrateLegacyImage(doc) {
  if (doc.image && (!doc.images || doc.images.length === 0)) {
    doc.images = [doc.image];
    doc.image = undefined;
  }
});

module.exports = mongoose.model("Product", productSchema);

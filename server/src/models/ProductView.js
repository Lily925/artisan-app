const mongoose = require("mongoose");

// One row per (product, viewer) while that viewer's last counted view is under 24h old.
// MongoDB's TTL monitor deletes rows after 24h (it runs about once a minute, so
// productViews.js also accepts an expired row that hasn't been swept yet).
// viewerKey is "u:<userId>" or "s:<browser session id>"; never returned by the API.
const productViewMarkSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  viewerKey: { type: String, required: true },
  lastAt: { type: Date, required: true, expires: 24 * 60 * 60 },
});
productViewMarkSchema.index({ product: 1, viewerKey: 1 }, { unique: true });

// Counted views per product per day (Ulaanbaatar calendar day, "YYYY-MM-DD"), for the
// dashboard's 30-day chart. demo: true rows come from seed/demo.js and are removed with it.
const productViewDailySchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  day: { type: String, required: true },
  demo: { type: Boolean, default: false },
  count: { type: Number, default: 0, min: 0 },
});
productViewDailySchema.index({ product: 1, day: 1, demo: 1 }, { unique: true });

module.exports = {
  ProductViewMark: mongoose.model("ProductViewMark", productViewMarkSchema),
  ProductViewDaily: mongoose.model("ProductViewDaily", productViewDailySchema),
};

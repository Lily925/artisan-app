const mongoose = require("mongoose");

// Who has already been counted in a product's "saved" notification, and when they last set it
// off (utils/notify.js). Kept after un-favoriting, so favoriting again doesn't notify again
// within 24 hours or count the same person twice. Never returned by the API.
const productSaveMarkSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  at: { type: Date, required: true },
});
productSaveMarkSchema.index({ product: 1, user: 1 }, { unique: true });

module.exports = mongoose.model("ProductSaveMark", productSaveMarkSchema);

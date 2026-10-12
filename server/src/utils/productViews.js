const Product = require("../models/Product");
const { ProductViewMark, ProductViewDaily } = require("../models/ProductView");
const { shopDay } = require("./dates");

const REPEAT_WINDOW_MS = 24 * 60 * 60 * 1000;

// Counts one view of `product` by `viewerKey` unless that viewer already had a view
// counted in the last 24h. Atomic: the unique (product, viewerKey) index means two
// simultaneous requests can't both count. Returns true when the view was counted.
async function recordProductView(product, viewerKey, now = new Date()) {
  let counted = false;
  try {
    await ProductViewMark.create({ product: product._id, viewerKey, lastAt: now });
    counted = true;
  } catch (err) {
    if (err.code !== 11000) throw err;
    // A mark exists. Count only if it's older than 24h (TTL sweep hasn't removed it yet).
    const res = await ProductViewMark.updateOne(
      { product: product._id, viewerKey, lastAt: { $lte: new Date(now.getTime() - REPEAT_WINDOW_MS) } },
      { $set: { lastAt: now } }
    );
    counted = res.modifiedCount === 1;
  }
  if (!counted) return false;

  await Promise.all([
    Product.updateOne({ _id: product._id }, { $inc: { viewCount: 1 } }),
    ProductViewDaily.updateOne(
      { product: product._id, day: shopDay(now), demo: false },
      { $inc: { count: 1 } },
      { upsert: true }
    ),
  ]);
  return true;
}

module.exports = { recordProductView };

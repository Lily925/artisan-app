const Artisan = require("../models/Artisan");
const Product = require("../models/Product");

// Owners can't favorite their own products any more, but one made before that rule must not
// count. Takes products as loaded (artisan as an id or populated) and lowers likeCount in
// memory where the owner is among the likers; nothing is saved.
async function ignoreSelfLikes(products) {
  if (products.length === 0) return products;
  const shopIds = [...new Set(products.map((p) => String(p.artisan?._id || p.artisan)))];
  const shops = await Artisan.find({ _id: { $in: shopIds } }).select("user").lean();
  if (shops.length === 0) return products;
  const selfLiked = await Product.find({
    _id: { $in: products.map((p) => p._id) },
    $or: shops.map((s) => ({ artisan: s._id, likedBy: s.user })),
  }).select("_id").lean();
  const ids = new Set(selfLiked.map((p) => String(p._id)));
  for (const p of products) if (ids.has(String(p._id))) p.likeCount = Math.max(0, (p.likeCount || 0) - 1);
  return products;
}

module.exports = { ignoreSelfLikes };

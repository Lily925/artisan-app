const mongoose = require("mongoose");
const Product = require("../models/Product");
const Artisan = require("../models/Artisan");
const Cart = require("../models/Cart");
const { pricingTiersFor } = require("../utils/pricing");
const { saveProductPhoto, deleteProductPhoto } = require("../utils/imageStorage");
const { recordProductView } = require("../utils/productViews");
const { ProductViewMark } = require("../models/ProductView");

const ARTISAN_POPULATE = { path: "artisan", populate: { path: "user", select: "name" } };

async function listProducts(req, res) {
  const { category } = req.query;
  if (category !== undefined && typeof category !== "string") {
    return res.status(400).json({ error: "category must be a string" });
  }
  const filter = {};
  if (category) filter.category = category;

  const products = await Product.find(filter).populate(ARTISAN_POPULATE).sort({ createdAt: -1 });
  res.json(products);
}

async function getProduct(req, res) {
  const product = await Product.findById(req.params.id).populate(ARTISAN_POPULATE);
  if (!product) return res.status(404).json({ error: "Product not found" });
  res.json(product);
}

// Keys match the frontend's productCategories list.
const CATEGORIES = ["jewelry", "ceramics", "art", "textile", "crafts", "leather", "wood"];
const MAX_PRICE_USD = 10000;
const MAX_BONUS_CHARS = 100;
const text = (v) => (typeof v === "string" ? v.trim() : "");

// Reads + validates the multipart product fields shared by create and update.
function readProductFields(body) {
  const fields = {
    title: text(body.title),
    titleEn: text(body.titleEn),
    description: text(body.description),
    category: text(body.category),
    basicPrice: Math.round(Number(body.price) * 100) / 100,
    // Optional; leaving both empty means no Patron tier for this product.
    patronBonus: { mn: text(body.patronBonusMn), en: text(body.patronBonusEn) },
  };
  const problems = [];
  if (!fields.title || fields.title.length > 120) problems.push("Mongolian name is required (max 120 characters)");
  if (!fields.titleEn || fields.titleEn.length > 120) problems.push("English name is required (max 120 characters)");
  if (!CATEGORIES.includes(fields.category)) problems.push("Choose a valid category");
  if (fields.description.length > 2000) problems.push("Description must be 2000 characters or fewer");
  if (fields.patronBonus.mn.length > MAX_BONUS_CHARS || fields.patronBonus.en.length > MAX_BONUS_CHARS) {
    problems.push(`Patron bonus must be ${MAX_BONUS_CHARS} characters or fewer`);
  }
  if (!(fields.basicPrice > 0 && fields.basicPrice <= MAX_PRICE_USD)) problems.push(`Price must be between $0.01 and $${MAX_PRICE_USD}`);
  return { fields, problems };
}

// Loads a product the logged-in artisan owns. Sends 404/403 and returns null otherwise.
async function findOwnProduct(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) { res.status(404).json({ error: "Product not found" }); return null; }
  const [product, artisan] = await Promise.all([
    Product.findById(req.params.id),
    Artisan.findOne({ user: req.user.id }).select("_id"),
  ]);
  if (!product) { res.status(404).json({ error: "Product not found" }); return null; }
  if (!artisan || !product.artisan.equals(artisan._id)) {
    res.status(403).json({ error: "You can only change your own products" });
    return null;
  }
  return product;
}

// Artisan self-service: multipart form with fields title, titleEn, category,
// description, price (Basic, USD), optional patronBonusMn / patronBonusEn and one
// required "photo" file.
async function createProduct(req, res) {
  const artisan = await Artisan.findOne({ user: req.user.id });
  if (!artisan) {
    return res.status(400).json({ error: "No artisan profile is linked to this account yet" });
  }

  const { fields, problems } = readProductFields(req.body);
  if (!req.file) problems.push("A product photo is required");
  if (problems.length) return res.status(400).json({ error: problems.join(". ") });

  // Only now touch storage, and clean up if the product can't be created.
  const imageUrl = await saveProductPhoto(req.file);
  let product;
  try {
    const { basicPrice, ...rest } = fields;
    // Story/Patron are always derived from Basic so the catalog stays consistent.
    product = await Product.create({
      ...rest, images: [imageUrl], pricingTiers: pricingTiersFor(basicPrice), artisan: artisan._id,
    });
  } catch (err) {
    await deleteProductPhoto(imageUrl);
    if (err.name === "ValidationError") return res.status(400).json({ error: err.message });
    throw err;
  }

  await product.populate(ARTISAN_POPULATE);
  res.status(201).json(product);
}

// Same fields as create; "photo" is optional here and replaces the current one.
async function updateProduct(req, res) {
  const product = await findOwnProduct(req, res);
  if (!product) return;

  const { fields, problems } = readProductFields(req.body);
  if (problems.length) return res.status(400).json({ error: problems.join(". ") });

  const oldImages = [...product.images];
  const newImageUrl = req.file ? await saveProductPhoto(req.file) : null;
  const { basicPrice, ...rest } = fields;
  Object.assign(product, rest, { pricingTiers: pricingTiersFor(basicPrice) });
  if (newImageUrl) product.images = [newImageUrl];

  try {
    await product.save();
  } catch (err) {
    await deleteProductPhoto(newImageUrl);
    if (err.name === "ValidationError") return res.status(400).json({ error: err.message });
    throw err;
  }
  // Old uploaded photo is only removed once the new one is safely saved.
  // (deleteProductPhoto ignores seeded /images/... files.)
  if (newImageUrl) await Promise.all(oldImages.map(deleteProductPhoto));

  await product.populate(ARTISAN_POPULATE);
  res.json(product);
}

// Deletes the product, its uploaded photo, and any cart lines pointing at it.
// Past orders are unaffected: they store their own title/price snapshot.
async function deleteProduct(req, res) {
  const product = await findOwnProduct(req, res);
  if (!product) return;

  await Product.deleteOne({ _id: product._id });
  await Cart.updateMany({ "items.product": product._id }, { $pull: { items: { product: product._id } } });
  // Daily view totals stay so the shop's 30-day views chart doesn't change retroactively.
  await ProductViewMark.deleteMany({ product: product._id });
  await Promise.all(product.images.map(deleteProductPhoto));
  res.json({ deleted: true, id: product._id });
}

// ── Likes ──
// Both updates are conditional on the current state, so repeated or concurrent
// requests can't double-count or push likeCount below zero.

async function likeState(productId, userId) {
  const product = await Product.findById(productId).select("likeCount");
  if (!product) return null;
  const liked = Boolean(await Product.exists({ _id: productId, likedBy: userId }));
  return { liked, likeCount: product.likeCount };
}

async function likeProduct(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(404).json({ error: "Product not found" });
  await Product.updateOne(
    { _id: id, likedBy: { $ne: req.user.id } },
    { $push: { likedBy: req.user.id }, $inc: { likeCount: 1 } }
  );
  const state = await likeState(id, req.user.id);
  if (!state) return res.status(404).json({ error: "Product not found" });
  res.json(state);
}

async function unlikeProduct(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(404).json({ error: "Product not found" });
  await Product.updateOne(
    { _id: id, likedBy: req.user.id },
    { $pull: { likedBy: req.user.id }, $inc: { likeCount: -1 } }
  );
  const state = await likeState(id, req.user.id);
  if (!state) return res.status(404).json({ error: "Product not found" });
  res.json(state);
}

// ids of the products the current user has liked
async function listMyLikes(req, res) {
  const liked = await Product.find({ likedBy: req.user.id }).select("_id");
  res.json(liked.map((p) => p._id));
}

// Browser session id sent by logged-out visitors (src/api.js makes one per tab session).
const SESSION_ID = /^[A-Za-z0-9-]{16,64}$/;

// Called when a product page is opened. Repeat views by the same logged-in user (or the
// same browser session when logged out) within 24h aren't counted, nor are the owning
// artisan's own views. Nothing about the viewer is ever shown to the artisan.
async function recordView(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Product not found" });
  const product = await Product.findById(req.params.id).select("artisan");
  if (!product) return res.status(404).json({ error: "Product not found" });

  let viewerKey = null;
  if (req.user) {
    const own = await Artisan.exists({ _id: product.artisan, user: req.user.id });
    if (own) return res.json({ counted: false });
    viewerKey = `u:${req.user.id}`;
  } else {
    const session = req.get("X-Viewer-Session");
    if (typeof session === "string" && SESSION_ID.test(session)) viewerKey = `s:${session}`;
  }
  // Without a user or session there's no way to spot repeats, so don't count it.
  if (!viewerKey) return res.json({ counted: false });

  res.json({ counted: await recordProductView(product, viewerKey) });
}

module.exports = {
  listProducts, getProduct, createProduct, updateProduct, deleteProduct,
  likeProduct, unlikeProduct, listMyLikes, recordView,
};

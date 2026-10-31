const mongoose = require("mongoose");
const Product = require("../models/Product");
const Artisan = require("../models/Artisan");
const Cart = require("../models/Cart");
const { pricingTiersFor } = require("../utils/pricing");
const Order = require("../models/Order");
const { saveProductPhotos, deleteProductPhoto, MAX_PRODUCT_PHOTOS } = require("../utils/imageStorage");
const { recordProductView } = require("../utils/productViews");
const { ProductViewMark } = require("../models/ProductView");

const { ARTISAN_USER_PUBLIC } = require("../config/constants");
const { isShopLive, shopIsLive, notLiveShopIds } = require("../utils/shops");

const ARTISAN_POPULATE = { path: "artisan", populate: { path: "user", select: ARTISAN_USER_PUBLIC } };

// Query condition for products the caller may see: everything not hidden from approved
// shops, plus all of the caller's own products when they're the owning artisan.
async function visibleTo(user) {
  const visible = { isHidden: { $ne: true }, artisan: { $nin: await notLiveShopIds() } };
  if (user?.role !== "artisan") return visible;
  const own = await Artisan.findOne({ user: user.id }).select("_id");
  return own ? { $or: [visible, { artisan: own._id }] } : visible;
}

async function listProducts(req, res) {
  const { category } = req.query;
  if (category !== undefined && typeof category !== "string") {
    return res.status(400).json({ error: "category must be a string" });
  }
  const filter = await visibleTo(req.user);
  if (category) filter.category = category;

  const products = await Product.find(filter).populate(ARTISAN_POPULATE).sort({ createdAt: -1 });
  res.json(products);
}

async function getProduct(req, res) {
  const product = await Product.findOne({ _id: req.params.id, ...(await visibleTo(req.user)) }).populate(ARTISAN_POPULATE);
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

const SHOP_NOT_APPROVED = { error: "Your shop must be approved by an admin before you can add or edit products", code: "SHOP_NOT_APPROVED" };

// Loads a product the caller may change: its own artisan, or an admin. Sends 404/403
// and returns null otherwise. With mustBeLive, an owning artisan's shop must also be
// approved (admins are exempt).
async function findOwnProduct(req, res, { mustBeLive = false } = {}) {
  if (!mongoose.isValidObjectId(req.params.id)) { res.status(404).json({ error: "Product not found" }); return null; }
  const [product, artisan] = await Promise.all([
    Product.findById(req.params.id),
    req.user.role === "artisan" ? Artisan.findOne({ user: req.user.id }).select("_id status") : null,
  ]);
  if (!product) { res.status(404).json({ error: "Product not found" }); return null; }
  const isOwner = Boolean(artisan && product.artisan.equals(artisan._id));
  if (!isOwner && req.user.role !== "admin") {
    res.status(403).json({ error: "You can only change your own products" });
    return null;
  }
  if (mustBeLive && isOwner && req.user.role !== "admin" && !isShopLive(artisan)) {
    res.status(403).json(SHOP_NOT_APPROVED);
    return null;
  }
  return product;
}

// Photo files are deleted when a product stops using them, except when an order's item
// still shows that photo (orders keep the cover as it was at purchase time).
async function releaseProductPhotos(urls) {
  for (const url of urls) {
    if (!(await Order.exists({ "items.image": url }))) await deleteProductPhoto(url);
  }
}

// Update: the new photo list, in display order (first = cover), as a JSON array in the
// "imageOrder" field. Each entry is a URL the product already has (kept) or "new:<i>"
// for the i-th uploaded file. Returns { order } or { error }.
function readImageOrder(raw, currentImages, newFileCount) {
  let order;
  try { order = JSON.parse(raw); } catch { return { error: "imageOrder must be a JSON array" }; }
  if (!Array.isArray(order) || !order.every((x) => typeof x === "string")) return { error: "imageOrder must be a JSON array of strings" };
  if (order.length === 0) return { error: "A product needs at least one photo" };
  if (order.length > MAX_PRODUCT_PHOTOS) return { error: `A product can have at most ${MAX_PRODUCT_PHOTOS} photos` };
  if (new Set(order).size !== order.length) return { error: "imageOrder lists a photo twice" };
  const usedNew = new Set();
  for (const entry of order) {
    const m = /^new:(\d+)$/.exec(entry);
    if (m) {
      const i = Number(m[1]);
      if (i >= newFileCount) return { error: `imageOrder refers to a photo that wasn't uploaded (${entry})` };
      usedNew.add(i);
    } else if (!currentImages.includes(entry)) {
      return { error: "imageOrder can only keep this product's own photos" };
    }
  }
  if (usedNew.size !== newFileCount) return { error: "Every uploaded photo must be placed in imageOrder" };
  return { order };
}

// Artisan self-service: multipart form with fields title, titleEn, category,
// description, price (Basic, USD), optional patronBonusMn / patronBonusEn and 1-5
// "photos" files (JPEG/PNG/WebP, 2 MB each), in display order: the first is the cover.
async function createProduct(req, res) {
  const artisan = await Artisan.findOne({ user: req.user.id });
  if (!artisan) {
    return res.status(400).json({ error: "No artisan profile is linked to this account yet" });
  }
  // Pending / rejected / suspended shops can't publish.
  if (!isShopLive(artisan)) {
    return res.status(403).json(SHOP_NOT_APPROVED);
  }

  const { fields, problems } = readProductFields(req.body);
  const files = req.files || [];
  if (files.length === 0) problems.push("Add at least one product photo");
  if (problems.length) return res.status(400).json({ error: problems.join(". ") });

  // Only now touch storage, and clean up if the product can't be created.
  const images = await saveProductPhotos(files);
  let product;
  try {
    const { basicPrice, ...rest } = fields;
    // Story/Patron are always derived from Basic so the catalog stays consistent.
    product = await Product.create({
      ...rest, images, pricingTiers: pricingTiersFor(basicPrice), artisan: artisan._id,
    });
  } catch (err) {
    await Promise.all(images.map(deleteProductPhoto));
    if (err.name === "ValidationError") return res.status(400).json({ error: err.message });
    throw err;
  }

  await product.populate(ARTISAN_POPULATE);
  res.status(201).json(product);
}

// Same fields as create (owner or admin). Photos: "imageOrder" (see readImageOrder) plus any
// new "photos" files. Without imageOrder, uploaded photos replace all current ones, and
// with no photos at all the current ones stay.
async function updateProduct(req, res) {
  const product = await findOwnProduct(req, res, { mustBeLive: true });
  if (!product) return;

  const { fields, problems } = readProductFields(req.body);
  if (problems.length) return res.status(400).json({ error: problems.join(". ") });

  const files = req.files || [];
  const oldImages = [...product.images];
  let order = null;
  if (req.body.imageOrder !== undefined) {
    const parsed = readImageOrder(req.body.imageOrder, oldImages, files.length);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    order = parsed.order;
  } else if (files.length) {
    order = files.map((_, i) => `new:${i}`);
  }

  // Storage is only touched after everything above is valid.
  const newUrls = await saveProductPhotos(files);
  const { basicPrice, ...rest } = fields;
  Object.assign(product, rest, { pricingTiers: pricingTiersFor(basicPrice) });
  if (order) product.images = order.map((entry) => (entry.startsWith("new:") ? newUrls[Number(entry.slice(4))] : entry));

  try {
    await product.save();
  } catch (err) {
    await Promise.all(newUrls.map(deleteProductPhoto));
    if (err.name === "ValidationError") return res.status(400).json({ error: err.message });
    throw err;
  }
  // Photos the product no longer uses are removed only once the new list is saved.
  // (deleteProductPhoto ignores seeded /images/... files.)
  await releaseProductPhotos(oldImages.filter((url) => !product.images.includes(url)));

  await product.populate(ARTISAN_POPULATE);
  res.json(product);
}

// Deletes the product (owner or admin), its uploaded photos, and any cart lines pointing at
// it. Past orders are unaffected: they store their own title/price/cover snapshot.
async function deleteProduct(req, res) {
  const product = await findOwnProduct(req, res);
  if (!product) return;

  await Product.deleteOne({ _id: product._id });
  await Cart.updateMany({ "items.product": product._id }, { $pull: { items: { product: product._id } } });
  // Daily view totals stay so the shop's 30-day views chart doesn't change retroactively.
  await ProductViewMark.deleteMany({ product: product._id });
  await releaseProductPhotos(product.images);
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
    { _id: id, likedBy: { $ne: req.user.id }, isHidden: { $ne: true }, artisan: { $nin: await notLiveShopIds() } },
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
  const product = await Product.findById(req.params.id).select("artisan isHidden");
  if (!product || product.isHidden || !(await shopIsLive(product.artisan))) return res.status(404).json({ error: "Product not found" });

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

const Notification = require("../models/Notification");
const User = require("../models/User");
const Artisan = require("../models/Artisan");
const ProductSaveMark = require("../models/ProductSaveMark");

// What each notification type may store. Anything else passed in is dropped, so a caller
// can't put personal data (email, phone, address) into the database by accident.
const PARAMS_BY_TYPE = {
  // Buyer
  offer_received: ["commissionId", "shopName"],
  order_in_production: ["orderId", "shopName"],
  order_shipped: ["orderId", "shopName"],
  order_completed: ["orderId", "shopName"],
  // Artisan
  order_paid: ["orderId", "units"],
  commission_match: ["commissionId", "category"],
  order_confirmed: ["orderId"],
  payout_released: ["orderId", "amount", "percent", "milestone"],
  shop_approved: ["shopId"],
  shop_rejected: ["shopId", "reason"],
  shop_suspended: ["shopId"],
  // Admin
  shop_pending: ["shopId", "shopName"],
  // Artisan (see notifyProductSaved): never who saved it
  product_saved: ["productId", "title", "titleEn", "count"],
  // Artisan: a new review. Buyer: the artisan replied. Never the text, nor who wrote it.
  review_received: ["productId", "title", "titleEn", "rating"],
  review_replied: ["productId", "title", "titleEn", "shopName"],
};
// What the bell shows. Older types in the database (e.g. chat messages, which only have their
// own badge now) are left out.
const NOTIFICATION_TYPES = Object.keys(PARAMS_BY_TYPE);
const SAVE_REPEAT_MS = 24 * 60 * 60 * 1000;
const MAX_TEXT = 300;

function cleanParams(type, params) {
  const clean = {};
  for (const key of PARAMS_BY_TYPE[type]) {
    const value = params?.[key];
    if (value === undefined || value === null || value === "") continue;
    clean[key] = typeof value === "string" ? value.slice(0, MAX_TEXT) : typeof value === "number" ? value : String(value);
  }
  return clean;
}

// The one way notifications are created. `recipients` is a user id, a list of ids, or an
// async function returning either (so looking them up is covered too). Never throws: a
// notification problem is logged and must not break the order, offer or shop action.
async function notify(recipients, type, params = {}, link = "") {
  try {
    if (!Object.hasOwn(PARAMS_BY_TYPE, type)) throw new Error("unknown type");
    const resolved = typeof recipients === "function" ? await recipients() : recipients;
    const users = [...new Set([resolved].flat().filter(Boolean).map(String))];
    if (users.length === 0) return;
    const clean = cleanParams(type, params);
    await Notification.insertMany(users.map((user) => ({ user, type, params: clean, link })), { ordered: false });
  } catch (err) {
    console.error(`Notification "${type}" failed: ${err.message}`);
  }
}

// A new shop is waiting for approval (sign-up and "Set up your shop").
const notifyAdminsOfNewShop = (shop) => notify(
  () => User.find({ role: "admin" }).distinct("_id"),
  "shop_pending",
  { shopId: shop._id, shopName: shop.shopName },
  "/admin/shops",
);

// Decides what a favorite means for the product's notification: "new" for someone not counted
// yet, "again" for someone counted over 24 hours ago, null within 24 hours.
async function claimSave(productId, userId) {
  const now = new Date();
  const repeat = await ProductSaveMark.findOneAndUpdate(
    { product: productId, user: userId, at: { $lte: new Date(now - SAVE_REPEAT_MS) } },
    { $set: { at: now } },
  );
  if (repeat) return "again";
  try {
    await ProductSaveMark.create({ product: productId, user: userId, at: now });
    return "new";
  } catch (err) {
    if (err.code === 11000) return null;
    throw err;
  }
}

// One notification per product for its artisan, however many people save it: each new person
// raises the count, and it comes back to the top as unread. Says nothing about who. Never throws.
async function notifyProductSaved(product, userId) {
  try {
    const claim = await claimSave(product._id, userId);
    if (!claim) return;
    const shop = await Artisan.findById(product.artisan).select("user").lean();
    if (!shop) return;
    const id = String(product._id);
    const update = () => Notification.updateOne(
      { user: shop.user, type: "product_saved", "params.productId": id },
      {
        $set: { readAt: null, createdAt: new Date(), link: `/products/${id}`, "params.title": product.title, "params.titleEn": product.titleEn || "" },
        $inc: { "params.count": claim === "new" ? 1 : 0 },
      },
      { upsert: true },
    );
    // Two at once can both try to insert: the unique index stops one, which then just updates.
    await update().catch((err) => { if (err.code === 11000) return update(); throw err; });
  } catch (err) {
    console.error(`Notification "product_saved" failed: ${err.message}`);
  }
}

module.exports = { notify, notifyAdminsOfNewShop, notifyProductSaved, NOTIFICATION_TYPES };

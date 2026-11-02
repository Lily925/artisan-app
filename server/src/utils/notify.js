const Notification = require("../models/Notification");
const User = require("../models/User");

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
  // Either side of a chat (the message text is never included)
  new_message: ["conversationId", "name", "count"],
};
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

// A chat message arrived. One unread notification per conversation, however many messages:
// a further message moves it back to the top and bumps its count. Never throws.
async function notifyNewMessage(recipient, conversationId, senderName) {
  try {
    const id = String(conversationId);
    await Notification.updateOne(
      { user: recipient, type: "new_message", "params.conversationId": id, readAt: null },
      {
        $set: { createdAt: new Date(), link: `/messages/${id}`, "params.name": String(senderName || "").slice(0, MAX_TEXT) },
        $inc: { "params.count": 1 },
      },
      { upsert: true },
    );
  } catch (err) {
    console.error(`Notification "new_message" failed: ${err.message}`);
  }
}

module.exports = { notify, notifyAdminsOfNewShop, notifyNewMessage };

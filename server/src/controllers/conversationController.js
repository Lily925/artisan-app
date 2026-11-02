const mongoose = require("mongoose");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const Artisan = require("../models/Artisan");
const Product = require("../models/Product");
const Order = require("../models/Order");
const User = require("../models/User");
const { isShopLive } = require("../utils/shops");
const { orderArtisanId } = require("./orderController");

// Buyer-to-shop chat. Only the conversation's buyer and the shop's owner get anywhere here;
// everyone else, admins included, gets the same 404 as for a conversation that doesn't exist.
// Responses are built by hand from a few fields: the other side is the shop's name and photo
// (to the buyer) or the buyer's display name (to the artisan), never an email, phone, address
// or user id.
const MESSAGE_MAX = 1000;
const PAGE = 30;
const PREVIEW = 120;
const LIST_MAX = 50;

const notFound = (res, what = "Conversation") => res.status(404).json({ error: `${what} not found` });
const validId = (v) => typeof v === "string" && mongoose.isValidObjectId(v);
const myShopOf = (userId) => Artisan.findOne({ user: userId }).select("_id");
// Control characters other than tab and newline are dropped.
const cleanText = (v) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim() : "");

const shopNotOpen = (res) => res.status(403).json({ error: "This shop can't receive messages right now", code: "SHOP_NOT_APPROVED" });

// ── views ──
const messageView = (m, viewerId) => ({
  id: m._id,
  text: m.text,
  mine: String(m.sender) === String(viewerId),
  createdAt: m.createdAt,
  readAt: m.readAt || null,
});

// The pinned card, always read from the database. Nothing if what it points to is gone.
async function contextCard(conversation, isOwner) {
  if (conversation.product) {
    const p = await Product.findById(conversation.product).select("title titleEn images image pricingTiers.basic isHidden artisan").lean();
    if (!p || !p.artisan.equals(conversation.shop) || (p.isHidden && !isOwner)) return null;
    return { type: "product", id: p._id, title: p.title, titleEn: p.titleEn || "", image: p.images?.[0] || p.image || "", price: p.pricingTiers.basic.price };
  }
  if (conversation.order) {
    const o = await Order.findOne({ _id: conversation.order, user: conversation.buyer }).select("items status").lean();
    if (!o?.items?.length) return null;
    const first = o.items[0];
    const product = await Product.findById(first.product).select("titleEn images").lean();
    return { type: "order", id: o._id, title: first.title, titleEn: product?.titleEn || "", image: first.image || product?.images?.[0] || "", status: o.status, moreItems: o.items.length - 1 };
  }
  return null;
}

// Name and photo of the other side, for one or many conversations.
async function namesFor(conversations) {
  const [shops, buyers] = await Promise.all([
    Artisan.find({ _id: { $in: conversations.map((c) => c.shop) } }).select("shopName photoUrl status user").populate("user", "name avatarUrl").lean(),
    User.find({ _id: { $in: conversations.map((c) => c.buyer) } }).select("name").lean(),
  ]);
  return { shops: new Map(shops.map((s) => [String(s._id), s])), buyers: new Map(buyers.map((b) => [String(b._id), b])) };
}

function conversationView(c, viewerId, { shops, buyers }) {
  const isBuyer = String(c.buyer) === String(viewerId);
  const shop = shops.get(String(c.shop));
  const other = isBuyer
    ? { name: shop?.shopName || shop?.user?.name || "", photo: shop?.photoUrl || shop?.user?.avatarUrl || "" }
    : { name: buyers.get(String(c.buyer))?.name || "", photo: "" };
  return {
    id: c._id,
    role: isBuyer ? "buyer" : "artisan",
    other,
    lastMessageAt: c.lastMessageAt || null,
    preview: c.lastMessageText || "",
    previewMine: Boolean(c.lastMessageSender) && String(c.lastMessageSender) === String(viewerId),
    unread: (isBuyer ? c.buyerUnread : c.shopUnread) || 0,
    canSend: isShopLive(shop),
  };
}

// The conversation, if the caller is its buyer or owns its shop. Otherwise null (404).
async function loadForCaller(req) {
  if (req.user.role === "admin" || !mongoose.isValidObjectId(req.params.id)) return null;
  const conversation = await Conversation.findById(req.params.id);
  if (!conversation) return null;
  const isBuyer = conversation.buyer.equals(req.user.id);
  const isOwner = !isBuyer && Boolean(await Artisan.exists({ _id: conversation.shop, user: req.user.id }));
  return isBuyer || isOwner ? { conversation, isBuyer, isOwner } : null;
}

// ── start or get ──
// POST /api/conversations { shopId } | { productId } | { orderId }: the caller's conversation
// with that shop, created on first use. A product or order must exist and belong to the shop
// (and the order to the caller); it becomes the pinned card.
// Buyers start conversations. The one exception: the artisan of an order can open the chat
// with that order's buyer ("Message the buyer"); there is no way to name any other buyer.
async function startConversation(req, res) {
  if (req.user.role === "admin") return res.status(403).json({ error: "Admins can't use messages", code: "NOT_ALLOWED" });
  const { shopId, productId, orderId } = req.body || {};
  for (const id of [shopId, productId, orderId]) {
    if (id !== undefined && !validId(id)) return res.status(400).json({ error: "Invalid id", code: "BAD_ID" });
  }
  if (!shopId && !productId && !orderId) return res.status(400).json({ error: "shopId, productId or orderId is required", code: "BAD_ID" });

  let shopRef = shopId || null, buyerId = req.user.id, context = {};
  if (productId) {
    const product = await Product.findById(productId).select("artisan isHidden");
    if (!product || product.isHidden || (shopRef && String(product.artisan) !== shopRef)) return notFound(res, "Product");
    shopRef = String(product.artisan);
    context = { $set: { product: product._id }, $unset: { order: 1 } };
  }
  let artisanOfOrder = false;
  if (orderId) {
    const order = await Order.findById(orderId);
    if (!order) return notFound(res, "Order");
    const orderShop = await orderArtisanId(order);
    const myShop = await myShopOf(req.user.id);
    artisanOfOrder = Boolean(myShop && orderShop && myShop._id.equals(orderShop));
    if (!order.user.equals(req.user.id) && !artisanOfOrder) return notFound(res, "Order");
    if (!orderShop || (shopRef && orderShop !== shopRef)) return notFound(res, "Order");
    shopRef = orderShop;
    buyerId = String(order.user);
    context = { $set: { order: order._id }, $unset: { product: 1 } };
  }

  const shop = await Artisan.findById(shopRef).select("user status shopName +chatGreeting");
  if (!shop) return notFound(res, "Shop");
  if (shop.user.equals(buyerId)) return res.status(400).json({ error: "You can't message your own shop", code: "OWN_SHOP" });
  // A role other than buyer may only start from their own purchase, or as the order's artisan.
  if (req.user.role !== "buyer" && !orderId) return res.status(403).json({ error: "Only buyers can start a conversation", code: "BUYERS_ONLY" });
  if (!isShopLive(shop)) return shopNotOpen(res);

  const key = { buyer: buyerId, shop: shop._id };
  let conversation = await Conversation.findOne(key);
  let created = false;
  if (!conversation) {
    try {
      conversation = await Conversation.create(key);
      created = true;
    } catch (err) {
      if (err.code !== 11000) throw err;
      conversation = await Conversation.findOne(key); // two tabs at once: use the other one's
    }
  }
  if (context.$set) conversation = await Conversation.findByIdAndUpdate(conversation._id, context, { new: true });

  // Sent once, as the shop, to a buyer who just opened the chat (so already read, and no
  // notification). Not when the artisan opens the chat themselves.
  const greeting = shop.chatGreeting?.trim();
  if (created && greeting && !artisanOfOrder) {
    const claimed = await Conversation.updateOne({ _id: conversation._id, greetingSent: false }, { $set: { greetingSent: true } });
    if (claimed.modifiedCount === 1) await Message.create({ conversation: conversation._id, sender: shop.user, text: greeting, readAt: new Date() });
  }

  const names = await namesFor([conversation]);
  res.status(created ? 201 : 200).json({ conversation: conversationView(conversation, req.user.id, names), created });
}

// ── list ──
// GET /api/conversations: the caller's conversations (as a buyer and as a shop), latest first.
async function listConversations(req, res) {
  if (req.user.role === "admin") return res.json({ conversations: [] });
  const myShop = await myShopOf(req.user.id);
  const conversations = await Conversation.find({
    $or: [{ buyer: req.user.id }, ...(myShop ? [{ shop: myShop._id }] : [])],
    lastMessageAt: { $ne: null },
  }).sort({ lastMessageAt: -1 }).limit(LIST_MAX).lean();
  const names = await namesFor(conversations);
  res.json({ conversations: conversations.map((c) => conversationView(c, req.user.id, names)) });
}

// ── messages ──
// GET /api/conversations/:id/messages?before=<messageId>: newest page, or the page before
// that message; oldest first within the page. Includes the conversation and its card.
async function getMessages(req, res) {
  const access = await loadForCaller(req);
  if (!access) return notFound(res);
  const { conversation, isOwner } = access;
  const { before } = req.query;
  if (before !== undefined && !validId(before)) return res.status(400).json({ error: "Invalid id", code: "BAD_ID" });

  const page = await Message.find({ conversation: conversation._id, ...(before && { _id: { $lt: before } }) })
    .sort({ _id: -1 }).limit(PAGE + 1).lean();
  const hasMore = page.length > PAGE;
  const messages = page.slice(0, PAGE).reverse();
  const [names, card] = await Promise.all([namesFor([conversation]), contextCard(conversation, isOwner)]);
  res.json({
    conversation: conversationView(conversation, req.user.id, names),
    card,
    messages: messages.map((m) => messageView(m, req.user.id)),
    hasMore,
  });
}

// POST /api/conversations/:id/messages { text }
async function sendMessage(req, res) {
  const access = await loadForCaller(req);
  if (!access) return notFound(res);
  const { conversation, isBuyer } = access;
  const text = cleanText(req.body?.text);
  if (!text) return res.status(400).json({ error: "Write a message first", code: "EMPTY_MESSAGE" });
  if (text.length > MESSAGE_MAX) return res.status(400).json({ error: `Messages can be up to ${MESSAGE_MAX} characters`, code: "MESSAGE_TOO_LONG" });
  const shop = await Artisan.findById(conversation.shop).select("status");
  if (!isShopLive(shop)) return shopNotOpen(res);

  const message = await Message.create({ conversation: conversation._id, sender: req.user.id, text });
  await Conversation.updateOne({ _id: conversation._id }, {
    $set: { lastMessageAt: message.createdAt, lastMessageText: text.slice(0, PREVIEW), lastMessageSender: req.user.id },
    $inc: { [isBuyer ? "shopUnread" : "buyerUnread"]: 1 },
  });
  res.status(201).json({ message: messageView(message, req.user.id) });
}

// POST /api/conversations/:id/read: everything the other side sent is now read.
async function markRead(req, res) {
  const access = await loadForCaller(req);
  if (!access) return notFound(res);
  const { conversation, isBuyer } = access;
  const now = new Date();
  await Promise.all([
    Message.updateMany({ conversation: conversation._id, sender: { $ne: req.user.id }, readAt: null }, { $set: { readAt: now } }),
    Conversation.updateOne({ _id: conversation._id }, { $set: { [isBuyer ? "buyerUnread" : "shopUnread"]: 0 } }),
  ]);
  res.json({ unread: 0 });
}

// Sum of the caller's unread messages (the Messages badge).
async function unreadMessagesFor(userId) {
  const myShop = await myShopOf(userId);
  const [row] = await Conversation.aggregate([
    { $match: { $or: [{ buyer: new mongoose.Types.ObjectId(userId) }, ...(myShop ? [{ shop: myShop._id }] : [])] } },
    { $group: { _id: null, n: { $sum: { $cond: [{ $eq: ["$buyer", new mongoose.Types.ObjectId(userId)] }, "$buyerUnread", "$shopUnread"] } } } },
  ]);
  return row?.n || 0;
}

module.exports = { startConversation, listConversations, getMessages, sendMessage, markRead, unreadMessagesFor };

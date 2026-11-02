// API tests for buyer-to-shop chat. Starts its own throwaway database and API (setup.mjs):  npm run test:chat (also part of
// test:api). Accounts, shops, products and orders are created directly in the database, so no
// sign-ups are used, and everything is deleted at the end, also when a check fails.
import { API, connectDB, stopTestEnv } from "./setup.mjs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
import crypto from "crypto";
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("../src/models/User");
const Artisan = require("../src/models/Artisan");
const Product = require("../src/models/Product");
const Order = require("../src/models/Order");
const Conversation = require("../src/models/Conversation");
const Message = require("../src/models/Message");
const Notification = require("../src/models/Notification");

let pass = 0, fail = 0;
const check = (n, ok, x = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${x ? "  — " + x : ""}`); };
const call = async (path, { method = "GET", token, json } = {}) => {
  const h = {}; if (token) h.Authorization = `Bearer ${token}`; if (json !== undefined) h["Content-Type"] = "application/json";
  const r = await fetch(API + path, { method, headers: h, body: json !== undefined ? JSON.stringify(json) : undefined });
  const text = await r.text();
  let body = {}; try { body = JSON.parse(text); } catch {}
  return { status: r.status, body, text, type: r.headers.get("content-type") || "" };
};
const tag = crypto.randomBytes(4).toString("hex");
const pw = crypto.randomBytes(12).toString("hex");
const email = (k) => `chat-test-${k}-${tag}@test.invalid`;
const login = async (k) => (await call("/auth/login", { method: "POST", json: { email: email(k), password: pw } })).body.token;
const PHONE = "+97699887766", STREET = `Secret Street ${tag}`, PAYOUT = `payout-${tag}@test.invalid`;
// Everything a response must never contain, whoever asks.
const PRIVATE = [PHONE, STREET, PAYOUT, "test.invalid", "passwordHash", "shippingAddress", "payoutEmail", "chatGreeting", "savedReplies"];
const leaks = (text) => PRIVATE.filter((s) => text.includes(s));

await connectDB();
const made = { orders: [] };

try {
  const hash = await bcrypt.hash(pw, 10);
  const mk = (k, role, name = `Chat ${k}`) => User.create({ name, email: email(k), passwordHash: hash, role });
  const [admin, buyer, stranger, owner, otherOwner, pendingOwner, suspendedOwner, rejectedOwner, legacyOwner, limitBuyer, plainOwner, greetBuyer] = await Promise.all([
    mk("admin", "admin"), mk("buyer", "buyer", "Chat Buyer Name"), mk("stranger", "buyer"), mk("owner", "artisan", "Chat Owner Name"), mk("otherowner", "artisan"),
    mk("pendingowner", "artisan"), mk("suspendedowner", "artisan"), mk("rejectedowner", "artisan"), mk("legacyowner", "artisan"), mk("limitbuyer", "buyer"), mk("plainowner", "artisan"), mk("greetbuyer", "buyer"),
  ]);
  const mkShop = (user, k, status, more = {}) => Artisan.create({ user: user._id, shopName: `Chat ${k} ${tag}`, slug: `chat-${k}-${tag}`, ...(status && { status }), ...more });
  const GREETING = "Сайн байна уу! Welcome to our shop.";
  const shop = await mkShop(owner, "shop", "approved", { photoUrl: "/images/shop.png", payoutEmail: PAYOUT, chatGreeting: GREETING, contactInfo: "x" });
  const otherShop = await mkShop(otherOwner, "other", "approved");
  const pendingShop = await mkShop(pendingOwner, "pending", "pending");
  const suspendedShop = await mkShop(suspendedOwner, "suspended", "suspended");
  const rejectedShop = await mkShop(rejectedOwner, "rejected", "rejected");
  const legacyShop = await mkShop(legacyOwner, "legacy", null); // no status: counts as approved
  const plainShop = await mkShop(plainOwner, "plain", "approved");

  const productDoc = (artisan, over = {}) => ({
    title: "Эсгий гутал", titleEn: `Felt boots ${tag}`, category: "textile", artisan: artisan._id, images: ["/images/boots.png", "/images/2.png"],
    pricingTiers: { basic: { price: 25 }, story: { price: 30 }, patron: { price: 40 } }, ...over,
  });
  const product = await Product.create(productDoc(shop));
  const hiddenProduct = await Product.create(productDoc(shop, { isHidden: true }));
  const otherProduct = await Product.create(productDoc(otherShop));
  const suspendedProduct = await Product.create(productDoc(suspendedShop));
  const orderDoc = (user, artisan, prod) => ({
    user: user._id, status: "shipped", subtotal: 25, commissionFee: 3.75, shipping: 12, total: 40.75,
    items: [{ product: prod._id, artisan: artisan._id, title: "Эсгий гутал", image: "/images/boots.png", tier: "basic", unitPrice: 25, qty: 1 }],
    shippingAddress: { name: "Chat Buyer Name", address: STREET, city: "UB", country: "MN", phone: PHONE },
  });
  const order = await Order.create(orderDoc(buyer, shop, product));
  const strangerOrder = await Order.create(orderDoc(stranger, shop, product));
  const otherShopOrder = await Order.create(orderDoc(buyer, otherShop, otherProduct));
  made.orders.push(order._id, strangerOrder._id, otherShopOrder._id);

  const [adminT, buyerT, strangerT, ownerT, otherOwnerT, plainOwnerT, limitT, greetT] = await Promise.all(["admin", "buyer", "stranger", "owner", "otherowner", "plainowner", "limitbuyer", "greetbuyer"].map(login));
  const start = (token, json) => call("/conversations", { method: "POST", token, json });
  const send = (token, id, text) => call(`/conversations/${id}/messages`, { method: "POST", token, json: { text } });
  const read = (token, id) => call(`/conversations/${id}/messages`, { token });
  const markRead = (token, id) => call(`/conversations/${id}/read`, { method: "POST", token });
  const list = (token) => call("/conversations", { token });
  const bell = (token) => call("/notifications", { token });

  // ── login required ──
  check("no login → 401 (list)", (await call("/conversations")).status === 401);
  check("no login → 401 (start)", (await call("/conversations", { method: "POST", json: { shopId: String(shop._id) } })).status === 401);

  // ── who can start, and with which shop ──
  let r = await start(ownerT, { shopId: String(shop._id) });
  check("can't message your own shop → 400 OWN_SHOP", r.status === 400 && r.body.code === "OWN_SHOP", `${r.status} ${r.body.code}`);
  r = await start(ownerT, { productId: String(product._id) });
  check("…nor through your own product", r.status === 400 && r.body.code === "OWN_SHOP", `${r.status} ${r.body.code}`);
  r = await start(ownerT, { shopId: String(otherShop._id) });
  check("an artisan account can't start a chat from a shop page → 403 BUYERS_ONLY", r.status === 403 && r.body.code === "BUYERS_ONLY", `${r.status} ${r.body.code}`);
  r = await start(adminT, { shopId: String(shop._id) });
  check("an admin can't start one → 403", r.status === 403);
  for (const [name, s] of [["pending", pendingShop], ["suspended", suspendedShop], ["rejected", rejectedShop]]) {
    r = await start(buyerT, { shopId: String(s._id) });
    check(`${name} shop can't be messaged → 403 SHOP_NOT_APPROVED`, r.status === 403 && r.body.code === "SHOP_NOT_APPROVED", `${r.status} ${r.body.code}`);
  }
  r = await start(buyerT, { productId: String(suspendedProduct._id) });
  check("…nor through a suspended shop's product", r.status === 403 && r.body.code === "SHOP_NOT_APPROVED");
  check("nothing was created for those", (await Conversation.countDocuments({ shop: { $in: [pendingShop._id, suspendedShop._id, rejectedShop._id] } })) === 0);
  check("missing shop → 404", (await start(buyerT, { shopId: String(new mongoose.Types.ObjectId()) })).status === 404);
  check("nothing to start from → 400", (await start(buyerT, {})).status === 400);
  check("an object instead of an id → 400", (await start(buyerT, { shopId: { $ne: null } })).status === 400);
  r = await start(buyerT, { shopId: String(legacyShop._id) });
  check("an older shop without a status can be messaged", r.status === 201, `${r.status} ${r.body.error || ""}`);

  // ── start, reuse, greeting ──
  r = await start(buyerT, { shopId: String(shop._id) });
  check("buyer starts a conversation → 201", r.status === 201 && r.body.created === true, `${r.status} ${r.body.error || ""}`);
  const id = r.body.conversation?.id;
  check("the buyer sees only the shop's name and photo", r.body.conversation?.other?.name === shop.shopName && r.body.conversation?.other?.photo === "/images/shop.png" && Object.keys(r.body.conversation.other).length === 2);
  check("no private data when starting", leaks(r.text).length === 0 && !r.text.includes("Chat Owner Name"), leaks(r.text).join());
  r = await start(buyerT, { shopId: String(shop._id) });
  check("starting again reuses it → 200, same id", r.status === 200 && r.body.conversation.id === id && r.body.created === false);
  check("one conversation for the pair", (await Conversation.countDocuments({ buyer: buyer._id, shop: shop._id })) === 1);
  const greetings = () => Message.find({ text: GREETING }).lean();
  let g = await Message.find({ conversation: id, text: GREETING }).lean();
  check("greeting sent once, as the shop", g.length === 1 && String(g[0].sender) === String(owner._id));
  r = await read(buyerT, id);
  check("the buyer sees the greeting from the other side", r.status === 200 && r.body.messages.length === 1 && r.body.messages[0].text === GREETING && r.body.messages[0].mine === false);
  check("a greeting alone makes no notification or unread", (await bell(buyerT)).body.items.length === 0 && r.body.conversation.unread === 0);
  check("a greeting alone isn't listed yet for the shop", !(await list(ownerT)).body.conversations.some((c) => c.id === id));
  check("…nor does it count for the artisan", (await bell(ownerT)).body.unreadMessages === 0);

  r = await start(greetT, { shopId: String(shop._id) });
  check("another buyer's new conversation gets its own greeting", r.status === 201 && (await Message.countDocuments({ conversation: r.body.conversation.id, text: GREETING })) === 1);
  check("the shop's other conversation isn't given a second one", (await Message.countDocuments({ conversation: id, text: GREETING })) === 1);
  r = await start(buyerT, { shopId: String(plainShop._id) });
  check("a shop with no greeting sends nothing", r.status === 201 && (await Message.countDocuments({ conversation: r.body.conversation.id })) === 0 && !(await Conversation.findById(r.body.conversation.id)).greetingSent);

  // ── context cards ──
  r = await start(buyerT, { productId: String(product._id) });
  check("from a product page: same conversation", r.status === 200 && r.body.conversation.id === id);
  r = await read(buyerT, id);
  check("product card read from the database", r.body.card?.type === "product" && r.body.card.id === String(product._id) && r.body.card.title === "Эсгий гутал" && r.body.card.titleEn === `Felt boots ${tag}` && r.body.card.image === "/images/boots.png" && r.body.card.price === 25, JSON.stringify(r.body.card));
  r = await start(buyerT, { productId: String(product._id), title: "Fake title", price: 1, image: "http://evil.example/x.png", card: { title: "Fake" } });
  r = await read(buyerT, id);
  check("card data sent by the client is ignored", r.body.card.title === "Эсгий гутал" && r.body.card.price === 25 && !r.text.includes("Fake") && !r.text.includes("evil.example"));
  await Product.updateOne({ _id: product._id }, { $set: { "pricingTiers.basic.price": 27 } });
  check("the card follows the product's current price", (await read(buyerT, id)).body.card.price === 27);

  check("missing product → 404", (await start(buyerT, { productId: String(new mongoose.Types.ObjectId()) })).status === 404);
  check("hidden product → 404", (await start(buyerT, { productId: String(hiddenProduct._id) })).status === 404);
  check("product of another shop than the one named → 404", (await start(buyerT, { shopId: String(shop._id), productId: String(otherProduct._id) })).status === 404);
  check("the failed attempts left the card alone", (await read(buyerT, id)).body.card.id === String(product._id));

  r = await start(buyerT, { orderId: String(strangerOrder._id) });
  check("another user's order can't be attached → 404", r.status === 404, `${r.status}`);
  check("…and the card is unchanged", (await read(buyerT, id)).body.card.type === "product");
  check("a missing order → 404", (await start(buyerT, { orderId: String(new mongoose.Types.ObjectId()) })).status === 404);
  check("an order of another shop than the one named → 404", (await start(buyerT, { shopId: String(shop._id), orderId: String(otherShopOrder._id) })).status === 404);
  r = await start(buyerT, { orderId: String(order._id) });
  check("own order: attached to the same conversation", r.status === 200 && r.body.conversation.id === id);
  r = await read(buyerT, id);
  check("order card: item and status", r.body.card?.type === "order" && r.body.card.id === String(order._id) && r.body.card.title === "Эсгий гутал" && r.body.card.status === "shipped" && r.body.card.image === "/images/boots.png", JSON.stringify(r.body.card));
  check("no address or phone in the order card", leaks(r.text).length === 0, leaks(r.text).join());
  r = await read(ownerT, id);
  check("the artisan sees the same order card, no address", r.body.card?.type === "order" && leaks(r.text).length === 0, leaks(r.text).join());

  // ── a card whose target is gone ──
  const tempProduct = await Product.create(productDoc(plainShop));
  r = await start(buyerT, { productId: String(tempProduct._id) });
  const plainId = r.body.conversation.id;
  await Product.deleteOne({ _id: tempProduct._id });
  r = await read(buyerT, plainId);
  check("a deleted product just means no card", r.status === 200 && r.body.card === null);

  // ── artisans reply; the order page is the one way an artisan opens a chat ──
  r = await start(ownerT, { orderId: String(strangerOrder._id) });
  check("the order's artisan can open the chat with its buyer", r.status === 201 && r.body.conversation.role === "artisan" && r.body.conversation.other.name === "Chat stranger", `${r.status} ${JSON.stringify(r.body.conversation?.other)}`);
  const artisanOpened = r.body.conversation?.id;
  check("…no greeting then", (await Message.countDocuments({ conversation: artisanOpened })) === 0);
  check("…the buyer gets only a display name shown, with no photo", r.body.conversation?.other?.photo === "" && leaks(r.text).length === 0);
  r = await start(otherOwnerT, { orderId: String(strangerOrder._id) });
  check("another shop's artisan can't, for that order → 404", r.status === 404);
  r = await start(strangerT, { orderId: String(otherShopOrder._id) });
  check("another buyer can't attach this order → 404", r.status === 404);

  // ── sending, validation ──
  r = await send(buyerT, id, "  Is it available?  ");
  check("buyer sends: trimmed, 201", r.status === 201 && r.body.message.text === "Is it available?" && r.body.message.mine === true && r.body.message.readAt === null, `${r.status} ${r.text}`);
  const firstId = r.body.message.id;
  check("no sender id or private data in the message", !("sender" in r.body.message) && leaks(r.text).length === 0);
  for (const [name, bad] of [["empty", ""], ["only spaces", "   \n "], ["a number", 42], ["an object", { $gt: "" }], ["missing", undefined]]) {
    r = await call(`/conversations/${id}/messages`, { method: "POST", token: buyerT, json: { text: bad } });
    check(`${name} message → 400 EMPTY_MESSAGE`, r.status === 400 && r.body.code === "EMPTY_MESSAGE", `${r.status} ${r.body.code}`);
  }
  r = await send(buyerT, id, "x".repeat(1001));
  check("1001 characters → 400 MESSAGE_TOO_LONG", r.status === 400 && r.body.code === "MESSAGE_TOO_LONG", `${r.status} ${r.body.code}`);
  r = await send(buyerT, id, `  ${"y".repeat(1000)}  `);
  check("exactly 1000 (after trimming) is fine", r.status === 201 && r.body.message.text.length === 1000, `${r.status}`);
  const html = `<script>alert("x")</script><img src=x onerror=alert(1)> <b>bold</b> & "quotes"`;
  r = await send(buyerT, id, html);
  check("HTML is accepted as plain text, unchanged", r.status === 201 && r.body.message.text === html);
  check("…and answered as JSON, never HTML", r.type.startsWith("application/json"));
  r = await read(ownerT, id);
  check("…the artisan gets the same characters back", r.type.startsWith("application/json") && r.body.messages.at(-1).text === html);

  // ── counters and notifications ──
  r = await bell(ownerT);
  let note = r.body.items.filter((n) => n.type === "new_message" && n.params.conversationId === id);
  check("the artisan has one unread notification for the chat, however many messages", note.length === 1 && note[0].params.count === 3 && note[0].link === `/messages/${id}`, JSON.stringify(note));
  check("…naming the buyer by display name, no message text", note[0]?.params.name === "Chat Buyer Name" && !JSON.stringify(note).includes("available"));
  check("…counted in the bell", r.body.unreadCount === 1, `${r.body.unreadCount}`);
  check("…and the Messages badge counts the messages", r.body.unreadMessages === 3, `${r.body.unreadMessages}`);
  check("the sender isn't notified", !(await bell(buyerT)).body.items.some((n) => n.type === "new_message"));
  r = await list(ownerT);
  let row = r.body.conversations.find((c) => c.id === id);
  check("artisan's list: buyer's display name, preview, unread", row?.other?.name === "Chat Buyer Name" && row?.other?.photo === "" && row?.unread === 3 && row?.preview === html.slice(0, 120) && row?.role === "artisan", JSON.stringify(row));
  check("no email, phone or address in the artisan's list", leaks(r.text).length === 0, leaks(r.text).join());
  r = await list(buyerT);
  row = r.body.conversations.find((c) => c.id === id);
  check("buyer's list: shop name, own preview, nothing unread", row?.other?.name === shop.shopName && row?.previewMine === true && row?.unread === 0, JSON.stringify(row));
  check("no owner name or private data in the buyer's list", leaks(r.text).length === 0 && !r.text.includes("Chat Owner Name"), leaks(r.text).join());
  check("a conversation with no real message isn't listed", !r.body.conversations.some((c) => c.id === plainId));

  // ── read receipts ──
  r = await read(buyerT, id);
  check("nothing read yet", r.body.messages.filter((m) => m.mine).every((m) => m.readAt === null));
  check("reading the messages alone doesn't mark them", (await read(ownerT, id)).status === 200 && (await list(ownerT)).body.conversations.find((c) => c.id === id).unread === 3);
  r = await markRead(ownerT, id);
  check("artisan marks as read", r.status === 200 && r.body.unread === 0);
  r = await read(buyerT, id);
  check("the buyer now sees read receipts on every message", r.body.messages.filter((m) => m.mine).length === 3 && r.body.messages.filter((m) => m.mine).every((m) => Boolean(m.readAt)));
  r = await bell(ownerT);
  check("artisan's counters are back to 0", r.body.unreadCount === 0 && r.body.unreadMessages === 0, `${r.body.unreadCount} ${r.body.unreadMessages}`);

  // ── the artisan replies ──
  r = await send(ownerT, id, "Yes, it is!");
  check("artisan replies", r.status === 201 && r.body.message.mine === true);
  const replyId = r.body.message.id;
  r = await read(buyerT, id);
  check("the buyer sees the reply from the other side, unread", r.body.messages.at(-1).id === replyId && r.body.messages.at(-1).mine === false && r.body.conversation.unread === 1);
  r = await bell(buyerT);
  note = r.body.items.filter((n) => n.type === "new_message");
  check("the buyer is notified, by the shop's name only", note.length === 1 && note[0].params.name === shop.shopName && r.body.unreadMessages === 1 && !JSON.stringify(note).includes("Chat Owner Name"));
  r = await read(ownerT, id);
  check("the reply isn't read yet", r.body.messages.at(-1).readAt === null);
  await markRead(buyerT, id);
  check("after the buyer reads it, the artisan sees it read", Boolean((await read(ownerT, id)).body.messages.at(-1).readAt));
  check("marking as read only touched the other side's messages", (await Message.findById(firstId)).readAt !== null);
  await send(buyerT, id, "one more");
  r = await bell(ownerT);
  note = r.body.items.filter((n) => n.type === "new_message" && !n.readAt);
  check("a message after reading makes a fresh notification", note.length === 1 && note[0].params.count === 1);

  // ── only participants ──
  const others = [["another buyer", strangerT], ["another artisan", otherOwnerT], ["an admin", adminT]];
  for (const [name, token] of others) {
    check(`${name} can't read it → 404`, (await read(token, id)).status === 404);
    check(`${name} can't send → 404`, (await send(token, id, "hello")).status === 404);
    check(`${name} can't mark it read → 404`, (await markRead(token, id)).status === 404);
    check(`${name} doesn't have it in their list`, !(await list(token)).body.conversations.some((c) => c.id === id));
  }
  check("the admin's list is empty", (await list(adminT)).body.conversations?.length === 0);
  check("nothing was sent by them", (await Message.countDocuments({ conversation: id, text: "hello" })) === 0);
  check("a bad id → 404", (await read(buyerT, "not-an-id")).status === 404);
  check("a missing id → 404", (await read(buyerT, String(new mongoose.Types.ObjectId()))).status === 404);
  check("a bad page cursor → 400", (await call(`/conversations/${id}/messages?before=nope`, { token: buyerT })).status === 400);
  check("other users' bells stay empty of it", !(await bell(strangerT)).body.items.some((n) => n.params.conversationId === id));

  // ── suspended later: history stays, sending stops ──
  await Artisan.updateOne({ _id: shop._id }, { $set: { status: "suspended" } });
  r = await send(buyerT, id, "still there?");
  check("buyer can't send to a shop suspended meanwhile → 403", r.status === 403 && r.body.code === "SHOP_NOT_APPROVED");
  check("…nor can its artisan", (await send(ownerT, id, "yes")).status === 403);
  r = await read(buyerT, id);
  check("…the history can still be read, and says sending is off", r.status === 200 && r.body.conversation.canSend === false);
  await Artisan.updateOne({ _id: shop._id }, { $set: { status: "approved" } });

  // ── pagination ──
  const pageConv = await Conversation.findOne({ buyer: buyer._id, shop: legacyShop._id });
  await Message.insertMany(Array.from({ length: 65 }, (_, i) => ({ conversation: pageConv._id, sender: buyer._id, text: `page ${i}` })));
  r = await read(buyerT, pageConv._id);
  check("newest page first: 30 messages, oldest at the top, more available", r.body.messages.length === 30 && r.body.messages[0].text === "page 35" && r.body.messages[29].text === "page 64" && r.body.hasMore === true, `${r.body.messages?.[0]?.text}`);
  r = await call(`/conversations/${pageConv._id}/messages?before=${r.body.messages[0].id}`, { token: buyerT });
  check("the page before it", r.body.messages.length === 30 && r.body.messages[29].text === "page 34" && r.body.hasMore === true);
  r = await call(`/conversations/${pageConv._id}/messages?before=${r.body.messages[0].id}`, { token: buyerT });
  check("the last page", r.body.messages.length === 5 && r.body.hasMore === false);

  // ── saved replies and greeting ──
  const settings = (token, json) => call("/artisans/me/chat-settings", json ? { method: "PUT", token, json } : { token });
  check("settings need a login → 401", (await call("/artisans/me/chat-settings")).status === 401);
  check("a buyer has none → 403", (await settings(buyerT)).status === 403 && (await settings(buyerT, { greeting: "x" })).status === 403);
  check("an admin has none → 403", (await settings(adminT)).status === 403);
  r = await settings(ownerT);
  check("the owner reads their own settings", r.status === 200 && r.body.greeting === GREETING && Array.isArray(r.body.savedReplies));
  r = await settings(ownerT, { savedReplies: ["  Thank you!  ", "", "   ", "Ships in 3 days"] });
  check("saved: trimmed, blanks dropped", r.status === 200 && JSON.stringify(r.body.savedReplies) === JSON.stringify(["Thank you!", "Ships in 3 days"]) && r.body.greeting === GREETING, r.text);
  check("each owner has their own", (await settings(otherOwnerT)).body.savedReplies.length === 0 && (await settings(otherOwnerT)).body.greeting === "");
  const ten = Array.from({ length: 10 }, (_, i) => `Reply ${i}`);
  check("10 saved replies are allowed", (await settings(ownerT, { savedReplies: ten })).body.savedReplies?.length === 10);
  r = await settings(ownerT, { savedReplies: [...ten, "Eleven"] });
  check("11 → 400 TOO_MANY_REPLIES", r.status === 400 && r.body.code === "TOO_MANY_REPLIES");
  r = await settings(ownerT, { savedReplies: ["z".repeat(301)] });
  check("301 characters → 400 REPLY_TOO_LONG", r.status === 400 && r.body.code === "REPLY_TOO_LONG");
  check("300 characters is fine", (await settings(ownerT, { savedReplies: ["z".repeat(300)] })).status === 200);
  check("not a list → 400", (await settings(ownerT, { savedReplies: "hello" })).status === 400);
  check("a non-text entry → 400", (await settings(ownerT, { savedReplies: [{ a: 1 }] })).status === 400);
  r = await settings(ownerT, { greeting: "g".repeat(301) });
  check("a 301-character greeting → 400 GREETING_TOO_LONG", r.status === 400 && r.body.code === "GREETING_TOO_LONG");
  check("a refused save changes nothing", (await settings(ownerT)).body.greeting === GREETING);
  r = await settings(plainOwnerT, { greeting: "  Hi there  " });
  check("greeting saved, trimmed", r.status === 200 && r.body.greeting === "Hi there");
  r = await call(`/artisans/${shop._id}`);
  check("saved replies and greeting aren't on the public shop page", r.status === 200 && !/savedReplies|chatGreeting|Reply 0|Welcome to our/.test(r.text));
  r = await call("/artisans");
  check("…nor in the public shop list", !/savedReplies|chatGreeting/.test(r.text));
  r = await call(`/products/${product._id}`);
  check("…nor on the product page", !/savedReplies|chatGreeting/.test(r.text));

  // A greeting set later isn't sent into a conversation that already exists.
  r = await start(buyerT, { shopId: String(plainShop._id) });
  check("a greeting set later isn't sent to an existing conversation", r.status === 200 && (await Message.countDocuments({ conversation: plainId })) === 0);

  // ── rate limit: about 20 per minute per user ──
  const limitConv = (await start(limitT, { shopId: String(otherShop._id) })).body.conversation.id;
  let sent = 0, limited = null;
  for (let i = 0; i < 25 && !limited; i++) {
    const hit = await send(limitT, limitConv, `m${i}`);
    if (hit.status === 429) limited = hit; else if (hit.status === 201) sent++;
  }
  check("the 21st message in a minute → 429", sent === 20 && limited?.body.code === "RATE_LIMITED", `sent ${sent}`);
  check("…and it wasn't stored", (await Message.countDocuments({ conversation: limitConv })) === 20);
  check("…other users aren't affected", (await send(buyerT, id, "not limited")).status === 201);
  check("…reading still works", (await read(limitT, limitConv)).status === 200);
} finally {
  const users = (await User.find({ email: new RegExp(`^chat-test-.*-${tag}@test\\.invalid$`) }).select("_id")).map((u) => u._id);
  const shops = (await Artisan.find({ user: { $in: users } }).select("_id")).map((a) => a._id);
  const conversations = (await Conversation.find({ $or: [{ buyer: { $in: users } }, { shop: { $in: shops } }] }).select("_id")).map((c) => c._id);
  await Message.deleteMany({ conversation: { $in: conversations } });
  await Conversation.deleteMany({ _id: { $in: conversations } });
  await Notification.deleteMany({ user: { $in: users } });
  await Order.deleteMany({ _id: { $in: made.orders } });
  await Product.deleteMany({ artisan: { $in: shops } });
  await Artisan.deleteMany({ _id: { $in: shops } });
  const { deletedCount } = await User.deleteMany({ _id: { $in: users } });
  console.log(`cleanup: removed ${deletedCount} test accounts, ${shops.length} shops, ${conversations.length} conversations`);
  await mongoose.disconnect();
}
await stopTestEnv();
console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;

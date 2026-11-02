const mongoose = require("mongoose");
const Notification = require("../models/Notification");
const { unreadMessagesFor } = require("./conversationController");

const LATEST = 30;

const view = (n) => ({ id: n._id, type: n.type, params: n.params || {}, link: n.link || "", readAt: n.readAt || null, createdAt: n.createdAt });
const unreadCount = (user) => Notification.countDocuments({ user, readAt: null });

// Every query below is limited to the caller (req.user comes from the token).
// GET /api/notifications: the latest 30, and how many are unread in total.
async function listNotifications(req, res) {
  const [items, unread, unreadMessages] = await Promise.all([
    Notification.find({ user: req.user.id }).sort({ createdAt: -1, _id: -1 }).limit(LATEST).lean(),
    unreadCount(req.user.id),
    req.user.role === "admin" ? 0 : unreadMessagesFor(req.user.id), // the Messages badge, in the same poll
  ]);
  res.json({ items: items.map(view), unreadCount: unread, unreadMessages });
}

// POST /api/notifications/read-all
async function markAllRead(req, res) {
  await Notification.updateMany({ user: req.user.id, readAt: null }, { $set: { readAt: new Date() } });
  res.json({ unreadCount: 0 });
}

// POST /api/notifications/:id/read. Someone else's notification is a 404, like a missing one.
async function markRead(req, res) {
  const notFound = () => res.status(404).json({ error: "Notification not found" });
  if (!mongoose.isValidObjectId(req.params.id)) return notFound();
  const mine = { _id: req.params.id, user: req.user.id };
  await Notification.updateOne({ ...mine, readAt: null }, { $set: { readAt: new Date() } });
  const notification = await Notification.findOne(mine).lean();
  if (!notification) return notFound();
  res.json({ notification: view(notification), unreadCount: await unreadCount(req.user.id) });
}

module.exports = { listNotifications, markAllRead, markRead };

const mongoose = require("mongoose");

// One in-app notification for one user. Only the type and a few values are stored (see
// utils/notify.js for what each type may hold, never emails, phones or addresses); the
// frontend builds the MN/EN/KO text from them, so no translated text is in the database.
const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type: { type: String, required: true },
  params: { type: mongoose.Schema.Types.Mixed, default: {} },
  link: { type: String, default: "" }, // in-app path, e.g. /orders/<id> (see parseLink in the frontend)
  readAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
}, { minimize: false });

notificationSchema.index({ user: 1, createdAt: -1 }); // the latest 30
notificationSchema.index({ user: 1, readAt: 1, createdAt: -1 }); // the unread count

module.exports = mongoose.model("Notification", notificationSchema);

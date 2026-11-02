const mongoose = require("mongoose");

// Buyer-to-shop chat. One conversation per buyer + shop pair (unique index below).
const conversationSchema = new mongoose.Schema(
  {
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    shop: { type: mongoose.Schema.Types.ObjectId, ref: "Artisan", required: true },
    // What it's about: the pinned card. Set when started from a product or order page; the
    // latest one replaces the earlier one. Card data is always read from these documents.
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    // Set by the first real message: until then (only a greeting at most) the conversation
    // isn't listed for either side, so opening a chat and leaving doesn't bother the shop.
    lastMessageAt: { type: Date, default: null },
    lastMessageText: { type: String, default: "" }, // preview for the list
    lastMessageSender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    buyerUnread: { type: Number, default: 0, min: 0 },
    shopUnread: { type: Number, default: 0, min: 0 },
    greetingSent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

conversationSchema.index({ buyer: 1, shop: 1 }, { unique: true });
conversationSchema.index({ buyer: 1, lastMessageAt: -1 });
conversationSchema.index({ shop: 1, lastMessageAt: -1 });

module.exports = mongoose.model("Conversation", conversationSchema);

const mongoose = require("mongoose");

// One chat message. Stored and returned as plain text; the frontend never renders it as HTML.
const messageSchema = new mongoose.Schema({
  conversation: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  text: { type: String, required: true, maxlength: 1000 },
  readAt: { type: Date, default: null }, // when the other side read it
  createdAt: { type: Date, default: Date.now },
});

messageSchema.index({ conversation: 1, _id: -1 }); // newest first, paged by id
messageSchema.index({ conversation: 1, sender: 1, readAt: 1 }); // marking as read

module.exports = mongoose.model("Message", messageSchema);

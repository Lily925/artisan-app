const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const { requireAuth } = require("../middleware/auth");
const { chatReads, chatStarts, chatSends } = require("../middleware/rateLimit");
const { startConversation, listConversations, getMessages, sendMessage, markRead } = require("../controllers/conversationController");

const router = express.Router();

// Participants only: anyone else gets 404 (checked in the controller).
router.use(requireAuth);
router.post("/", chatStarts, asyncHandler(startConversation));
router.get("/", chatReads, asyncHandler(listConversations));
router.get("/:id/messages", chatReads, asyncHandler(getMessages));
router.post("/:id/messages", chatSends, asyncHandler(sendMessage));
router.post("/:id/read", chatReads, asyncHandler(markRead));

module.exports = router;

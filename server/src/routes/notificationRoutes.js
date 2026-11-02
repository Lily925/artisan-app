const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const { requireAuth } = require("../middleware/auth");
const { notificationReads, notificationWrites } = require("../middleware/rateLimit");
const { listNotifications, markAllRead, markRead } = require("../controllers/notificationController");

const router = express.Router();

router.use(requireAuth);
router.get("/", notificationReads, asyncHandler(listNotifications));
// must come before "/:id/read"
router.post("/read-all", notificationWrites, asyncHandler(markAllRead));
router.post("/:id/read", notificationWrites, asyncHandler(markRead));

module.exports = router;

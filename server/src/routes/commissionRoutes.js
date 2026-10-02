const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const { requireAuth, requireRole } = require("../middleware/auth");
const {
  createCommission, listCommissions, submitBid, acceptBid,
} = require("../controllers/commissionController");

const router = express.Router();

router.use(requireAuth);
router.post("/", asyncHandler(createCommission));
router.get("/", asyncHandler(listCommissions));
router.post("/:id/bids", requireRole("artisan", "admin"), asyncHandler(submitBid));
router.put("/:id/accept-bid", asyncHandler(acceptBid));

module.exports = router;

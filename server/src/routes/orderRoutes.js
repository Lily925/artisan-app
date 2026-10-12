const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const { requireAuth, requireRole } = require("../middleware/auth");
const {
  createOrder, listOrders, getOrder, listShopOrders, advanceOrder, setItemVideo,
} = require("../controllers/orderController");

const router = express.Router();

router.use(requireAuth);
router.post("/", asyncHandler(createOrder));
router.get("/", asyncHandler(listOrders));
// Artisan: orders placed with their own shop
router.get("/shop", requireRole("artisan"), asyncHandler(listShopOrders));
// Buyer or the order's artisan only (404 for anyone else)
router.get("/:id", asyncHandler(getOrder));
router.put("/:id/status", asyncHandler(advanceOrder));
router.put("/:id/items/:index/video", asyncHandler(setItemVideo));

module.exports = router;

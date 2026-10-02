const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const { requireAuth } = require("../middleware/auth");
const { createOrder, listOrders } = require("../controllers/orderController");

const router = express.Router();

router.use(requireAuth);
router.post("/", asyncHandler(createOrder));
router.get("/", asyncHandler(listOrders));

module.exports = router;

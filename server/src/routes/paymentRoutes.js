const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const { requireAuth } = require("../middleware/auth");
const { createPaypalOrder, capturePaypalOrder, paypalConfig } = require("../controllers/paymentController");
const { checkoutCreate, checkoutCapture } = require("../middleware/rateLimit");

const router = express.Router();

router.get("/paypal/config", paypalConfig);
router.post("/paypal/orders", requireAuth, checkoutCreate, asyncHandler(createPaypalOrder));
router.post("/paypal/orders/:id/capture", requireAuth, checkoutCapture, asyncHandler(capturePaypalOrder));

module.exports = router;

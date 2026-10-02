const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const { requireAuth } = require("../middleware/auth");
const { getCart, addItem, updateItem, removeItem } = require("../controllers/cartController");

const router = express.Router();

router.use(requireAuth);
router.get("/", asyncHandler(getCart));
router.post("/", asyncHandler(addItem));
router.put("/", asyncHandler(updateItem));
router.delete("/", asyncHandler(removeItem));

module.exports = router;

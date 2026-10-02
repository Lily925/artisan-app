const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const { requireAuth, requireRole } = require("../middleware/auth");
const { productPhotoUpload } = require("../utils/imageStorage");
const {
  listProducts, getProduct, createProduct, updateProduct, deleteProduct,
  likeProduct, unlikeProduct, listMyLikes,
} = require("../controllers/productController");

const router = express.Router();

router.get("/", asyncHandler(listProducts));
// must come before "/:id" so "liked" isn't treated as a product id
router.get("/liked", requireAuth, asyncHandler(listMyLikes));
router.get("/:id", asyncHandler(getProduct));
router.post("/", requireAuth, requireRole("artisan"), productPhotoUpload, asyncHandler(createProduct));
// Owner-only (checked in the controller): edit fields / replace photo, or delete.
router.put("/:id", requireAuth, requireRole("artisan"), productPhotoUpload, asyncHandler(updateProduct));
router.delete("/:id", requireAuth, requireRole("artisan"), asyncHandler(deleteProduct));
router.put("/:id/like", requireAuth, asyncHandler(likeProduct));
router.delete("/:id/like", requireAuth, asyncHandler(unlikeProduct));

module.exports = router;

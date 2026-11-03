const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const { requireAuth, optionalAuth, requireRole } = require("../middleware/auth");
const { productPhotoUpload } = require("../utils/imageStorage");
const {
  listProducts, getProduct, createProduct, updateProduct, deleteProduct,
  likeProduct, unlikeProduct, listMyLikes, recordView,
} = require("../controllers/productController");
const { listProductReviews } = require("../controllers/reviewController");

const router = express.Router();

// Login optional: an artisan also gets their own hidden products (isHidden: true).
router.get("/", optionalAuth, asyncHandler(listProducts));
// must come before "/:id" so "liked" isn't treated as a product id
router.get("/liked", requireAuth, asyncHandler(listMyLikes));
router.get("/:id", optionalAuth, asyncHandler(getProduct));
router.get("/:id/reviews", optionalAuth, asyncHandler(listProductReviews));
router.post("/", requireAuth, requireRole("artisan"), productPhotoUpload, asyncHandler(createProduct));
// Owner or admin only (checked in the controller, 403 otherwise): edit fields / photos, or delete.
router.put("/:id", requireAuth, requireRole("artisan", "admin"), productPhotoUpload, asyncHandler(updateProduct));
router.delete("/:id", requireAuth, requireRole("artisan", "admin"), asyncHandler(deleteProduct));
router.put("/:id/like", requireAuth, asyncHandler(likeProduct));
router.delete("/:id/like", requireAuth, asyncHandler(unlikeProduct));
// Product page opened; login optional (logged-out visitors send X-Viewer-Session).
router.post("/:id/view", optionalAuth, asyncHandler(recordView));

module.exports = router;

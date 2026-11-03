const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const { requireAuth } = require("../middleware/auth");
const { reviewCreate, reviewWrites } = require("../middleware/rateLimit");
const { reviewPhotoUpload } = require("../utils/imageStorage");
const { createReview, updateReview, deleteReview, replyToReview, updateReply, deleteReply } = require("../controllers/reviewController");

const router = express.Router();

// Reading is public: GET /api/products/:id/reviews (productRoutes). Who may do what is checked
// in the controller. The limits come before the upload, so a refused request costs no memory.
router.post("/", requireAuth, reviewCreate, reviewPhotoUpload, asyncHandler(createReview));
router.put("/:id", requireAuth, reviewWrites, reviewPhotoUpload, asyncHandler(updateReview));
router.delete("/:id", requireAuth, reviewWrites, asyncHandler(deleteReview));
router.post("/:id/reply", requireAuth, reviewWrites, asyncHandler(replyToReview));
router.put("/:id/reply", requireAuth, reviewWrites, asyncHandler(updateReply));
router.delete("/:id/reply", requireAuth, reviewWrites, asyncHandler(deleteReply));

module.exports = router;

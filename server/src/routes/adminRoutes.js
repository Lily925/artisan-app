const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const { requireAuth, requireRole } = require("../middleware/auth");
const { listShops, changeShopStatus } = require("../controllers/adminController");
const { adminListReviews, hideReview, unhideReview } = require("../controllers/reviewController");

const router = express.Router();

// Every admin route: logged in as an admin (the role is re-read from the database), else 401/403.
router.use(requireAuth, requireRole("admin"));

router.get("/shops", asyncHandler(listShops));
// :action = approve | reject | suspend | unsuspend
router.put("/shops/:id/:action", asyncHandler(changeShopStatus));
router.get("/reviews", asyncHandler(adminListReviews));
router.put("/reviews/:id/hide", asyncHandler(hideReview));
router.put("/reviews/:id/unhide", asyncHandler(unhideReview));

module.exports = router;

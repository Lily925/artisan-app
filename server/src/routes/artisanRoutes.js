const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const { requireAuth, requireRole } = require("../middleware/auth");
const { listArtisans, getArtisan, getMyArtisan, updateMyArtisan } = require("../controllers/artisanController");
const { getMyDashboard } = require("../controllers/dashboardController");

const router = express.Router();

router.get("/", asyncHandler(listArtisans));
// "/me" routes must come before "/:id"; they always act on the logged-in artisan's own record
router.get("/me", requireAuth, requireRole("artisan"), asyncHandler(getMyArtisan));
router.put("/me", requireAuth, requireRole("artisan"), asyncHandler(updateMyArtisan));
// Own shop only: the artisan is looked up from the token, never from the URL.
router.get("/me/dashboard", requireAuth, requireRole("artisan"), asyncHandler(getMyDashboard));
router.get("/:id", asyncHandler(getArtisan));

module.exports = router;

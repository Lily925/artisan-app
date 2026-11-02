const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const { requireAuth, requireRole } = require("../middleware/auth");
const { listArtisans, getArtisan, getMyArtisan, setupMyShop, updateMyArtisan, getChatSettings, updateChatSettings } = require("../controllers/artisanController");
const { getMyDashboard } = require("../controllers/dashboardController");

const router = express.Router();

router.get("/", asyncHandler(listArtisans));
// "/me" routes must come before "/:id"; they always act on the logged-in artisan's own record
router.get("/me", requireAuth, requireRole("artisan"), asyncHandler(getMyArtisan));
router.put("/me", requireAuth, requireRole("artisan"), asyncHandler(updateMyArtisan));
// "Set up your shop": creates the logged-in artisan's own shop profile (once).
router.post("/me", requireAuth, requireRole("artisan"), asyncHandler(setupMyShop));
// Own shop only: the artisan is looked up from the token, never from the URL.
router.get("/me/dashboard", requireAuth, requireRole("artisan"), asyncHandler(getMyDashboard));
router.get("/me/chat-settings", requireAuth, requireRole("artisan"), asyncHandler(getChatSettings));
router.put("/me/chat-settings", requireAuth, requireRole("artisan"), asyncHandler(updateChatSettings));
router.get("/:id", asyncHandler(getArtisan));

module.exports = router;

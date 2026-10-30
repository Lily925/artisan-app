const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const { requireAuth } = require("../middleware/auth");
const { avatarUpload } = require("../utils/imageStorage");
const { getMe, updateProfile } = require("../controllers/userController");

const router = express.Router();

router.get("/me", requireAuth, asyncHandler(getMe));
// Own profile only (checked in the controller: :id must be the caller's id).
// requireAuth runs before the upload is parsed, so strangers can't push files.
router.patch("/:id", requireAuth, avatarUpload, asyncHandler(updateProfile));

module.exports = router;

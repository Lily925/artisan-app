const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const { signup, login, changePassword } = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");
const { loginByIp, loginByAccount, signupByIp, passwordChange } = require("../middleware/rateLimit");

const router = express.Router();

router.post("/signup", signupByIp, asyncHandler(signup));
router.post("/login", loginByIp, loginByAccount, asyncHandler(login));
// Own account only (the user comes from the token); every role.
router.put("/password", requireAuth, passwordChange, asyncHandler(changePassword));

module.exports = router;

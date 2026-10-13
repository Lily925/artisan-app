const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const { signup, login } = require("../controllers/authController");
const { loginByIp, loginByAccount, signupByIp } = require("../middleware/rateLimit");

const router = express.Router();

router.post("/signup", signupByIp, asyncHandler(signup));
router.post("/login", loginByIp, loginByAccount, asyncHandler(login));

module.exports = router;

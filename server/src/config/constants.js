// Buyer totals are computed from these in utils/orderTotals.js (cart preview and checkout).
const COMMISSION_RATE = 0.15;
const FLAT_SHIPPING_USD = 12;
const TIERS = ["basic", "story", "patron"];
// Tiers that include a video from the artisan.
const VIDEO_TIERS = ["story", "patron"];

// User fields shown publicly for an ARTISAN's account (shop page, personal profile, product
// pages, bids). Only ever used when populating an Artisan's user, never a buyer: a buyer's
// photo and bio are returned to the buyer alone. No email or phone, ever.
const ARTISAN_USER_PUBLIC = "name avatarUrl bio";

module.exports = { COMMISSION_RATE, FLAT_SHIPPING_USD, TIERS, VIDEO_TIERS, ARTISAN_USER_PUBLIC };

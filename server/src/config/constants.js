// Buyer totals are computed from these in utils/orderTotals.js (cart preview and checkout).
const COMMISSION_RATE = 0.15;
const FLAT_SHIPPING_USD = 12;
const TIERS = ["basic", "story", "patron"];
// Tiers that include a video from the artisan.
const VIDEO_TIERS = ["story", "patron"];

module.exports = { COMMISSION_RATE, FLAT_SHIPPING_USD, TIERS, VIDEO_TIERS };

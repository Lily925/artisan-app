const { COMMISSION_RATE, FLAT_SHIPPING_USD } = require("../config/constants");

// Single source of truth for what a buyer pays: used for the cart preview, checkout and
// the demo seed. Everything is computed in integer cents and rounded once, so the
// preview and the charged total can't differ by a cent.
// lines: [{ unitPrice (USD), qty }]
const RATE_BASIS_POINTS = Math.round(COMMISSION_RATE * 10000); // 0.15 -> 1500
const SHIPPING_CENTS = Math.round(FLAT_SHIPPING_USD * 100);

function orderTotals(lines) {
  const subtotalCents = lines.reduce((sum, l) => sum + Math.round(l.unitPrice * 100) * l.qty, 0);
  // subtotalCents * 1500 is an exact integer, so the only rounding is this one (half up).
  const feeCents = Math.round((subtotalCents * RATE_BASIS_POINTS) / 10000);
  const shippingCents = lines.length > 0 ? SHIPPING_CENTS : 0;
  const totalCents = subtotalCents + feeCents + shippingCents;
  return {
    subtotal: subtotalCents / 100,
    commissionFee: feeCents / 100,
    shipping: shippingCents / 100,
    total: totalCents / 100,
  };
}

module.exports = { orderTotals };

// Single source of truth for tier pricing: Story and Patron are percentage
// markups on the Basic price (USD), rounded to cents.
const STORY_MARKUP = 0.3;
const PATRON_MARKUP = 0.65;

const roundCents = (n) => Math.round(n * 100) / 100;

function pricingTiersFor(basicPrice) {
  const basic = roundCents(basicPrice);
  return {
    basic: { price: basic, label: "Product only" },
    story: { price: roundCents(basic * (1 + STORY_MARKUP)), label: "+Story video" },
    patron: { price: roundCents(basic * (1 + PATRON_MARKUP)), label: "+Patron bonus" },
  };
}

// The Patron tier is only offered when the artisan has written what the bonus is.
const offersPatron = (product) => Boolean(product.patronBonus?.mn || product.patronBonus?.en);

module.exports = { pricingTiersFor, offersPatron, STORY_MARKUP, PATRON_MARKUP };

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

module.exports = { pricingTiersFor, STORY_MARKUP, PATRON_MARKUP };

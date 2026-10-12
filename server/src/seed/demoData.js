// ════════════════════════════════════════════════════════════════════════════
//  DEMO DATA, NOT REAL. Fake buyers, orders and product views for noon_handmade_
//  so the Artisan Dashboard has something to show in a demo.
//
//  Add:     npm run seed:demo            (adds only demo data; wipes nothing else)
//  Remove:  npm run seed:demo -- --remove
//  The full `npm run seed` also adds it.
//
//  How demo records are recognised (and removed):
//   - buyers: email ends with DEMO_EMAIL_DOMAIN (".invalid" is a reserved domain,
//     so these can never be real addresses), and their passwords are random, so
//     nobody can log in as them;
//   - orders: placed by one of those buyers;
//   - views: ProductViewDaily rows with demo: true (their total is also added to,
//     and on removal subtracted from, each product's viewCount).
//
//  Orders and views are generated for the last DAYS days before the moment the
//  script runs, so re-run it shortly before a demo to keep the 30-day chart full.
// ════════════════════════════════════════════════════════════════════════════

const DEMO_EMAIL_DOMAIN = "@demo.artisan.invalid";

const DEMO_SHOP_EMAIL = "noon.handmade@example.com";

// Video link for shipped/completed demo Story/Patron items (example.com is reserved for examples).
const DEMO_VIDEO_URL = "https://example.com/demo-video/order-";

const DAYS = 30;
const RANDOM_SEED = 20261006; // same seed -> same numbers on every run

// How many orders each demo buyer places: four regulars (repeat buyers), then 17 people
// who bought once. 26 orders in total. Orders are assigned to buyers in shuffled order.
const ORDERS_PER_BUYER = [3, 2, 2, 2, ...Array(17).fill(1)];
const buyers = ORDERS_PER_BUYER.map((orders, i) => ({
  name: `Demo Buyer ${i + 1}`,
  email: `demo.buyer${i + 1}${DEMO_EMAIL_DOMAIN}`,
  orders,
}));

// noon_handmade_'s three real products, matched by English title.
// orderWeight: share of orders; viewsPerDay: typical daily product-page views.
const products = [
  { titleEn: "Silver Necklace", orderWeight: 0.45, viewsPerDay: 9 },
  { titleEn: "Crystal & Pearl Necklace", orderWeight: 0.3, viewsPerDay: 6 },
  { titleEn: "Purple Cluster Necklace", orderWeight: 0.25, viewsPerDay: 5 },
];

// Probability of each pricing tier, and of an item having qty 2 / an order having 2 products.
const TIER_WEIGHTS = { basic: 0.7, story: 0.22, patron: 0.08 };
const QTY_TWO_CHANCE = 0.1;
const SECOND_PRODUCT_CHANCE = 0.15;
// One order this many days ago is cancelled (shows that cancelled orders are left out of totals).
const CANCELLED_DAYS_AGO = 20;

// Status by order age, like real orders moving through fulfilment.
function statusForAge(daysAgo) {
  if (daysAgo >= 14) return "completed";
  if (daysAgo >= 7) return "shipped";
  if (daysAgo >= 3) return "in_production";
  return "pending";
}

module.exports = {
  DEMO_EMAIL_DOMAIN, DEMO_SHOP_EMAIL, DEMO_VIDEO_URL, DAYS, RANDOM_SEED, buyers, products,
  TIER_WEIGHTS, QTY_TWO_CHANCE, SECOND_PRODUCT_CHANCE, CANCELLED_DAYS_AGO, statusForAge,
};

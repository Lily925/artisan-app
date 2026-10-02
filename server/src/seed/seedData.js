// Mirrors the frontend's mock data (src/data.js in the React app) so the API
// has something real to test against. Password for every seeded account is "artisan123".

const users = [
  { name: "Admin", email: "admin@artisan.mn", password: "artisan123", role: "admin" },
  { name: "Buyer Demo", email: "buyer@artisan.mn", password: "artisan123", role: "buyer" },
  { name: "Narantsetseg", email: "narantsetseg@artisan.mn", password: "artisan123", role: "artisan" },
  { name: "Enkhjargal", email: "enkhjargal@artisan.mn", password: "artisan123", role: "artisan" },
  { name: "Boldbaatar", email: "boldbaatar@artisan.mn", password: "artisan123", role: "artisan" },
  { name: "Oyuntsetseg", email: "oyuntsetseg@artisan.mn", password: "artisan123", role: "artisan" },
  { name: "Gantulga", email: "gantulga@artisan.mn", password: "artisan123", role: "artisan" },
  { name: "Tserenpuntsag", email: "tserenpuntsag@artisan.mn", password: "artisan123", role: "artisan" },
  // real shop: noon_handmade_ (owner: Bolorsaran)
  { name: "Bolorsaran", email: "noon.handmade@example.com", password: "artisan123", role: "artisan" },
];

// specialty/bio keyed by the artisan's user email, filled in after users are created
const artisanProfiles = {
  "narantsetseg@artisan.mn": { specialty: "Jewelry & Leather", bio: "Hand-forged jewelry and leather goods from Ulaanbaatar." },
  "enkhjargal@artisan.mn": { specialty: "Ceramics", bio: "Hand-painted ceramic homeware." },
  "boldbaatar@artisan.mn": { specialty: "Art & Wood Carving", bio: "Traditional Mongolian painting and wood carving." },
  "oyuntsetseg@artisan.mn": { specialty: "Textile", bio: "Hand-woven wool textiles." },
  "gantulga@artisan.mn": { specialty: "Felt Crafts", bio: "Traditional felt dolls and crafts." },
  "tserenpuntsag@artisan.mn": { specialty: "Textile", bio: "Hand-sewn wool accessories." },
  "noon.handmade@example.com": {
    specialty: "Necklace · Jewelry · Crochet",
    bio: "Handmade necklaces, jewelry, and crochet pieces from Ulaanbaatar, noon_handmade_ shop.",
    shopName: "noon_handmade_",
    instagramHandle: "noon_handmade_",
    contactInfo: "DM @noon_handmade_ on Instagram to order. Custom orders take 10-14 days.",
    // NOON logo cropped from the shop's Instagram header (public/nood_logo.png)
    photoUrl: "/images/artisans/noon-logo.png",
  },
};

// price is the "basic" tier price in USD; story/patron are derived from it
// by pricingTiersFor (src/utils/pricing.js: +30% / +65%).
const products = [
  { title:"Гар хийцийн зүүлт", titleEn:"Handmade Jewelry Set", artisanEmail:"narantsetseg@artisan.mn", category:"jewelry", price:42 },
  { title:"Цэцэгт аяга", titleEn:"Handmade Floral Mug", artisanEmail:"enkhjargal@artisan.mn", category:"ceramics", price:28 },
  { title:"Өнгийн зурвас", titleEn:"Rainbow Dotholidy", artisanEmail:"boldbaatar@artisan.mn", category:"art", price:32.5 },
  { title:"Гар хийцийн хивс", titleEn:"Handmades Terlocks Set", artisanEmail:"oyuntsetseg@artisan.mn", category:"textile", price:18 },
  // frontend mock priced this one in KRW (₩89,000); seeded here as a plain USD price instead.
  { title:"Уламжлалт эсгий хүүхэлдэй", titleEn:"Traditional Felt Doll", artisanEmail:"gantulga@artisan.mn", category:"crafts", price:65 },
  { title:"Гар хийцийн зүү", titleEn:"Reaction Brooch", artisanEmail:"tserenpuntsag@artisan.mn", category:"textile", price:22 },
  { title:"Уламжлалт эсгий цүнх", titleEn:"Traditional Felt Wallet", artisanEmail:"narantsetseg@artisan.mn", category:"leather", price:55 },
  { title:"Монгол модон баримал", titleEn:"Mongolian Wood Carving", artisanEmail:"boldbaatar@artisan.mn", category:"wood", price:64 },

  // ── Real noon_handmade_ products ──
  // Shop prices are in ₮; converted to USD at the live rate when added, rounded to cents.
  // 79,000₮ / 3,578.01 (open.er-api.com, 2026-09-29) = $22.08
  { title:"Мөнгөн зүүлт", titleEn:"Silver Necklace", artisanEmail:"noon.handmade@example.com", category:"jewelry", price:22.08,
    description:"Sterling silver, hand-cast by the artisan. Length: 39+5 cm.",
    images:["/images/products/silver-necklace.png"] },
  // 56,000₮ / 3,578.01 (open.er-api.com, 2026-09-29) = $15.65 — one layered necklace, sold as a single piece
  { title:"Кристал Сувд зүүлт", titleEn:"Crystal & Pearl Necklace", artisanEmail:"noon.handmade@example.com", category:"jewelry", price:15.65,
    description:"Layered necklace with blue beads, pearls and gold charms. Length: 40+5 cm.",
    images:["/images/products/crystal-pearl-necklace.jpeg"] },
  // 51,000₮ / 3,578.01 (open.er-api.com, 2026-09-29) = $14.25
  { title:"Нил ягаан бөөгнөрсөн зүүлт", titleEn:"Purple Cluster Necklace", artisanEmail:"noon.handmade@example.com", category:"jewelry", price:14.25,
    description:"Purple crystal cluster necklace. Length: 36+5 cm.",
    images:["/images/products/purple-cluster-necklace.png"] },
];

module.exports = { users, artisanProfiles, products };

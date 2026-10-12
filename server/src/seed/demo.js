// Adds or removes the DEMO dashboard data described in demoData.js.
//   node src/seed/demo.js            add (replaces any earlier demo data)
//   node src/seed/demo.js --remove   remove
// Touches only demo records; real users, products and orders are left alone.
require("dotenv").config();
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../models/User");
const Artisan = require("../models/Artisan");
const Product = require("../models/Product");
const Order = require("../models/Order");
const Cart = require("../models/Cart");
const { ProductViewDaily } = require("../models/ProductView");
const { VIDEO_TIERS } = require("../config/constants");
const { orderTotals } = require("../utils/orderTotals");
const { shopDay } = require("../utils/dates");
const { offersPatron } = require("../utils/pricing");
const demo = require("./demoData");

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const DEMO_EMAIL = new RegExp(`${escapeRegex(demo.DEMO_EMAIL_DOMAIN)}$`);

// Small deterministic PRNG (mulberry32) so every run produces the same demo numbers.
function makeRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pickWeighted(random, entries) {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = random() * total;
  for (const [value, w] of entries) {
    if ((r -= w) < 0) return value;
  }
  return entries[entries.length - 1][0];
}

async function removeDemoData() {
  const demoUsers = await User.find({ email: DEMO_EMAIL }).select("_id");
  const userIds = demoUsers.map((u) => u._id);

  const viewRows = await ProductViewDaily.aggregate([
    { $match: { demo: true } },
    { $group: { _id: "$product", views: { $sum: "$count" } } },
  ]);
  for (const row of viewRows) {
    // Subtract, but never below zero (real views may have been recounted meanwhile).
    await Product.updateOne({ _id: row._id }, [
      { $set: { viewCount: { $max: [0, { $subtract: [{ $ifNull: ["$viewCount", 0] }, row.views] }] } } },
    ]);
  }

  const [orders, views, carts, users] = await Promise.all([
    Order.deleteMany({ user: { $in: userIds } }),
    ProductViewDaily.deleteMany({ demo: true }),
    Cart.deleteMany({ user: { $in: userIds } }),
    User.deleteMany({ _id: { $in: userIds } }),
  ]);
  console.log(`Removed demo data: ${users.deletedCount} buyers, ${orders.deletedCount} orders, ${views.deletedCount} daily view rows (${carts.deletedCount} carts).`);
}

async function addDemoData() {
  await removeDemoData();
  const random = makeRandom(demo.RANDOM_SEED);
  const now = new Date();

  const shopUser = await User.findOne({ email: demo.DEMO_SHOP_EMAIL }).select("_id");
  const artisan = shopUser && (await Artisan.findOne({ user: shopUser._id }).select("_id"));
  if (!artisan) throw new Error(`No artisan found for ${demo.DEMO_SHOP_EMAIL}; run the main seed first`);

  const products = [];
  for (const spec of demo.products) {
    const product = await Product.findOne({ artisan: artisan._id, titleEn: spec.titleEn }).select("title pricingTiers patronBonus");
    if (!product) throw new Error(`Demo product "${spec.titleEn}" not found for ${demo.DEMO_SHOP_EMAIL}`);
    products.push({ ...spec, product });
  }

  // Demo buyers: random throwaway passwords, so nobody can log in as them.
  const buyers = [];
  for (const b of demo.buyers) {
    const passwordHash = await bcrypt.hash(crypto.randomBytes(24).toString("hex"), 10);
    const user = await User.create({ name: b.name, email: b.email, passwordHash, role: "buyer" });
    buyers.push(user);
  }
  // One entry per order, shuffled (Fisher-Yates) so regulars' orders are spread out.
  const orderBuyers = demo.buyers.flatMap((b, i) => Array(b.orders).fill(buyers[i]));
  for (let i = orderBuyers.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [orderBuyers[i], orderBuyers[j]] = [orderBuyers[j], orderBuyers[i]];
  }

  // Orders: more of them in recent days (sales picking up). The first one is the cancelled one.
  const orderDocs = [];
  for (let n = 0; n < orderBuyers.length; n++) {
    const cancelled = n === 0;
    const daysAgo = cancelled ? demo.CANCELLED_DAYS_AGO : Math.floor(Math.pow(random(), 1.4) * demo.DAYS); // skews toward 0 = today
    // Ulaanbaatar daytime (10:00-22:00, UTC+8) on that day.
    const createdAt = new Date(now.getTime() - daysAgo * 86400000);
    createdAt.setUTCHours(2 + Math.floor(random() * 12), Math.floor(random() * 60), 0, 0);
    if (createdAt > now) createdAt.setTime(now.getTime() - 60000);

    const first = pickWeighted(random, products.map((p) => [p, p.orderWeight]));
    const chosen = [first];
    if (random() < demo.SECOND_PRODUCT_CHANCE) {
      const second = pickWeighted(random, products.filter((p) => p !== first).map((p) => [p, p.orderWeight]));
      chosen.push(second);
    }
    const items = chosen.map(({ product }) => {
      // Patron only where the artisan has defined the bonus (same rule as the real cart).
      const tiers = Object.entries(demo.TIER_WEIGHTS).filter(([t]) => t !== "patron" || offersPatron(product));
      const tier = pickWeighted(random, tiers);
      return {
        product: product._id,
        artisan: artisan._id,
        title: product.title,
        tier,
        unitPrice: product.pricingTiers[tier].price,
        qty: random() < demo.QTY_TWO_CHANCE ? 2 : 1,
        ...(tier === "patron" && { patronBonus: { mn: product.patronBonus.mn, en: product.patronBonus.en } }),
      };
    });
    const status = cancelled ? "cancelled" : demo.statusForAge(daysAgo);
    // A real Story/Patron order can't be shipped without a video link, so demo ones have one too.
    if (["shipped", "completed"].includes(status)) {
      items.forEach((item, i) => {
        if (VIDEO_TIERS.includes(item.tier)) item.deliveryVideoUrl = `${demo.DEMO_VIDEO_URL}${n + 1}-${i + 1}`;
      });
    }
    const doc = new Order({
      user: orderBuyers[n]._id,
      items,
      ...orderTotals(items),
      status,
    });
    const err = doc.validateSync();
    if (err) throw err;
    // Inserted directly so createdAt can be in the past (Mongoose would stamp "now").
    orderDocs.push({ ...doc.toObject(), createdAt, updatedAt: createdAt });
  }
  await Order.collection.insertMany(orderDocs);

  // Views: each product's typical daily views, trending up ~50% over the period,
  // with day-to-day noise and a weekend bump.
  const viewDocs = [];
  for (const p of products) {
    let total = 0;
    for (let daysAgo = demo.DAYS - 1; daysAgo >= 0; daysAgo--) {
      const date = new Date(now.getTime() - daysAgo * 86400000);
      const trend = 1 + 0.5 * (1 - daysAgo / (demo.DAYS - 1));
      const weekend = [0, 6].includes(date.getUTCDay()) ? 1.3 : 1;
      const count = Math.round(p.viewsPerDay * trend * weekend * (0.6 + 0.8 * random()));
      total += count;
      viewDocs.push({ product: p.product._id, day: shopDay(date), demo: true, count });
    }
    await Product.updateOne({ _id: p.product._id }, { $inc: { viewCount: total } });
  }
  await ProductViewDaily.insertMany(viewDocs);

  console.log(`Added demo data for ${demo.DEMO_SHOP_EMAIL}: ${buyers.length} buyers, ${orderDocs.length} orders, ${viewDocs.reduce((s, v) => s + v.count, 0)} views over ${demo.DAYS} days.`);
}

module.exports = { addDemoData, removeDemoData };

if (require.main === module) {
  connectDB()
    .then(() => (process.argv.includes("--remove") ? removeDemoData() : addDemoData()))
    .then(() => mongoose.disconnect())
    .catch((err) => {
      console.error("Demo seed failed:", err);
      process.exit(1);
    });
}

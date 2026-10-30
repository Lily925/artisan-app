// `npm run seed`: ADD-ONLY starting data. Safe to run on a live database:
//   - never deletes or overwrites anything (users, artisans, products, orders, carts);
//   - creates seeded accounts that don't exist yet (existing ones keep their password and data);
//   - creates an artisan profile only for a seeded account that has none;
//   - creates seeded products only for artisans it created in this same run, so on an
//     existing database nothing reappears (not even a product deleted on purpose);
//   - never creates a product without a photo (no emoji placeholders).
// Fake dashboard data is separate and DEMO-ONLY: `npm run seed:demo` (see demo.js).
require("dotenv").config();
require("./productionGuard").refuseInProduction("seed demo accounts (password: artisan123)");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../models/User");
const Artisan = require("../models/Artisan");
const Product = require("../models/Product");
const { users, artisanProfiles, products } = require("./seedData");
const { pricingTiersFor } = require("../utils/pricing");

async function run() {
  await connectDB();
  const created = { users: 0, artisans: 0, products: 0 };

  const userByEmail = {};
  for (const u of users) {
    let user = await User.findOne({ email: u.email });
    if (!user) {
      const passwordHash = await bcrypt.hash(u.password, 10);
      user = await User.create({ name: u.name, email: u.email, passwordHash, role: u.role });
      created.users++;
    }
    userByEmail[u.email] = user;
  }

  const newArtisanByEmail = {};
  for (const [email, profile] of Object.entries(artisanProfiles)) {
    const user = userByEmail[email];
    if (!user || (await Artisan.exists({ user: user._id }))) continue;
    newArtisanByEmail[email] = await Artisan.create({ user: user._id, certified: true, ...profile });
    created.artisans++;
  }

  for (const p of products) {
    const artisan = newArtisanByEmail[p.artisanEmail];
    if (!artisan) continue; // existing shop: its products are its own business
    if (!p.images?.length) {
      console.warn(`Skipped "${p.titleEn}": seeded products need a real photo.`);
      continue;
    }
    await Product.create({
      title: p.title,
      titleEn: p.titleEn,
      category: p.category,
      artisan: artisan._id,
      pricingTiers: pricingTiersFor(p.price),
      description: p.description || "",
      images: p.images,
    });
    created.products++;
  }

  console.log(`Seed (add-only): created ${created.users} users, ${created.artisans} artisan profiles, ${created.products} products. Nothing was deleted or changed.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

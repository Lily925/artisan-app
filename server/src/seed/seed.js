require("dotenv").config();
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../models/User");
const Artisan = require("../models/Artisan");
const Product = require("../models/Product");
const { users, artisanProfiles, products } = require("./seedData");
const { pricingTiersFor } = require("../utils/pricing");
const { addDemoData, removeDemoData } = require("./demo");

async function run() {
  await connectDB();

  // Demo orders/views point at the users and products about to be wiped; clear them first.
  await removeDemoData();

  console.log("Clearing existing Users, Artisans, and Products...");
  await Promise.all([User.deleteMany({}), Artisan.deleteMany({}), Product.deleteMany({})]);

  console.log("Creating users...");
  const userByEmail = {};
  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    const user = await User.create({ name: u.name, email: u.email, passwordHash, role: u.role });
    userByEmail[u.email] = user;
  }

  console.log("Creating artisan profiles...");
  const artisanByEmail = {};
  for (const [email, profile] of Object.entries(artisanProfiles)) {
    const user = userByEmail[email];
    const artisan = await Artisan.create({ user: user._id, certified: true, ...profile });
    artisanByEmail[email] = artisan;
  }

  console.log("Creating products...");
  for (const p of products) {
    const artisan = artisanByEmail[p.artisanEmail];
    await Product.create({
      title: p.title,
      titleEn: p.titleEn,
      category: p.category,
      artisan: artisan._id,
      pricingTiers: pricingTiersFor(p.price),
      description: p.description || "",
      images: p.images || [],
    });
  }

  // DEMO DATA (fake orders/views for the dashboard), see demoData.js.
  await addDemoData();

  console.log(`Seeded ${users.length} users, ${Object.keys(artisanProfiles).length} artisans, ${products.length} products.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

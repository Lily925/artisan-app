// One-off, idempotent: brings shops from before approval existed up to date.
//   npm run migrate:shops                  apply
//   npm run migrate:shops -- --dry-run     only report what would change
// - a shop with no status becomes "approved" (it was already public and selling);
// - a shop with no slug gets a unique one (from the shop name, else the owner's name).
// Shops that already have a status or slug are never touched, so re-running changes nothing.
// Works on whatever database MONGODB_URI points at.
require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Artisan = require("../models/Artisan");
require("../models/User");
const { uniqueSlug } = require("../utils/shops");

async function run() {
  const dryRun = process.argv.includes("--dry-run");
  await connectDB();
  await Artisan.createIndexes(); // the unique slug index must exist before slugs are written (only adds indexes)

  const noStatus = await Artisan.countDocuments({ status: { $exists: false } });
  if (!dryRun && noStatus) await Artisan.updateMany({ status: { $exists: false } }, { $set: { status: "approved" } });
  console.log(`${dryRun ? "Would approve" : "Approved"} ${noStatus} shop(s) without a status.`);

  const noSlug = await Artisan.find({ slug: { $exists: false } }).select("shopName user").populate("user", "name").sort({ createdAt: 1 });
  const planned = new Set();
  for (const shop of noSlug) {
    let slug = await uniqueSlug(shop.shopName || shop.user?.name || "");
    // In a dry run nothing is saved, so avoid handing out the same slug twice in the report.
    for (let n = 2; planned.has(slug); n++) slug = `${slug.replace(/-\d+$/, "")}-${n}`;
    planned.add(slug);
    if (!dryRun) await Artisan.updateOne({ _id: shop._id, slug: { $exists: false } }, { $set: { slug } });
    console.log(`  ${shop.shopName || "(no shop name)"} → ${slug}`);
  }
  console.log(`${dryRun ? "Would give" : "Gave"} ${noSlug.length} shop(s) a slug.`);

  const byStatus = await Artisan.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]);
  console.log(`Shops by status: ${byStatus.map((s) => `${s._id || "(none)"} ${s.n}`).join(", ") || "none"}`);
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("migrate:shops failed:", err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});

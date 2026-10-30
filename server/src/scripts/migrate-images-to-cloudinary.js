// One-off: copies photos that the database still points at on local disk to Cloudinary and
// updates the database to the new https URLs.
//   npm run migrate:images              migrate
//   npm run migrate:images -- --dry-run show what would change, change nothing
//
// Looks at: products (images[], legacy image), users (avatarUrl), artisans (photoUrl) and
// orders (items[].image). Local paths are "/uploads/products|avatars/..." (server/uploads)
// and "/images/..." (seeded files in the React app's public/ folder).
//
// Safe to run again: each file gets a fixed Cloudinary id derived from its old path and the
// upload is remembered (StoredImage.source), so a re-run reuses it and only fixes references
// that still point at the old path. Local files are never deleted; remove them yourself once
// everything shows correctly. Requires the CLOUDINARY_* variables in server/.env.
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const StoredImage = require("../models/StoredImage");
const { STORAGE, UPLOAD_ROOT, storeOnCloudinary, sniffImageType } = require("../utils/imageStorage");

const DRY_RUN = process.argv.includes("--dry-run");
const PUBLIC_ROOT = path.join(__dirname, "..", "..", "..", "public");

// Where each kind of local path lives, its StoredImage kind and Cloudinary folder.
// "static" files (seeded /images/...) are never deleted automatically, as before.
const SOURCES = [
  { prefix: "/uploads/products/", root: path.join(UPLOAD_ROOT, "products"), kind: "product", folder: "artisan/products" },
  { prefix: "/uploads/avatars/", root: path.join(UPLOAD_ROOT, "avatars"), kind: "avatar", folder: "artisan/avatars" },
  { prefix: "/images/", root: path.join(PUBLIC_ROOT, "images"), kind: "static", folder: "artisan/static" },
];

// Every field that can hold a photo path, with how to find and replace one value.
const FIELDS = [
  { collection: "products", label: "product photos", values: (d) => d.images || [], filter: (old) => ({ images: old }), update: (old, url) => [{ $set: { "images.$[e]": url } }, { arrayFilters: [{ e: old }] }] },
  { collection: "products", label: "legacy product photo", values: (d) => [d.image], filter: (old) => ({ image: old }), update: (old, url) => [{ $set: { image: url } }, {}] },
  { collection: "users", label: "profile photos", values: (d) => [d.avatarUrl], filter: (old) => ({ avatarUrl: old }), update: (old, url) => [{ $set: { avatarUrl: url } }, {}] },
  { collection: "artisans", label: "shop photos", values: (d) => [d.photoUrl], filter: (old) => ({ photoUrl: old }), update: (old, url) => [{ $set: { photoUrl: url } }, {}] },
  { collection: "orders", label: "order item covers", values: (d) => (d.items || []).map((i) => i.image), filter: (old) => ({ "items.image": old }), update: (old, url) => [{ $set: { "items.$[i].image": url } }, { arrayFilters: [{ "i.image": old }] }] },
];

function localFile(source) {
  const src = SOURCES.find((s) => source.startsWith(s.prefix));
  if (!src) return null;
  const file = path.resolve(src.root, ...source.slice(src.prefix.length).split("/"));
  if (!file.startsWith(src.root + path.sep)) return null; // no "../" escapes
  return { ...src, file };
}

async function run() {
  if (STORAGE !== "cloudinary") {
    console.error("Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in server/.env first.");
    process.exit(1);
  }
  await connectDB();
  const db = mongoose.connection.db;

  // 1. Every local path still referenced anywhere.
  const sources = new Set();
  for (const f of FIELDS) {
    const docs = await db.collection(f.collection).find({}).toArray();
    for (const d of docs) for (const v of f.values(d)) if (typeof v === "string" && localFile(v)) sources.add(v);
  }
  console.log(`${DRY_RUN ? "[dry run] " : ""}${sources.size} local photo path(s) still referenced.`);

  // 2. Upload (or reuse) each one.
  const urlBySource = new Map();
  const stats = { uploaded: 0, reused: 0, missing: 0, notImage: 0, failed: 0 };
  for (const source of [...sources].sort()) {
    const known = await StoredImage.findOne({ source });
    if (known) { urlBySource.set(source, known.url); stats.reused++; console.log(`  reuse    ${source}`); continue; }
    const { file, kind, folder } = localFile(source);
    if (!fs.existsSync(file)) { stats.missing++; console.log(`  MISSING  ${source} (no local file; left unchanged)`); continue; }
    const buffer = await fs.promises.readFile(file);
    if (!sniffImageType(buffer)) { stats.notImage++; console.log(`  SKIPPED  ${source} (not a JPEG/PNG/WebP file)`); continue; }
    if (DRY_RUN) { stats.uploaded++; console.log(`  upload   ${source}`); urlBySource.set(source, "(new url)"); continue; }
    try {
      const publicName = "m-" + crypto.createHash("sha256").update(source).digest("hex").slice(0, 32);
      const url = await storeOnCloudinary(buffer, { folder, publicName, kind, source });
      urlBySource.set(source, url);
      stats.uploaded++;
      console.log(`  upload   ${source} -> ${url}`);
    } catch (err) {
      stats.failed++;
      console.log(`  FAILED   ${source}: ${err.message}`);
    }
  }

  // 3. Point the database at the new URLs.
  const changed = {};
  for (const f of FIELDS) {
    let n = 0;
    for (const [old, url] of urlBySource) {
      if (DRY_RUN) { n += await db.collection(f.collection).countDocuments(f.filter(old)); continue; }
      const [update, options] = f.update(old, url);
      n += (await db.collection(f.collection).updateMany(f.filter(old), update, options)).modifiedCount;
    }
    if (n) changed[f.label] = n;
  }

  console.log(`\n${DRY_RUN ? "[dry run] Would upload" : "Uploaded"} ${stats.uploaded}, reused ${stats.reused}, missing ${stats.missing}, not an image ${stats.notImage}, failed ${stats.failed}.`);
  const summary = Object.entries(changed).map(([k, v]) => `${v} with ${k}`).join(", ");
  console.log(`${DRY_RUN ? "Documents that would change" : "Documents updated"}: ${summary || "none"}.`);
  console.log("Local files were not deleted.");
  await mongoose.disconnect();
  if (stats.failed) process.exitCode = 1;
}

run().catch(async (err) => {
  console.error("Migration failed:", err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});

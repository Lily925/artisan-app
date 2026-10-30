const Artisan = require("../models/Artisan");
const Product = require("../models/Product");
const { sendPendingForArtisan } = require("../utils/payouts");
const { ARTISAN_USER_PUBLIC } = require("../config/constants");

// Fields an artisan may change on their own profile, with the JSON type each
// accepts. Everything else (shopName, specialty, certified, photoUrl, user) stays
// admin/seed-controlled. yearsExperience also accepts null to clear it.
const SELF_EDITABLE_FIELDS = {
  bio: "string",
  instagramHandle: "string",
  contactInfo: "string",
  location: "string",
  yearsExperience: "number",
  payoutEmail: "string", // private (select: false); PayPal email for milestone payouts
};

// Public endpoints expose the artisan's name, profile photo and short bio — never email
// (contact is Instagram-only).
// ?category=<key> returns only artisans who sell at least one product in that category
// (used to match artisans to a commission request).
async function listArtisans(req, res) {
  const { category } = req.query;
  if (category !== undefined && typeof category !== "string") {
    return res.status(400).json({ error: "category must be a string" });
  }
  const filter = category ? { _id: { $in: await Product.distinct("artisan", { category, isHidden: { $ne: true } }) } } : {};
  const artisans = await Artisan.find(filter).populate("user", ARTISAN_USER_PUBLIC);
  res.json(artisans);
}

async function getArtisan(req, res) {
  const artisan = await Artisan.findById(req.params.id).populate("user", ARTISAN_USER_PUBLIC);
  if (!artisan) return res.status(404).json({ error: "Artisan not found" });
  res.json(artisan);
}

async function getMyArtisan(req, res) {
  const artisan = await Artisan.findOne({ user: req.user.id }).select("+payoutEmail").populate("user", "name email");
  if (!artisan) return res.status(404).json({ error: "No artisan profile is linked to this account" });
  res.json(artisan);
}

// "Set up your shop" (first step after an artisan signs up): creates the caller's Artisan
// record once. shopName is required here and can't be changed by the artisan later
// (see SELF_EDITABLE_FIELDS). New shops are never certified. 409 if the shop exists.
const SHOP_NAME = /^[\p{L}\p{N}][\p{L}\p{N} ._&'-]{1,59}$/u;
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function setupMyShop(req, res) {
  const str = (v) => (typeof v === "string" ? v.trim() : v === undefined ? "" : null);
  const shopName = str(req.body?.shopName), location = str(req.body?.location), bio = str(req.body?.bio), instagramHandle = str(req.body?.instagramHandle);
  if ([shopName, location, bio, instagramHandle].includes(null)) return res.status(400).json({ error: "All fields must be text" });
  if (!SHOP_NAME.test(shopName || "")) {
    return res.status(400).json({ error: "Shop name must be 2-60 characters: letters, numbers, spaces and . _ - & '", code: "BAD_SHOP_NAME" });
  }
  if (await Artisan.exists({ user: req.user.id })) {
    return res.status(409).json({ error: "Your shop is already set up", code: "SHOP_EXISTS" });
  }
  // Shop names are unique (case-insensitive) so nobody can pose as an existing shop.
  if (await Artisan.exists({ shopName: new RegExp(`^${escapeRegex(shopName)}$`, "i") })) {
    return res.status(409).json({ error: "That shop name is already taken", code: "SHOP_NAME_TAKEN" });
  }
  try {
    const artisan = await Artisan.create({ user: req.user.id, shopName, location, bio, instagramHandle, certified: false });
    await artisan.populate("user", "name email");
    res.status(201).json(artisan);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: "Your shop is already set up", code: "SHOP_EXISTS" });
    if (err.name === "ValidationError") {
      return res.status(400).json({ error: Object.values(err.errors).map((e) => e.message).join(", ") });
    }
    throw err;
  }
}

async function updateMyArtisan(req, res) {
  const artisan = await Artisan.findOne({ user: req.user.id }).select("+payoutEmail");
  const previousPayoutEmail = artisan?.payoutEmail || "";
  if (!artisan) return res.status(404).json({ error: "No artisan profile is linked to this account" });

  for (const [field, type] of Object.entries(SELF_EDITABLE_FIELDS)) {
    const value = req.body[field];
    if (value === undefined) continue;
    const clearsNumber = type === "number" && value === null;
    if (!clearsNumber && typeof value !== type) {
      return res.status(400).json({ error: `${field} must be a ${type}${type === "number" ? " or null" : ""}` });
    }
    artisan[field] = value;
  }

  try {
    await artisan.save();
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ error: Object.values(err.errors).map((e) => e.message).join(", ") });
    }
    throw err;
  }

  // A new payout email: send the releases that were waiting for one.
  let payoutsSent = 0;
  if (artisan.payoutEmail && artisan.payoutEmail !== previousPayoutEmail) {
    try {
      payoutsSent = await sendPendingForArtisan(artisan._id);
    } catch (err) {
      console.error(`Sending pending payouts for artisan ${artisan._id} failed: ${err.message}`);
    }
  }

  await artisan.populate("user", "name email");
  res.json({ ...artisan.toJSON(), payoutOrdersProcessed: payoutsSent });
}

module.exports = { listArtisans, getArtisan, getMyArtisan, setupMyShop, updateMyArtisan };

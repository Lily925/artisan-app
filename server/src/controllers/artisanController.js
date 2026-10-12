const Artisan = require("../models/Artisan");
const Product = require("../models/Product");

// Fields an artisan may change on their own profile, with the JSON type each
// accepts. Everything else (shopName, specialty, certified, photoUrl, user) stays
// admin/seed-controlled. yearsExperience also accepts null to clear it.
const SELF_EDITABLE_FIELDS = {
  bio: "string",
  instagramHandle: "string",
  contactInfo: "string",
  location: "string",
  yearsExperience: "number",
};

// Public endpoints expose the artisan's name only — never email (contact is Instagram-only).
// ?category=<key> returns only artisans who sell at least one product in that category
// (used to match artisans to a commission request).
async function listArtisans(req, res) {
  const { category } = req.query;
  if (category !== undefined && typeof category !== "string") {
    return res.status(400).json({ error: "category must be a string" });
  }
  const filter = category ? { _id: { $in: await Product.distinct("artisan", { category }) } } : {};
  const artisans = await Artisan.find(filter).populate("user", "name");
  res.json(artisans);
}

async function getArtisan(req, res) {
  const artisan = await Artisan.findById(req.params.id).populate("user", "name");
  if (!artisan) return res.status(404).json({ error: "Artisan not found" });
  res.json(artisan);
}

async function getMyArtisan(req, res) {
  const artisan = await Artisan.findOne({ user: req.user.id }).populate("user", "name email");
  if (!artisan) return res.status(404).json({ error: "No artisan profile is linked to this account" });
  res.json(artisan);
}

async function updateMyArtisan(req, res) {
  const artisan = await Artisan.findOne({ user: req.user.id });
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

  await artisan.populate("user", "name email");
  res.json(artisan);
}

module.exports = { listArtisans, getArtisan, getMyArtisan, updateMyArtisan };

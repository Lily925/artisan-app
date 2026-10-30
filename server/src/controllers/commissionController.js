const mongoose = require("mongoose");
const Commission = require("../models/Commission");
const Artisan = require("../models/Artisan");
const { ARTISAN_USER_PUBLIC } = require("../config/constants");

// Keys match the frontend's productCategories list (same as productController).
const CATEGORIES = ["jewelry", "ceramics", "art", "textile", "crafts", "leather", "wood"];
const MAX_BID_USD = 10000;
const MAX_DESCRIPTION = 2000;
const MAX_BID_MESSAGE = 1000;
const text = (v) => (typeof v === "string" ? v.trim() : "");

// Bidders (artisans) are shown by shop/name/photo only — never email (contact is Instagram-only).
const BID_ARTISAN_POPULATE = {
  path: "bids.artisan",
  select: "shopName specialty certified photoUrl instagramHandle user",
  populate: { path: "user", select: ARTISAN_USER_PUBLIC },
};

async function createCommission(req, res) {
  const category = text(req.body.category);
  const description = text(req.body.description);
  if (!CATEGORIES.includes(category)) return res.status(400).json({ error: "Choose a valid category" });
  if (!description || description.length > MAX_DESCRIPTION) {
    return res.status(400).json({ error: `Description is required (max ${MAX_DESCRIPTION} characters)` });
  }

  const commission = await Commission.create({
    buyer: req.user.id,
    category,
    description,
    budgetRange: text(req.body.budgetRange).slice(0, 100),
    timeline: text(req.body.timeline).slice(0, 100),
    referenceImage: text(req.body.referenceImage).slice(0, 200),
  });
  res.status(201).json(commission);
}

// Open requests board (what artisans bid on). Other artisans' bids are private:
// each request carries only a bid count and the caller's own bid, if any.
async function listCommissions(req, res) {
  const { category } = req.query;
  if (category !== undefined && typeof category !== "string") {
    return res.status(400).json({ error: "category must be a string" });
  }
  const filter = { status: "open" };
  if (category) filter.category = category;

  const [commissions, artisan] = await Promise.all([
    Commission.find(filter).populate("buyer", "name").sort({ createdAt: -1 }),
    Artisan.findOne({ user: req.user.id }).select("_id"),
  ]);

  res.json(commissions.map((c) => {
    const { bids, ...rest } = c.toObject();
    const myBid = artisan ? bids.find((b) => b.artisan.equals(artisan._id)) || null : null;
    return { ...rest, bidCount: bids.length, myBid, isMine: Boolean(c.buyer && c.buyer._id.equals(req.user.id)) };
  }));
}

// The caller's own requests (every status), with full bid details for comparing.
async function listMyCommissions(req, res) {
  const commissions = await Commission.find({ buyer: req.user.id })
    .populate(BID_ARTISAN_POPULATE)
    .sort({ createdAt: -1 });
  res.json(commissions);
}

async function submitBid(req, res) {
  const price = Math.round(Number(req.body.price) * 100) / 100;
  const message = text(req.body.message);
  if (typeof req.body.price !== "number" && typeof req.body.price !== "string") {
    return res.status(400).json({ error: "price is required" });
  }
  if (!Number.isFinite(price) || price <= 0 || price > MAX_BID_USD) {
    return res.status(400).json({ error: `Price must be between $0.01 and $${MAX_BID_USD}` });
  }
  if (message.length > MAX_BID_MESSAGE) {
    return res.status(400).json({ error: `Message must be ${MAX_BID_MESSAGE} characters or fewer` });
  }

  const artisan = await Artisan.findOne({ user: req.user.id });
  if (!artisan) return res.status(400).json({ error: "No artisan profile is linked to this account yet" });

  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Commission not found" });
  const commission = await Commission.findById(req.params.id);
  if (!commission) return res.status(404).json({ error: "Commission not found" });
  if (commission.status !== "open") {
    return res.status(400).json({ error: "This commission is no longer open for bids" });
  }
  if (commission.buyer.equals(req.user.id)) {
    return res.status(400).json({ error: "You can't bid on your own request" });
  }
  if (commission.bids.some((b) => b.artisan.equals(artisan._id))) {
    return res.status(409).json({ error: "You've already sent a bid for this request" });
  }

  commission.bids.push({ artisan: artisan._id, price, message });
  await commission.save();
  res.status(201).json({ bid: commission.bids[commission.bids.length - 1], bidCount: commission.bids.length });
}

async function acceptBid(req, res) {
  const { bidId } = req.body;
  if (!mongoose.isValidObjectId(bidId)) return res.status(400).json({ error: "bidId is required" });

  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Commission not found" });
  const commission = await Commission.findById(req.params.id);
  if (!commission) return res.status(404).json({ error: "Commission not found" });
  if (!commission.buyer.equals(req.user.id)) {
    return res.status(403).json({ error: "Only the buyer who created this commission can accept a bid" });
  }
  if (commission.status !== "open") {
    return res.status(400).json({ error: "A bid has already been accepted for this request" });
  }

  const bid = commission.bids.id(bidId);
  if (!bid) return res.status(404).json({ error: "Bid not found" });

  commission.bids.forEach((b) => {
    b.status = b._id.equals(bid._id) ? "accepted" : "rejected";
  });
  commission.status = "matched";

  await commission.save();
  await commission.populate(BID_ARTISAN_POPULATE);
  res.json(commission);
}

module.exports = { createCommission, listCommissions, listMyCommissions, submitBid, acceptBid };

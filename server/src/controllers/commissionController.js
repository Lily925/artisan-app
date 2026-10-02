const Commission = require("../models/Commission");
const Artisan = require("../models/Artisan");

async function createCommission(req, res) {
  const { category, description, budgetRange, timeline, referenceImage } = req.body;
  if (!category || !description) {
    return res.status(400).json({ error: "category and description are required" });
  }

  const commission = await Commission.create({
    buyer: req.user.id,
    category,
    description,
    budgetRange,
    timeline,
    referenceImage,
  });
  res.status(201).json(commission);
}

async function listCommissions(req, res) {
  const filter = { status: "open" };
  if (req.query.category) filter.category = req.query.category;

  const commissions = await Commission.find(filter)
    .populate("buyer", "name")
    .sort({ createdAt: -1 });
  res.json(commissions);
}

async function submitBid(req, res) {
  const { price, message } = req.body;
  if (!price) return res.status(400).json({ error: "price is required" });

  const artisan = await Artisan.findOne({ user: req.user.id });
  if (!artisan) return res.status(400).json({ error: "No artisan profile is linked to this account yet" });

  const commission = await Commission.findById(req.params.id);
  if (!commission) return res.status(404).json({ error: "Commission not found" });
  if (commission.status !== "open") {
    return res.status(400).json({ error: "This commission is no longer open for bids" });
  }

  commission.bids.push({ artisan: artisan._id, price, message });
  await commission.save();
  res.status(201).json(commission);
}

async function acceptBid(req, res) {
  const { bidId } = req.body;
  if (!bidId) return res.status(400).json({ error: "bidId is required" });

  const commission = await Commission.findById(req.params.id);
  if (!commission) return res.status(404).json({ error: "Commission not found" });
  if (commission.buyer.toString() !== req.user.id) {
    return res.status(403).json({ error: "Only the buyer who created this commission can accept a bid" });
  }

  const bid = commission.bids.id(bidId);
  if (!bid) return res.status(404).json({ error: "Bid not found" });

  commission.bids.forEach((b) => {
    b.status = b._id.equals(bid._id) ? "accepted" : "rejected";
  });
  commission.status = "matched";

  await commission.save();
  res.json(commission);
}

module.exports = { createCommission, listCommissions, submitBid, acceptBid };

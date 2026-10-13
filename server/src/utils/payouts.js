// Artisan milestone payouts ("releases") through PayPal Payouts.
//
// The artisan's net = order total - commissionFee (item prices + shipping; the platform keeps
// the buyer's 15% fee). It is released 30% at In production, 30% at Shipped, 40% at Completed.
// When a milestone is reached its release is sent to the artisan's payoutEmail; without one it
// waits as "pending_payout" and is sent when the artisan saves an email.
//
// Never paying twice:
//  - a release is claimed with an atomic update (only from due/pending_payout/failed-before-
//    PayPal-accepted-it) before PayPal is called, so concurrent triggers can't both send;
//  - its PayPal sender_batch_id is fixed (order id + milestone) and PayPal rejects a reused one;
//  - the same value is the PayPal-Request-Id, so a retried request returns the original result;
//  - once PayPal has accepted a payout (payoutBatchId set) it's never re-sent automatically.
const Order = require("../models/Order");
const Artisan = require("../models/Artisan");
const Product = require("../models/Product");
const paypal = require("./paypal");

const SPLITS = [["in_production", 30], ["shipped", 30], ["completed", 40]];
const STEP = { pending: 0, paid: 0, in_production: 1, shipped: 2, completed: 3 };
const SENDABLE = ["pending_payout", "failed", "due"]; // "due" kept for safety; reached releases go straight to sending
const ITEM_DONE = { SUCCESS: "paid" };
const ITEM_FAILED = ["FAILED", "RETURNED", "BLOCKED", "REFUNDED", "REVERSED", "DENIED"];

const cents = (n) => Math.round(n * 100);

// The three releases for a paid order, all held. The last one takes the rounding remainder,
// so they always add up to exactly the net amount.
function buildReleases(order) {
  const net = cents(order.total) - cents(order.commissionFee);
  let left = net;
  return SPLITS.map(([milestone, percent], i) => {
    const amount = i === SPLITS.length - 1 ? left : Math.round((net * percent) / 100);
    left -= amount;
    return { milestone, percent, amount: amount / 100, status: "held" };
  });
}

const isPaidOrder = (order) => Boolean(order.payment?.capturedAt);

// Paid orders captured before releases existed get them now (persisted once, never replaced).
async function ensureReleases(order) {
  if (!isPaidOrder(order) || order.releases?.length) return order;
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, $or: [{ releases: { $exists: false } }, { releases: { $size: 0 } }] },
    { $set: { releases: buildReleases(order) } },
    { new: true }
  );
  return updated || Order.findById(order._id);
}

async function artisanIdFor(order) {
  const withArtisan = order.items.find((i) => i.artisan);
  if (withArtisan) return withArtisan.artisan;
  const product = await Product.findById(order.items[0]?.product).select("artisan");
  return product?.artisan || null;
}

// Sends one release if it is sendable. Returns nothing; the outcome is stored on the order.
async function sendRelease(orderId, milestone) {
  let order = await Order.findById(orderId);
  const release = order?.releases?.find((r) => r.milestone === milestone);
  if (!release || !SENDABLE.includes(release.status) || release.payoutBatchId) return;
  if (STEP[order.status] < STEP[milestone] || order.status === "cancelled") return; // not reached

  const artisanId = await artisanIdFor(order);
  const artisan = artisanId && (await Artisan.findById(artisanId).select("+payoutEmail"));
  if (!artisan?.payoutEmail) {
    await Order.updateOne(
      { _id: orderId, releases: { $elemMatch: { milestone, status: { $in: ["held", "due", "failed"] }, payoutBatchId: { $in: [null, ""] } } } },
      { $set: { "releases.$.status": "pending_payout", "releases.$.dueAt": release.dueAt || new Date() } }
    );
    return;
  }

  const senderBatchId = `artisan-${orderId}-${milestone}`;
  // The claim: only one caller gets past this for a given release.
  order = await Order.findOneAndUpdate(
    { _id: orderId, releases: { $elemMatch: { milestone, status: { $in: SENDABLE }, payoutBatchId: { $in: [null, ""] } } } },
    { $set: { "releases.$.status": "sending", "releases.$.senderBatchId": senderBatchId, "releases.$.receiver": artisan.payoutEmail, "releases.$.error": "" } },
    { new: true }
  );
  if (!order) return;
  const claimed = order.releases.find((r) => r.milestone === milestone);

  const set = (fields) => Order.updateOne(
    { _id: orderId, "releases.milestone": milestone },
    { $set: Object.fromEntries(Object.entries(fields).map(([k, v]) => [`releases.$.${k}`, v])) }
  );
  try {
    const result = await paypal.createPayout({
      sender_batch_header: {
        sender_batch_id: senderBatchId,
        email_subject: "You have a payout from Artisan",
        email_message: `Milestone payment (${claimed.percent}%) for order ${orderId}.`,
      },
      items: [{
        recipient_type: "EMAIL",
        receiver: artisan.payoutEmail,
        amount: { value: claimed.amount.toFixed(2), currency: "USD" },
        note: `Order ${orderId}: ${milestone.replace("_", " ")} (${claimed.percent}%)`,
        sender_item_id: `${orderId}-${milestone}`,
      }],
    }, senderBatchId);
    await set({
      status: "sent", payoutBatchId: result.batch_header?.payout_batch_id,
      payoutItemStatus: result.batch_header?.batch_status || "PENDING", sentAt: new Date(),
    });
  } catch (err) {
    if (err instanceof paypal.PayPalError && /DUPLICATE|ALREADY/i.test(err.issue || "")) {
      // PayPal already has this batch: it was sent before, never send it again. Needs a manual look-up.
      await set({ status: "sent", payoutItemStatus: "DUPLICATE_BATCH", error: "PayPal already has this payout batch", sentAt: new Date() });
    } else {
      // Not accepted by PayPal: safe to retry later (next milestone, or when the email is saved).
      await set({ status: "failed", error: (err.issue || err.message || "Payout failed").slice(0, 200) });
    }
    console.error(`Payout ${senderBatchId}: ${err.status || ""} ${err.issue || err.message} debug_id=${err.debugId || "-"}`);
  }
}

// Marks every reached milestone's release as due and sends what can be sent (also retries
// earlier pending/failed ones of this order). Safe to call any number of times.
async function processOrderReleases(orderId) {
  let order = await Order.findById(orderId);
  if (!order || !isPaidOrder(order)) return order;
  order = await ensureReleases(order);
  for (const r of order.releases) {
    if (STEP[order.status] >= STEP[r.milestone] && r.status === "held") {
      await Order.updateOne(
        { _id: orderId, releases: { $elemMatch: { milestone: r.milestone, status: "held" } } },
        { $set: { "releases.$.status": "due", "releases.$.dueAt": new Date() } }
      );
    }
  }
  for (const [milestone] of SPLITS) await sendRelease(orderId, milestone);
  return refreshSentReleases(orderId);
}

// Updates "sent" releases from PayPal (PENDING -> SUCCESS/UNCLAIMED/...). Best effort.
async function refreshSentReleases(orderId) {
  const order = await Order.findById(orderId);
  for (const r of order?.releases || []) {
    if (r.status !== "sent" || !r.payoutBatchId) continue;
    try {
      const batch = await paypal.getPayoutBatch(r.payoutBatchId);
      const itemStatus = batch.items?.[0]?.transaction_status || batch.batch_header?.batch_status;
      const fields = { "releases.$.payoutItemStatus": itemStatus };
      if (ITEM_DONE[itemStatus]) Object.assign(fields, { "releases.$.status": "paid", "releases.$.paidAt": new Date() });
      if (ITEM_FAILED.includes(itemStatus)) {
        // Accepted then failed at PayPal: not re-sent automatically (it has a batch id).
        Object.assign(fields, { "releases.$.status": "failed", "releases.$.error": `PayPal payout ${itemStatus}` });
      }
      await Order.updateOne({ _id: orderId, "releases.milestone": r.milestone }, { $set: fields });
    } catch (err) {
      console.error(`Payout status check ${r.payoutBatchId}: ${err.issue || err.message}`);
    }
  }
  return Order.findById(orderId);
}

// After an artisan saves a payout email: send their releases that were waiting for one.
async function sendPendingForArtisan(artisanId) {
  const productIds = (await Product.find({ artisan: artisanId }).select("_id")).map((p) => p._id);
  const orders = await Order.find({
    $or: [{ "items.artisan": artisanId }, { "items.product": { $in: productIds } }],
    releases: { $elemMatch: { status: { $in: ["pending_payout", "failed", "due"] }, payoutBatchId: { $in: [null, ""] } } },
  }).select("_id");
  for (const o of orders) await processOrderReleases(o._id);
  return orders.length;
}

// Released = handed to PayPal (sent or paid); held = milestone not reached yet;
// waiting = reached but not sent yet (no payout email, sending, or failed).
function summarize(releases) {
  const sum = (pred) => (releases || []).filter(pred).reduce((s, r) => s + cents(r.amount), 0) / 100;
  return {
    released: sum((r) => ["sent", "paid"].includes(r.status)),
    held: sum((r) => r.status === "held"),
    waiting: sum((r) => ["pending_payout", "sending", "failed", "due"].includes(r.status)),
  };
}

module.exports = { buildReleases, ensureReleases, processOrderReleases, refreshSentReleases, sendPendingForArtisan, summarize, isPaidOrder };

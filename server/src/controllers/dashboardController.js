const Artisan = require("../models/Artisan");
const { ignoreSelfLikes } = require("../utils/selfLikes");
const Product = require("../models/Product");
const Order = require("../models/Order");
const User = require("../models/User");
const { ProductViewDaily } = require("../models/ProductView");
const { SHOP_TIME_ZONE, shopDay, lastShopDays } = require("../utils/dates");
const { DEMO_EMAIL_DOMAIN } = require("../seed/demoData");
const payouts = require("../utils/payouts");

const STATUSES = ["pending", "paid", "in_production", "shipped", "completed", "cancelled"];
const CHART_DAYS = 30;
const round2 = (n) => Math.round(n * 100) / 100;
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const DEMO_EMAIL = new RegExp(`${escapeRegex(DEMO_EMAIL_DOMAIN)}$`);

// Sales & engagement for the logged-in artisan's own shop.
// Privacy: only aggregated counts and sums leave this function, never anything about a
// buyer (no names, emails, addresses or user ids). Amounts are USD (the item prices the
// buyer paid; the 15% buyer fee and shipping aren't the artisan's revenue).
// Sales = orders placed on the platform, whatever their payment state (PayPal isn't
// integrated yet). Cancelled orders are left out of every total except the status counts.
async function getMyDashboard(req, res) {
  const artisan = await Artisan.findOne({ user: req.user.id }).select("+payoutEmail");
  if (!artisan) return res.status(404).json({ error: "No artisan profile is linked to this account" });

  const products = await Product.find({ artisan: artisan._id })
    .select("title titleEn category images likeCount viewCount createdAt artisan")
    .sort({ createdAt: -1 });
  await ignoreSelfLikes(products);
  const productIds = products.map((p) => p._id);
  const ownProduct = new Set(productIds.map(String));

  // Order items carry their seller since the dashboard was added; older items are
  // matched through the product (so they're lost if that product was deleted).
  const orders = await Order.find({
    $or: [{ "items.artisan": artisan._id }, { "items.product": { $in: productIds } }],
  }).select("user items status createdAt total commissionFee payment releases");
  const isMine = (item) => (item.artisan ? item.artisan.equals(artisan._id) : ownProduct.has(String(item.product)));

  const days = lastShopDays(CHART_DAYS);
  const daily = new Map(days.map((d) => [d, { date: d, orders: 0, units: 0, revenue: 0, views: 0 }]));
  const statusCounts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  const perProduct = new Map(products.map((p) => [String(p._id), { units: 0, revenue: 0, orders: 0 }]));
  const deletedTitles = new Map(); // sales of products that no longer exist, by product id
  const ordersByBuyer = new Map();
  // Milestone payouts (USD cents) over paid, non-cancelled orders; see utils/payouts.js.
  const payoutCents = { released: 0, held: 0, waiting: 0 };
  let orderCount = 0;
  let units = 0;
  let revenue = 0;

  for (const order of orders) {
    const items = order.items.filter(isMine);
    if (items.length === 0) continue;
    statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
    if (order.status === "cancelled") continue;
    if (payouts.isPaidOrder(order)) {
      const s = payouts.summarize(order.releases?.length ? order.releases : payouts.buildReleases(order));
      for (const k of Object.keys(payoutCents)) payoutCents[k] += Math.round(s[k] * 100);
    }

    orderCount++;
    const buyer = String(order.user);
    ordersByBuyer.set(buyer, (ordersByBuyer.get(buyer) || 0) + 1);
    const day = daily.get(shopDay(order.createdAt));
    if (day) day.orders++;

    const productsInOrder = new Set();
    for (const item of items) {
      const amount = item.unitPrice * item.qty;
      units += item.qty;
      revenue += amount;
      if (day) { day.units += item.qty; day.revenue += amount; }

      const key = String(item.product);
      if (!perProduct.has(key)) {
        perProduct.set(key, { units: 0, revenue: 0, orders: 0 });
        deletedTitles.set(key, item.title);
      }
      const row = perProduct.get(key);
      row.units += item.qty;
      row.revenue += amount;
      if (!productsInOrder.has(key)) { row.orders++; productsInOrder.add(key); }
    }
  }

  const viewRows = await ProductViewDaily.aggregate([
    { $match: { product: { $in: productIds }, day: { $gte: days[0] } } },
    { $group: { _id: "$day", views: { $sum: "$count" } } },
  ]);
  for (const row of viewRows) {
    const day = daily.get(row._id);
    if (day) day.views = row.views;
  }

  const productRows = products.map((p) => {
    const s = perProduct.get(String(p._id));
    const views = p.viewCount || 0;
    return {
      id: p._id,
      title: p.title,
      titleEn: p.titleEn || "",
      category: p.category,
      image: p.images[0] || "",
      unitsSold: s.units,
      orders: s.orders,
      revenue: round2(s.revenue),
      viewCount: views,
      likeCount: p.likeCount || 0,
      // orders / views; null when there are no views to divide by
      conversionRate: views > 0 ? s.orders / views : null,
    };
  });
  for (const [id, title] of deletedTitles) {
    const s = perProduct.get(id);
    productRows.push({
      id, title, titleEn: "", category: "", image: "", deleted: true,
      unitsSold: s.units, orders: s.orders, revenue: round2(s.revenue),
      viewCount: 0, likeCount: 0, conversionRate: null,
    });
  }

  // How much of the above is demo data (seed/demo.js), so the page can say so.
  // Counts only: which buyers are demo accounts stays on the server.
  const [demoBuyers, demoViewRows] = await Promise.all([
    User.find({ _id: { $in: [...ordersByBuyer.keys()] }, email: DEMO_EMAIL }).select("_id"),
    ProductViewDaily.aggregate([
      { $match: { product: { $in: productIds }, demo: true } },
      { $group: { _id: null, views: { $sum: "$count" } } },
    ]),
  ]);
  const demoOrders = demoBuyers.reduce((sum, u) => sum + ordersByBuyer.get(String(u._id)), 0);
  const demoViews = demoViewRows[0] ? demoViewRows[0].views : 0;

  const buyerOrderCounts = [...ordersByBuyer.values()];
  res.json({
    currency: "USD",
    timeZone: SHOP_TIME_ZONE,
    generatedAt: new Date(),
    totals: {
      orders: orderCount,
      unitsSold: units,
      revenue: round2(revenue),
      views: products.reduce((sum, p) => sum + (p.viewCount || 0), 0),
      likes: products.reduce((sum, p) => sum + (p.likeCount || 0), 0),
      uniqueBuyers: buyerOrderCounts.length,
      repeatBuyers: buyerOrderCounts.filter((n) => n >= 2).length,
    },
    statusCounts,
    // released = handed to PayPal; held = milestone not reached; waiting = reached, not sent yet
    payouts: {
      released: payoutCents.released / 100, held: payoutCents.held / 100, waiting: payoutCents.waiting / 100,
      hasPayoutEmail: Boolean(artisan.payoutEmail),
    },
    demo: { orders: demoOrders, views: demoViews },
    products: productRows,
    daily: days.map((d) => {
      const day = daily.get(d);
      return { ...day, revenue: round2(day.revenue) };
    }),
  });
}

module.exports = { getMyDashboard };

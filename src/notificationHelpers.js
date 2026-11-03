import { orderPath, productPath } from "./paths";

// Text and links for notifications: the server stores only a type and a few values.

// "12 minutes ago" in the app's own MN/EN/KO wording (browsers differ in Mongolian support).
export function timeAgo(date, labels, now = Date.now()) {
  const seconds = Math.max(0, (now - new Date(date).getTime()) / 1000);
  if (seconds < 60) return labels.justNow;
  if (seconds < 3600) return labels.minutes(Math.floor(seconds / 60));
  if (seconds < 86400) return labels.hours(Math.floor(seconds / 3600));
  return labels.days(Math.floor(seconds / 86400));
}

export function notificationText(t, notification, fmtAmt) {
  const write = t.notifications.text[notification.type];
  if (!write) return t.notifications.fallback; // a type newer than this page
  const p = notification.params || {};
  return write({
    ...p,
    category: t.productCategories.find((c) => c.key === p.category)?.label || p.category || "",
    amount: Number.isFinite(p.amount) ? fmtAmt(p.amount) : "",
  });
}

const ID = "([0-9a-f]{24})";
const PAGES = ["/my-commissions", "/commission-board", "/profile", "/admin/shops"];

// A stored link -> the app address to open. Null for anything else, so a stored link can
// only ever open one of the app's own pages. The server stores products as /products/:id.
export function parseLink(link) {
  if (typeof link !== "string") return null;
  if (PAGES.includes(link)) return link;
  const order = new RegExp(`^/orders/${ID}$`).exec(link);
  if (order) return orderPath(order[1]);
  const product = new RegExp(`^/products/${ID}$`).exec(link);
  return product ? productPath(product[1]) : null;
}

export const badgeText = (count) => (count > 9 ? "9+" : String(count));

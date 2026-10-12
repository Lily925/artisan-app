// Dashboard days follow the shop's calendar (Ulaanbaatar, UTC+8), not the server's.
const SHOP_TIME_ZONE = "Asia/Ulaanbaatar";
const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: SHOP_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });

// "YYYY-MM-DD" for the given instant in the shop's time zone.
function shopDay(date = new Date()) {
  return dayFormat.format(date);
}

// The last `n` shop days, oldest first, ending today.
function lastShopDays(n, now = new Date()) {
  const days = [];
  for (let i = n - 1; i >= 0; i--) days.push(shopDay(new Date(now.getTime() - i * 86400000)));
  return days;
}

module.exports = { SHOP_TIME_ZONE, shopDay, lastShopDays };

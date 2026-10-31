// Small in-memory fixed-window rate limiter (no dependency). Fine for one server process;
// with several instances, swap the Map for a shared store (e.g. Redis).
// Behind a reverse proxy set TRUST_PROXY (see server.js) so req.ip is the client's address.
function rateLimit({ windowMs, max, key, message, skipSuccessful = false }) {
  const hits = new Map(); // key -> { count, resetAt }
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
  }, windowMs);
  sweep.unref(); // don't keep the process alive just for this

  return (req, res, next) => {
    const k = key(req);
    if (!k) return next();
    const now = Date.now();
    let entry = hits.get(k);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(k, entry);
    }
    if (entry.count >= max) {
      res.set("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ error: message || "Too many requests. Please try again later.", code: "RATE_LIMITED" });
    }
    entry.count++;
    // e.g. login: only failed attempts count towards the limit
    if (skipSuccessful) res.on("finish", () => { if (res.statusCode < 400 && entry.count > 0) entry.count--; });
    next();
  };
}

const MIN = 60 * 1000;
const lower = (v) => (typeof v === "string" ? v.trim().toLowerCase().slice(0, 254) : "");

// Login: failed attempts per client address, and per account (slows password guessing
// even from many addresses). Successful logins don't count.
const loginByIp = rateLimit({ windowMs: 15 * MIN, max: 20, skipSuccessful: true, key: (req) => `ip:${req.ip}`,
  message: "Too many failed logins. Please wait 15 minutes and try again." });
const loginByAccount = rateLimit({ windowMs: 15 * MIN, max: 5, skipSuccessful: true, key: (req) => lower(req.body?.email) && `email:${lower(req.body.email)}`,
  message: "Too many failed logins for this account. Please wait 15 minutes and try again." });
const signupByIp = rateLimit({ windowMs: 60 * MIN, max: 10, key: (req) => `ip:${req.ip}`,
  message: "Too many sign-ups from this address. Please try again later." });
// Password change: failed attempts per account (guessing the current password with a
// stolen token). Successful changes don't count.
const passwordChange = rateLimit({ windowMs: 15 * MIN, max: 5, skipSuccessful: true, key: (req) => req.user && `user:${req.user.id}`,
  message: "Too many failed attempts. Please wait 15 minutes and try again." });
// Checkout: every create call makes a PayPal order, so cap it per user.
const checkoutCreate = rateLimit({ windowMs: 10 * MIN, max: 10, key: (req) => req.user && `user:${req.user.id}`,
  message: "Too many payment attempts. Please wait a few minutes and try again." });
const checkoutCapture = rateLimit({ windowMs: 10 * MIN, max: 20, key: (req) => req.user && `user:${req.user.id}` });

module.exports = { rateLimit, loginByIp, loginByAccount, signupByIp, passwordChange, checkoutCreate, checkoutCapture };

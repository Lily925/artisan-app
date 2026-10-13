// Helmet-style response headers without the dependency. The API only returns JSON and
// uploaded images, so the policy can be strict.
function securityHeaders(req, res, next) {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    "Referrer-Policy": "no-referrer",
    "Cross-Origin-Opener-Policy": "same-origin",
    "X-DNS-Prefetch-Control": "off",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  });
  // Uploaded photos are shown by the frontend, which may be on another site.
  res.set("Cross-Origin-Resource-Policy", req.path.startsWith("/uploads/") ? "cross-origin" : "same-origin");
  // API responses can hold personal data (addresses, orders): never cache them.
  if (req.path.startsWith("/api/")) res.set("Cache-Control", "no-store");
  if (process.env.NODE_ENV === "production") res.set("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  next();
}

module.exports = securityHeaders;

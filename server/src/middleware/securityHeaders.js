const helmet = require("helmet");

// Security headers (helmet). The API only returns JSON (and, in development, uploaded
// images), so the policy can be strict.
function securityHeaders({ isProduction }) {
  const base = helmet({
    contentSecurityPolicy: { useDefaults: false, directives: { "default-src": ["'none'"], "frame-ancestors": ["'none'"], "base-uri": ["'none'"] } },
    crossOriginResourcePolicy: { policy: "same-origin" },
    crossOriginOpenerPolicy: { policy: "same-origin" },
    referrerPolicy: { policy: "no-referrer" },
    xFrameOptions: { action: "deny" },
    // HTTPS only in production (over plain http on localhost it would be ignored anyway).
    strictTransportSecurity: isProduction ? { maxAge: 15552000, includeSubDomains: true } : false,
  });

  return (req, res, next) => base(req, res, () => {
    res.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    // Local-disk photos are shown by the frontend, which is on another site.
    if (req.path.startsWith("/uploads/")) res.set("Cross-Origin-Resource-Policy", "cross-origin");
    // API responses can hold personal data (addresses, orders): never cache them.
    if (req.path.startsWith("/api/")) res.set("Cache-Control", "no-store");
    next();
  });
}

module.exports = securityHeaders;

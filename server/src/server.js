require("dotenv").config();
// Check the environment before anything else is loaded (exits with a clear message).
const { checkEnv } = require("./config/env");
const { isProduction, allowedOrigins } = checkEnv();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const securityHeaders = require("./middleware/securityHeaders");
const { UPLOAD_ROOT, STORAGE } = require("./utils/imageStorage");

const authRoutes = require("./routes/authRoutes");
const productRoutes = require("./routes/productRoutes");
const artisanRoutes = require("./routes/artisanRoutes");
const cartRoutes = require("./routes/cartRoutes");
const orderRoutes = require("./routes/orderRoutes");
const commissionRoutes = require("./routes/commissionRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const userRoutes = require("./routes/userRoutes");
const adminRoutes = require("./routes/adminRoutes");

const app = express();
app.disable("x-powered-by");
// Behind a reverse proxy / load balancer (Render and most hosts) req.ip must be the client's
// address, not the proxy's, or the rate limits would lump every visitor together.
// TRUST_PROXY = number of proxy hops; defaults to 1 in production, off in development.
const trustProxy = process.env.TRUST_PROXY ?? (isProduction ? "1" : "");
if (trustProxy) app.set("trust proxy", Number(trustProxy) || trustProxy);
app.use(securityHeaders({ isProduction }));

// Only the app's own frontend may call the API from a browser: CLIENT_URL, plus the local
// dev frontend outside production (see config/env.js). Requests without an Origin header
// (curl, server-to-server, health checks) aren't affected by CORS.
app.use(cors({
  origin: (origin, cb) => cb(null, !origin || allowedOrigins.includes(origin)),
  allowedHeaders: ["Content-Type", "Authorization", "X-Viewer-Session"],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  maxAge: 600,
}));
app.use(express.json({ limit: "100kb" }));

// Photos on local disk (development storage, and older "/uploads/..." photos not yet moved
// to Cloudinary; see utils/imageStorage.js and scripts/migrate-images-to-cloudinary.js).
app.use("/uploads", express.static(UPLOAD_ROOT, {
  index: false,
  dotfiles: "deny",
  setHeaders: (res) => res.set("X-Content-Type-Options", "nosniff"),
}));

// Health check (Render's "Health Check Path": /health). 503 while the database is unreachable.
app.get(["/health", "/api/health"], (req, res) => {
  const db = mongoose.connection.readyState === 1;
  res.status(db ? 200 : 503).json({ ok: db, db: db ? "connected" : "disconnected" });
});
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/artisans", artisanRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/commissions", commissionRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);

app.use((req, res) => res.status(404).json({ error: "Not found" }));

// Client errors keep their message; anything unexpected gets a generic one so internals
// (stack traces, query/model details) never reach the client. Full details stay in the log.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Malformed JSON body" });
  if (err.type === "entity.too.large") return res.status(413).json({ error: "Request body is too large" });
  if (err.name === "CastError") return res.status(400).json({ error: "Invalid id or value in the request" });
  if (err.name === "ValidationError") {
    return res.status(400).json({ error: Object.values(err.errors || {}).map((e) => e.message).join(", ") || "Invalid data" });
  }
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 500 ? err.status : 500;
  if (status === 500) console.error(err);
  res.status(status).json({ error: status === 500 ? "Something went wrong. Please try again." : err.message });
});

// Render (and most hosts) set PORT; 5000 is the local default.
const PORT = Number(process.env.PORT) || 5000;

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`Artisan API listening on port ${PORT} (${isProduction ? "production" : "development"}; photo storage: ${STORAGE === "cloudinary" ? "Cloudinary" : "local disk, development only"}; allowed origins: ${allowedOrigins.join(", ")})`));
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err.message);
    process.exit(1);
  });

require("dotenv").config();
const express = require("express");
const cors = require("cors");
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

// Refuse to start with a missing or guessable JWT secret: anyone who knows it can sign
// tokens for any account. (The value itself is never printed.)
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error("JWT_SECRET must be set in server/.env and be at least 32 characters long.");
  process.exit(1);
}

const app = express();
app.disable("x-powered-by");
// Behind a reverse proxy / load balancer (most hosts), set TRUST_PROXY=1 so req.ip (used by
// the rate limits) is the client's address and not the proxy's.
if (process.env.TRUST_PROXY) app.set("trust proxy", Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
app.use(securityHeaders);

// Only the app's own frontend(s) may call the API from a browser. CORS_ORIGINS is a
// comma-separated list; defaults to the local dev frontend. Requests without an Origin
// header (curl, server-to-server) aren't affected by CORS.
const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:3000").split(",").map((o) => o.trim()).filter(Boolean);
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

app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/artisans", artisanRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/commissions", commissionRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/users", userRoutes);

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

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`Artisan API listening on port ${PORT} (photo storage: ${STORAGE === "cloudinary" ? "Cloudinary" : "local disk, development only"})`));
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err.message);
    process.exit(1);
  });

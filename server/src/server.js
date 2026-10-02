require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const { UPLOAD_ROOT } = require("./utils/imageStorage");

const authRoutes = require("./routes/authRoutes");
const productRoutes = require("./routes/productRoutes");
const artisanRoutes = require("./routes/artisanRoutes");
const cartRoutes = require("./routes/cartRoutes");
const orderRoutes = require("./routes/orderRoutes");
const commissionRoutes = require("./routes/commissionRoutes");

const app = express();
app.use(cors());
app.use(express.json());

// Uploaded product photos (local-disk storage; see utils/imageStorage.js).
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

app.use((req, res) => res.status(404).json({ error: "Not found" }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`Artisan API listening on port ${PORT}`));
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err.message);
    process.exit(1);
  });

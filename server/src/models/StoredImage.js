const mongoose = require("mongoose");

// One row per photo stored on Cloudinary: the https URL the app saves on products/users
// and the Cloudinary public_id needed to delete it. utils/imageStorage only deletes an
// asset that is listed here with the matching kind, so a URL from anywhere else is never
// touched. kind "static" = a seeded /images/... file copied up by the migration script:
// like before the move, those are never deleted automatically.
const storedImageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, unique: true },
    publicId: { type: String, required: true },
    kind: { type: String, enum: ["product", "avatar", "static"], required: true },
    // Migration only: the old local path ("/uploads/..." or "/images/..."), so a re-run
    // reuses the same upload instead of making a new one.
    source: { type: String, index: true, sparse: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("StoredImage", storedImageSchema);

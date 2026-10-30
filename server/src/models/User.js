const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["buyer", "artisan", "admin"], default: "buyer" },
    // Profile photo (Cloudinary https URL, "/uploads/avatars/..." on local dev storage, or ""
    // for none; see utils/imageStorage) and a short bio. Public only for artisans (populated
    // on their shop/profile/product pages); a buyer's are only ever returned to the buyer.
    avatarUrl: { type: String, default: "" },
    bio: { type: String, default: "", trim: true, maxlength: [300, "Bio must be 300 characters or fewer"] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);

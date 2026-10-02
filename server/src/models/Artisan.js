const mongoose = require("mongoose");

const artisanSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    bio: { type: String, default: "", trim: true, maxlength: [1000, "Bio must be 1000 characters or fewer"] },
    certified: { type: Boolean, default: false },
    specialty: { type: String, default: "" },
    shopName: { type: String, default: "", trim: true },
    // Stored without the leading "@"; used to build instagram.com/<handle> links.
    instagramHandle: {
      type: String,
      default: "",
      set: (v) => (v || "").trim().replace(/^@+/, ""),
      match: [/^[A-Za-z0-9._]{0,30}$/, "Invalid Instagram handle"],
    },
    // Free-text "how to order / contact" note, e.g. "DM @shop on Instagram to order".
    contactInfo: { type: String, default: "", trim: true, maxlength: [200, "Contact note must be 200 characters or fewer"] },

    // ── Public personal profile (all optional; the UI hides whatever is empty) ──
    // Absolute http(s) URL or a site path like /images/artisans/x.jpg.
    photoUrl: {
      type: String,
      default: "",
      trim: true,
      match: [/^$|^https?:\/\/\S+$|^\/\S*$/, "Photo URL must start with http(s):// or /"],
    },
    yearsExperience: {
      type: Number,
      default: null,
      min: [0, "Years of experience can't be negative"],
      max: [100, "Years of experience looks too high"],
      validate: { validator: (v) => v === null || Number.isInteger(v), message: "Years of experience must be a whole number" },
    },
    location: { type: String, default: "", trim: true, maxlength: [100, "Location must be 100 characters or fewer"] },
    // Deliberately no phone/email here: public contact is Instagram-only.
  },
  { timestamps: true }
);

module.exports = mongoose.model("Artisan", artisanSchema);

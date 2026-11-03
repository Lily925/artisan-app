const mongoose = require("mongoose");

const artisanSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    bio: { type: String, default: "", trim: true, maxlength: [1000, "Bio must be 1000 characters or fewer"] },
    certified: { type: Boolean, default: false },
    specialty: { type: String, default: "" },
    shopName: { type: String, default: "", trim: true },
    // URL-safe, unique (see utils/shops.uniqueSlug). Missing only on shops from before slugs
    // existed, until `npm run migrate:shops` fills it in.
    slug: { type: String, trim: true, lowercase: true, unique: true, sparse: true, match: [/^[a-z0-9]+(-[a-z0-9]+)*$/, "Invalid slug"] },
    // Approval (utils/shops). No default on purpose: a shop from before approval existed has
    // no status and counts as approved; every new shop is created with "pending".
    status: { type: String, enum: ["pending", "approved", "rejected", "suspended"] },
    // Admin's reason for a rejection / suspension, shown to the shop owner only.
    statusReason: { type: String, default: "", trim: true, maxlength: [300, "Reason must be 300 characters or fewer"], select: false },
    reviewedAt: { type: Date, select: false },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", select: false },
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
    // Deliberately no public phone/email: public contact is Instagram-only.

    // Visible reviews of this shop's products, kept up to date by utils/reviews.refreshRatings.
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },

    // PayPal email for milestone payouts. Private: hidden from every query unless selected
    // with "+payoutEmail" (only GET/PUT /api/artisans/me and the payout code do that).
    payoutEmail: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
      maxlength: [254, "Payout email is too long"],
      match: [/^$|^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid PayPal email for payouts"],
      select: false,
    },

    // Chat (owner only, see GET/PUT /api/artisans/me/chat-settings). Hidden from every other
    // query. The greeting goes out once, as the shop, when a buyer starts a conversation.
    savedReplies: { type: [{ type: String, trim: true, maxlength: 300 }], default: undefined, select: false },
    chatGreeting: { type: String, default: "", trim: true, maxlength: 300, select: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Artisan", artisanSchema);

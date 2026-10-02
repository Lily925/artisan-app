const mongoose = require("mongoose");

const bidSchema = new mongoose.Schema(
  {
    artisan: { type: mongoose.Schema.Types.ObjectId, ref: "Artisan", required: true },
    price: { type: Number, required: true },
    message: { type: String, default: "" },
    status: { type: String, enum: ["pending", "accepted", "rejected"], default: "pending" },
  },
  { timestamps: true }
);

const commissionSchema = new mongoose.Schema(
  {
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    category: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    budgetRange: { type: String, default: "" },
    timeline: { type: String, default: "" },
    referenceImage: { type: String, default: "" },
    status: { type: String, enum: ["open", "matched", "in_progress", "completed"], default: "open" },
    bids: { type: [bidSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Commission", commissionSchema);

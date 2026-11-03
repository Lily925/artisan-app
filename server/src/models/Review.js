const mongoose = require("mongoose");

// A buyer's review of one order item. Public responses are built by hand in
// controllers/reviewController: buyer and order ids never leave the server for other people.
const reviewSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    itemIndex: { type: Number, required: true, min: 0 },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    artisan: { type: mongoose.Schema.Types.ObjectId, ref: "Artisan", required: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    // What the public sees of the buyer: first name only, copied when the review is written.
    displayName: { type: String, default: "" },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: "", maxlength: 1000 },
    photos: { type: [String], default: [], validate: { validator: (v) => v.length <= 3, message: "A review can have at most 3 photos" } },
    editedAt: { type: Date, default: null },
    // The artisan's one public reply.
    reply: { type: new mongoose.Schema({ text: { type: String, required: true, maxlength: 1000 }, at: { type: Date, required: true } }, { _id: false }), default: undefined },
    // Admin moderation. Hidden reviews aren't public and don't count in the averages.
    hiddenAt: { type: Date, default: null },
    hiddenReason: { type: String, default: "", maxlength: 300 },
    hiddenBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    // Deleted by the buyer. The row stays, emptied, so the order item can't be reviewed again
    // (which would also restart the 14 days and notify the artisan a second time).
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

reviewSchema.index({ order: 1, itemIndex: 1 }, { unique: true }); // one review per order item
reviewSchema.index({ product: 1, createdAt: -1 });
reviewSchema.index({ artisan: 1 });

module.exports = mongoose.model("Review", reviewSchema);

const mongoose = require("mongoose");

const ratingSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    reviewerId: { type: String, required: true, maxlength: 64 },
    rating: { type: Number, required: true, min: 1, max: 5 }
  },
  { timestamps: true }
);

ratingSchema.index({ product: 1, reviewerId: 1 }, { unique: true });

module.exports = mongoose.model("Rating", ratingSchema);

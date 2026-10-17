const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 140 },
    description: { type: String, trim: true, maxlength: 2000, default: "" },
    price: { type: Number, required: true, min: 0 },
    regularPrice: { type: Number, min: 0, default: null },
    stock: { type: Number, required: true, min: 0, default: 0 },
    category: { type: String, required: true, trim: true, maxlength: 60 },
    imageUrl: { type: String, default: "" },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor" },
    ratingAverage: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

productSchema.index({ title: "text", description: "text", category: "text" });
productSchema.index({ category: 1, price: 1, createdAt: -1 });

module.exports = mongoose.model("Product", productSchema);

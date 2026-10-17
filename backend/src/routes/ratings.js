const express = require("express");
const mongoose = require("mongoose");
const Product = require("../models/Product");
const Rating = require("../models/Rating");

const router = express.Router();

router.post("/", async (req, res, next) => {
  try {
    const { productId, rating, reviewerId } = req.body || {};
    if (!mongoose.isValidObjectId(productId)) {
      return res.status(400).json({ message: "Product ID is invalid." });
    }
    const parsedRating = Number(rating);
    if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return res.status(400).json({ message: "Choose a rating from 1 to 5 stars." });
    }
    if (typeof reviewerId !== "string" || !/^[a-zA-Z0-9-]{16,64}$/.test(reviewerId)) {
      return res.status(400).json({ message: "Rating session is invalid. Refresh the page and try again." });
    }
    const product = await Product.findOne({ _id: productId, isActive: true }).select("_id");
    if (!product) return res.status(404).json({ message: "Product not found." });

    await Rating.findOneAndUpdate(
      { product: productId, reviewerId },
      { rating: parsedRating },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
    const [summary] = await Rating.aggregate([
      { $match: { product: product._id } },
      { $group: { _id: "$product", average: { $avg: "$rating" }, count: { $sum: 1 } } }
    ]);
    await Product.updateOne(
      { _id: product._id },
      { ratingAverage: summary?.average || 0, ratingCount: summary?.count || 0 }
    );
    return res.json({
      ratingAverage: Math.round((summary?.average || 0) * 10) / 10,
      ratingCount: summary?.count || 0
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

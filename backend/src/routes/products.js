const express = require("express");
const mongoose = require("mongoose");
const Product = require("../models/Product");
const { authenticate, requireRole } = require("../middleware/auth");
const upload = require("../middleware/upload");

const router = express.Router();
const categories = ["Produce", "Bakery", "Dairy & Eggs", "Meat & Seafood", "Pantry", "Beverages", "Household"];

router.get("/", async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(48, Math.max(1, Number.parseInt(req.query.limit, 10) || 12));
    const filter = { isActive: true };

    if (req.query.category && req.query.category !== "All") filter.category = String(req.query.category);
    if (req.query.search) {
      const search = String(req.query.search).trim().slice(0, 100);
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { title: { $regex: escaped, $options: "i" } },
        { description: { $regex: escaped, $options: "i" } },
        { category: { $regex: escaped, $options: "i" } }
      ];
    }
    const sortOptions = {
      newest: { createdAt: -1 },
      price_asc: { price: 1 },
      price_desc: { price: -1 },
      rating: { ratingAverage: -1, ratingCount: -1 }
    };
    const sort = sortOptions[req.query.sort] || sortOptions.newest;
    const [products, total] = await Promise.all([
      Product.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
      Product.countDocuments(filter)
    ]);
    return res.json({
      products,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/admin", authenticate, requireRole("admin"), async (_req, res, next) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 }).lean();
    return res.json({ products });
  } catch (error) {
    return next(error);
  }
});

router.post("/", authenticate, requireRole("admin"), upload, async (req, res, next) => {
  try {
    const { title, description, price, regularPrice, stock, category, imageUrl } = req.body || {};
    if (!String(title || "").trim() || !String(category || "").trim() || price === undefined || stock === undefined) {
      return res.status(400).json({ message: "Product name, category, price, and stock are required." });
    }
    const parsedPrice = Number(price);
    const parsedRegularPrice = regularPrice === undefined || regularPrice === "" ? null : Number(regularPrice);
    const parsedStock = Number(stock);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0 || !Number.isInteger(parsedStock) || parsedStock < 0) {
      return res.status(400).json({ message: "Price must be non-negative and stock must be a non-negative whole number." });
    }
    if (parsedRegularPrice !== null && (!Number.isFinite(parsedRegularPrice) || parsedRegularPrice <= parsedPrice)) {
      return res.status(400).json({ message: "Regular price must be greater than the sale price." });
    }
    if (!categories.includes(category)) {
      return res.status(400).json({ message: "Choose a valid product category." });
    }
    const product = await Product.create({
      title,
      description,
      price: parsedPrice,
      regularPrice: parsedRegularPrice,
      stock: parsedStock,
      category,
      imageUrl: req.file ? `/uploads/${req.file.filename}` : imageUrl || ""
    });
    return res.status(201).json({ product });
  } catch (error) {
    return next(error);
  }
});

router.patch("/:id", authenticate, requireRole("admin"), upload, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Product ID is invalid." });
    }
    const { title, description, price, regularPrice, stock, category, imageUrl, isActive } = req.body || {};
    const updates = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (price !== undefined) updates.price = Number(price);
    if (regularPrice !== undefined) updates.regularPrice = regularPrice === "" ? null : Number(regularPrice);
    if (stock !== undefined) updates.stock = Number(stock);
    if (category !== undefined) updates.category = category;
    if (imageUrl !== undefined) updates.imageUrl = imageUrl;
    if (typeof isActive === "boolean") updates.isActive = isActive;
    if (req.file) updates.imageUrl = `/uploads/${req.file.filename}`;
    if (updates.price !== undefined && (!Number.isFinite(updates.price) || updates.price < 0)) {
      return res.status(400).json({ message: "Price must be a non-negative number." });
    }
    if (updates.regularPrice !== undefined && updates.regularPrice !== null && (!Number.isFinite(updates.regularPrice) || updates.regularPrice < 0)) {
      return res.status(400).json({ message: "Regular price must be a non-negative number." });
    }
    if (updates.stock !== undefined && (!Number.isInteger(updates.stock) || updates.stock < 0)) {
      return res.status(400).json({ message: "Stock must be a non-negative whole number." });
    }
    if (updates.category !== undefined && !categories.includes(updates.category)) {
      return res.status(400).json({ message: "Choose a valid product category." });
    }
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found." });
    Object.assign(product, updates);
    const finalRegularPrice = product.regularPrice;
    if (finalRegularPrice !== null && finalRegularPrice !== undefined && finalRegularPrice <= product.price) {
      return res.status(400).json({ message: "Regular price must be greater than the sale price." });
    }
    await product.save();
    return res.json({ product });
  } catch (error) {
    return next(error);
  }
});

router.delete("/:id", authenticate, requireRole("admin"), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Product ID is invalid." });
    }
    const product = await Product.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!product) return res.status(404).json({ message: "Product not found." });
    return res.json({ product });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

const crypto = require("crypto");
const express = require("express");
const mongoose = require("mongoose");
const Order = require("../models/Order");
const Product = require("../models/Product");
const { authenticate, requireRole } = require("../middleware/auth");

const router = express.Router();
const orderStatuses = ["processing", "completed", "cancelled"];

router.post("/", async (req, res, next) => {
  const reserved = [];
  try {
    const { customerName, phone, deliveryAddress, items } = req.body || {};
    if (!String(customerName || "").trim() || !String(phone || "").trim() || !String(deliveryAddress || "").trim()) {
      return res.status(400).json({ message: "Your name, phone number, and delivery address are required." });
    }
    if (String(customerName).length > 100 || String(phone).length > 40 || String(deliveryAddress).length > 500) {
      return res.status(400).json({ message: "One or more customer details exceed the allowed length." });
    }
    if (!Array.isArray(items) || items.length < 1 || items.length > 30) {
      return res.status(400).json({ message: "Your basket must contain between 1 and 30 different products." });
    }

    const quantities = new Map();
    for (const item of items) {
      const productId = String(item?.productId || "");
      const quantity = Number(item?.quantity);
      if (!mongoose.isValidObjectId(productId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
        return res.status(400).json({ message: "Your basket contains an invalid product or quantity." });
      }
      quantities.set(productId, (quantities.get(productId) || 0) + quantity);
    }

    const products = await Product.find({ _id: { $in: [...quantities.keys()] }, isActive: true });
    if (products.length !== quantities.size) {
      return res.status(400).json({ message: "One or more products are no longer available. Refresh your basket and try again." });
    }

    const orderItems = [];
    for (const product of products) {
      const quantity = quantities.get(product._id.toString());
      const update = await Product.updateOne(
        { _id: product._id, isActive: true, stock: { $gte: quantity } },
        { $inc: { stock: -quantity } }
      );
      if (update.modifiedCount !== 1) {
        const conflict = new Error(`${product.title} does not have enough stock for this order.`);
        conflict.status = 409;
        throw conflict;
      }
      reserved.push({ id: product._id, quantity });
      orderItems.push({
        product: product._id,
        title: product.title,
        imageUrl: product.imageUrl,
        price: product.price,
        quantity
      });
    }

    const confirmationToken = crypto.randomBytes(32).toString("hex");
    const order = await Order.create({
      orderNumber: `SM-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
      customerName,
      phone,
      deliveryAddress,
      items: orderItems,
      total: orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
      confirmationTokenHash: crypto.createHash("sha256").update(confirmationToken).digest("hex")
    });
    return res.status(201).json({
      order: { id: order._id, orderNumber: order.orderNumber, total: order.total },
      confirmationToken
    });
  } catch (error) {
    if (reserved.length) {
      try {
        await Promise.all(reserved.map(({ id, quantity }) => Product.updateOne({ _id: id }, { $inc: { stock: quantity } })));
      } catch (rollbackError) {
        console.error("Failed to restore product stock after order creation error:", rollbackError);
        return next(rollbackError);
      }
    }
    if (error.status === 409) {
      return res.status(409).json({ message: error.message });
    }
    return next(error);
  }
});

router.post("/:id/confirm-payment", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Order ID is invalid." });
    }
    const token = String(req.body?.confirmationToken || "");
    if (!/^[a-f0-9]{64}$/i.test(token)) {
      return res.status(400).json({ message: "Payment confirmation details are invalid." });
    }
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, confirmationTokenHash: tokenHash, paymentStatus: "awaiting_confirmation" },
      { paymentStatus: "customer_reported" },
      { new: true }
    ).select("orderNumber paymentStatus");
    if (!order) {
      return res.status(404).json({ message: "Order could not be found or payment was already confirmed." });
    }
    return res.json({ order });
  } catch (error) {
    return next(error);
  }
});

router.get("/", authenticate, requireRole("admin"), async (req, res, next) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 }).limit(200).lean();
    return res.json({ orders });
  } catch (error) {
    return next(error);
  }
});

router.get("/history", authenticate, requireRole("admin"), async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
    const filter = {};
    if (req.query.search) {
      const search = String(req.query.search).trim().slice(0, 100);
      if (search) {
        const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        filter.$or = [
          { customerName: { $regex: escaped, $options: "i" } },
          { phone: { $regex: escaped, $options: "i" } },
          { orderNumber: { $regex: escaped, $options: "i" } }
        ];
      }
    }
    if (["new", ...orderStatuses].includes(req.query.status)) filter.status = req.query.status;
    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Order.countDocuments(filter)
    ]);
    return res.json({ orders, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    return next(error);
  }
});

router.get("/reports/monthly", authenticate, requireRole("admin"), async (req, res, next) => {
  try {
    const month = String(req.query.month || "");
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return res.status(400).json({ message: "Choose a report month in YYYY-MM format." });
    }
    const start = new Date(`${month}-01T00:00:00.000Z`);
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    const [summary] = await Order.aggregate([
      { $match: { createdAt: { $gte: start, $lt: end } } },
      {
        $group: {
          _id: null,
          orderCount: { $sum: 1 },
          salesTotal: { $sum: { $cond: [{ $ne: ["$status", "cancelled"] }, "$total", 0] } },
          cancelledCount: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } },
          completedCount: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
          paymentReportedCount: { $sum: { $cond: [{ $eq: ["$paymentStatus", "customer_reported"] }, 1, 0] } }
        }
      }
    ]);
    const topProducts = await Order.aggregate([
      { $match: { createdAt: { $gte: start, $lt: end }, status: { $ne: "cancelled" } } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.title",
          quantity: { $sum: "$items.quantity" },
          sales: { $sum: { $multiply: ["$items.price", "$items.quantity"] } }
        }
      },
      { $sort: { sales: -1 } },
      { $limit: 10 },
      { $project: { _id: 0, title: "$_id", quantity: 1, sales: 1 } }
    ]);
    return res.json({
      month,
      orderCount: summary?.orderCount || 0,
      salesTotal: summary?.salesTotal || 0,
      cancelledCount: summary?.cancelledCount || 0,
      completedCount: summary?.completedCount || 0,
      paymentReportedCount: summary?.paymentReportedCount || 0,
      topProducts
    });
  } catch (error) {
    return next(error);
  }
});

router.patch("/:id/status", authenticate, requireRole("admin"), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Order ID is invalid." });
    }
    const { status } = req.body || {};
    if (!orderStatuses.includes(status)) {
      return res.status(400).json({ message: "Choose processing, completed, or cancelled." });
    }
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, status: { $in: ["new", "processing"] } },
      { status },
      { new: true, runValidators: true }
    );
    if (!order) return res.status(404).json({ message: "Order not found." });
    if (status === "cancelled") {
      await Promise.all(order.items.map((item) =>
        Product.updateOne({ _id: item.product }, { $inc: { stock: item.quantity } })
      ));
    }
    return res.json({ order });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

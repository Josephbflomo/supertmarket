require("dotenv").config();

const cors = require("cors");
const express = require("express");
const path = require("path");
const connectDatabase = require("./src/config/database");
const authRoutes = require("./src/routes/auth");
const productRoutes = require("./src/routes/products");
const orderRoutes = require("./src/routes/orders");
const ratingRoutes = require("./src/routes/ratings");

const app = express();
const port = Number(process.env.PORT) || 5000;

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json({ limit: "1mb" }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/ratings", ratingRoutes);
app.get("/api/settings", (_req, res) => {
  res.json({ mobileMoneyNumber: process.env.MOBILE_MONEY_NUMBER || "" });
});

app.use((err, _req, res, _next) => {
  if (err.message === "Upload a JPG, PNG, or WebP image.") {
    return res.status(400).json({ message: err.message });
  }
  if (err.name === "ValidationError") {
    return res.status(400).json({ message: err.message });
  }
  if (err.code === 11000) {
    return res.status(409).json({ message: "That email address is already registered." });
  }
  if (err.name === "MulterError") {
    return res.status(400).json({ message: err.message });
  }
  console.error(err);
  return res.status(500).json({ message: "An unexpected server error occurred." });
});

async function start() {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET must be set before starting the API.");
  }
  await connectDatabase();
  app.listen(port, () => console.log(`Supertmarket API listening on port ${port}`));
}

if (require.main === module) {
  start().catch((error) => {
    console.error("Unable to start the API:", error);
    process.exitCode = 1;
  });
}

module.exports = app;

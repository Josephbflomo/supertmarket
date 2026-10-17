const crypto = require("crypto");
const fs = require("fs");
const multer = require("multer");
const path = require("path");

const uploadDirectory = path.join(__dirname, "..", "..", "uploads");
fs.mkdirSync(uploadDirectory, { recursive: true });

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const extensions = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadDirectory),
  filename: (_req, file, callback) => {
    callback(null, `${crypto.randomUUID()}${extensions[file.mimetype]}`);
  }
});

module.exports = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!allowedTypes.has(file.mimetype)) {
      return callback(new Error("Upload a JPG, PNG, or WebP image."));
    }
    return callback(null, true);
  }
}).single("image");

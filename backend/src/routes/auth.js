const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { authenticate, requireRole } = require("../middleware/auth");

const router = express.Router();

function createToken(user) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET must be configured.");
  }
  return jwt.sign({ sub: user._id.toString(), role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d"
  });
}

function userResponse(user) {
  return { id: user._id, name: user.name, email: user.email, role: user.role };
}

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }
    const user = await User.findOne({ email: String(email).toLowerCase().trim() }).select("+password");
    if (!user || user.role !== "admin" || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: "Email or password is incorrect." });
    }
    return res.json({ token: createToken(user), user: userResponse(user) });
  } catch (error) {
    return next(error);
  }
});

router.get("/me", authenticate, (req, res) => {
  return res.json({ user: userResponse(req.user) });
});

router.patch("/password", authenticate, requireRole("admin"), async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
      return res.status(400).json({ message: "Enter your current password and a new password." });
    }
    if (newPassword.length < 12) {
      return res.status(400).json({ message: "Your new password must be at least 12 characters." });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ message: "Choose a new password different from your current one." });
    }
    const user = await User.findById(req.user._id).select("+password");
    if (!user || !(await user.comparePassword(currentPassword))) {
      return res.status(401).json({ message: "Your current password is incorrect." });
    }
    user.password = newPassword;
    await user.save();
    return res.json({ message: "Admin password updated successfully." });
  } catch (error) {
    return next(error);
  }
});

router.patch("/email", authenticate, requireRole("admin"), async (req, res, next) => {
  try {
    const { currentPassword, newEmail } = req.body || {};
    if (typeof currentPassword !== "string" || typeof newEmail !== "string") {
      return res.status(400).json({ message: "Enter your current password and a new email address." });
    }
    const normalizedEmail = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ message: "Enter a valid email address." });
    }
    if (normalizedEmail === req.user.email) {
      return res.status(400).json({ message: "Your new email must be different from your current email." });
    }
    const user = await User.findById(req.user._id).select("+password");
    if (!user || !(await user.comparePassword(currentPassword))) {
      return res.status(401).json({ message: "Your current password is incorrect." });
    }
    const emailInUse = await User.exists({ email: normalizedEmail, _id: { $ne: user._id } });
    if (emailInUse) {
      return res.status(409).json({ message: "That email address is already in use." });
    }
    user.email = normalizedEmail;
    try {
      await user.save();
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({ message: "That email address is already in use." });
      }
      throw error;
    }
    return res.json({ message: "Admin login email updated successfully.", user: userResponse(user) });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

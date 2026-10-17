require("dotenv").config();

const mongoose = require("mongoose");
const User = require("../src/models/User");

async function createAdmin() {
  const { MONGODB_URI, ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error("Set ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD in backend/.env.");
  }
  if (ADMIN_PASSWORD.length < 12) {
    throw new Error("ADMIN_PASSWORD must be at least 12 characters.");
  }

  const databaseUri = MONGODB_URI || `mongodb://127.0.0.1:${Number(process.env.MONGODB_MEMORY_PORT) || 27017}/supertmarket`;
  await mongoose.connect(databaseUri);
  const existing = await User.findOne({ email: ADMIN_EMAIL.toLowerCase().trim() });
  if (existing) {
    throw new Error("An account already exists with ADMIN_EMAIL; no changes were made.");
  }
  await User.create({ name: ADMIN_NAME, email: ADMIN_EMAIL, password: ADMIN_PASSWORD, role: "admin" });
  console.log(`Administrator account created for ${ADMIN_EMAIL}.`);
}

createAdmin()
  .catch((error) => {
    console.error("Unable to create administrator:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState) {
      await mongoose.disconnect();
    }
  });

const fs = require("fs");
const mongoose = require("mongoose");
const path = require("path");
const { MongoMemoryServer } = require("mongodb-memory-server");

async function connectDatabase() {
  const localDataPath = path.join(__dirname, "..", "..", "data");
  if (!process.env.MONGODB_URI) {
    fs.mkdirSync(localDataPath, { recursive: true });
  }
  const uri = process.env.MONGODB_URI || (await MongoMemoryServer.create({
    instance: {
      port: Number(process.env.MONGODB_MEMORY_PORT) || 27017,
      dbName: "supertmarket",
      dbPath: localDataPath,
      storageEngine: "wiredTiger"
    }
  })).getUri();
  await mongoose.connect(uri, process.env.MONGODB_URI ? {} : { dbName: "supertmarket" });
  console.log("Connected to MongoDB.");
}

module.exports = connectDatabase;

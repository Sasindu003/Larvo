const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongoose").mongo;
require("ts-node/register");
const { decryptField } = require("../src/utils/fieldCrypto");

const LOCAL_URI = process.env.LOCAL_MONGO_URI || process.env.MONGO_URI;
if (!LOCAL_URI) {
  console.error("Error: LOCAL_MONGO_URI or MONGO_URI environment variable is required.");
  process.exit(1);
}
const OUTPUT_FILE = path.resolve(__dirname, "../.local/local-data.json");

/**
 * Decrypts sensitive personal data fields so the local offline development backup is readable.
 */
function decryptCollectionDocs(colName, docs) {
  if (!Array.isArray(docs)) return docs;

  for (const doc of docs) {
    if (!doc || typeof doc !== "object") continue;

    if (colName === "users" && Array.isArray(doc.addresses)) {
      for (const addr of doc.addresses) {
        if (addr.line1) addr.line1 = decryptField(addr.line1, "User.addresses.line1");
        if (addr.line2) addr.line2 = decryptField(addr.line2, "User.addresses.line2");
        if (addr.phone) addr.phone = decryptField(addr.phone, "User.addresses.phone");
      }
    } else if (colName === "orders" && doc.shippingAddress) {
      if (doc.shippingAddress.line1) {
        doc.shippingAddress.line1 = decryptField(
          doc.shippingAddress.line1,
          "Order.shippingAddress.line1",
        );
      }
      if (doc.shippingAddress.line2) {
        doc.shippingAddress.line2 = decryptField(
          doc.shippingAddress.line2,
          "Order.shippingAddress.line2",
        );
      }
    } else if (colName === "invoices" && doc.snapshot && doc.snapshot.shippingAddress) {
      if (doc.snapshot.shippingAddress.line1) {
        doc.snapshot.shippingAddress.line1 = decryptField(
          doc.snapshot.shippingAddress.line1,
          "Invoice.snapshot.shippingAddress.line1",
        );
      }
      if (doc.snapshot.shippingAddress.line2) {
        doc.snapshot.shippingAddress.line2 = decryptField(
          doc.snapshot.shippingAddress.line2,
          "Invoice.snapshot.shippingAddress.line2",
        );
      }
    } else if (colName === "suppliers") {
      if (doc.phone) doc.phone = decryptField(doc.phone, "Supplier.phone");
      if (doc.address) doc.address = decryptField(doc.address, "Supplier.address");
    } else if (colName === "returnrequests") {
      if (doc.pickup && doc.pickup.address) {
        doc.pickup.address = decryptField(doc.pickup.address, "ReturnRequest.pickup.address");
      }
      if (doc.address) {
        doc.address = decryptField(doc.address, "ReturnRequest.address");
      }
    }
  }

  return docs;
}

async function exportToJson() {
  console.log("Connecting to Local MongoDB...");
  const client = new MongoClient(LOCAL_URI);
  await client.connect();
  const db = client.db();
  console.log(`Connected to: ${db.databaseName}`);

  const collections = await db.listCollections().toArray();
  const filteredCollections = collections
    .map((c) => c.name)
    .filter((name) => !name.startsWith("system."));

  const exportData = {};
  const stats = [];

  for (const colName of filteredCollections) {
    const docs = await db.collection(colName).find({}).toArray();
    exportData[colName] = decryptCollectionDocs(colName, docs);
    stats.push({ collection: colName, count: docs.length });
  }

  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const jsonContent = JSON.stringify(exportData, null, 2);
  fs.writeFileSync(OUTPUT_FILE, jsonContent, "utf-8");

  console.log("\n================ EXPORT SUMMARY ================");
  console.table(stats);
  const sizeMb = (fs.statSync(OUTPUT_FILE).size / 1024 / 1024).toFixed(2);
  console.log(`Saved to: ${OUTPUT_FILE} (${sizeMb} MB)`);
  console.log("\n================ SECURITY NOTICE ================");
  console.log(
    "NOTICE: The file at .local/local-data.json contains sensitive personal data in plaintext",
  );
  console.log(
    "for local development only. This file is gitignored and MUST NEVER be committed or shared.",
  );
  console.log("=================================================\n");

  await client.close();
}

exportToJson().catch((err) => {
  console.error("Export failed:", err);
  process.exit(1);
});

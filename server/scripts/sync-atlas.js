const fs = require('fs');
const path = require('path');
const dns = require('dns');
// Set public DNS servers to prevent Windows querySrv ECONNREFUSED issues on mongodb+srv
dns.setServers(['8.8.8.8', '1.1.1.1']);

const { MongoClient, ObjectId } = require('mongoose').mongo;
require('ts-node/register');
const { encryptField, isEncrypted } = require('../src/utils/fieldCrypto');

const ATLAS_URI = process.env.ATLAS_MONGO_URI || 'mongodb+srv://CHANGE_ME_username:CHANGE_ME_password@CHANGE_ME_cluster.mongodb.net/shop?retryWrites=true&w=majority';
const INPUT_FILE = path.resolve(__dirname, '../.local/local-data.json');

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

// Recursively convert strings back to native BSON types (ObjectId and Date)
function restoreBsonTypes(value, key = '') {
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    return value.map(item => restoreBsonTypes(item, key));
  }

  if (typeof value === 'object') {
    const res = {};
    for (const [k, v] of Object.entries(value)) {
      res[k] = restoreBsonTypes(v, k);
    }
    return res;
  }

  if (typeof value === 'string') {
    if (ISO_DATE_REGEX.test(value)) {
      return new Date(value);
    }
    if (
      (key === '_id' || key.endsWith('Id') || ['category', 'user', 'order', 'wallet', 'supplier', 'department', 'invoice'].includes(key)) &&
      OBJECT_ID_REGEX.test(value)
    ) {
      return new ObjectId(value);
    }
  }

  return value;
}

/**
 * Re-encrypts sensitive personal data fields prior to inserting into Atlas.
 */
function encryptCollectionDocs(colName, docs) {
  if (!Array.isArray(docs)) return docs;

  for (const doc of docs) {
    if (!doc || typeof doc !== 'object') continue;

    if (colName === 'users' && Array.isArray(doc.addresses)) {
      for (const addr of doc.addresses) {
        if (addr.line1 && !isEncrypted(addr.line1)) addr.line1 = encryptField(addr.line1, 'User.addresses.line1');
        if (addr.line2 && !isEncrypted(addr.line2)) addr.line2 = encryptField(addr.line2, 'User.addresses.line2');
        if (addr.phone && !isEncrypted(addr.phone)) addr.phone = encryptField(addr.phone, 'User.addresses.phone');
      }
    } else if (colName === 'orders' && doc.shippingAddress) {
      if (doc.shippingAddress.line1 && !isEncrypted(doc.shippingAddress.line1)) {
        doc.shippingAddress.line1 = encryptField(doc.shippingAddress.line1, 'Order.shippingAddress.line1');
      }
      if (doc.shippingAddress.line2 && !isEncrypted(doc.shippingAddress.line2)) {
        doc.shippingAddress.line2 = encryptField(doc.shippingAddress.line2, 'Order.shippingAddress.line2');
      }
    } else if (colName === 'invoices' && doc.snapshot && doc.snapshot.shippingAddress) {
      if (doc.snapshot.shippingAddress.line1 && !isEncrypted(doc.snapshot.shippingAddress.line1)) {
        doc.snapshot.shippingAddress.line1 = encryptField(
          doc.snapshot.shippingAddress.line1,
          'Invoice.snapshot.shippingAddress.line1'
        );
      }
      if (doc.snapshot.shippingAddress.line2 && !isEncrypted(doc.snapshot.shippingAddress.line2)) {
        doc.snapshot.shippingAddress.line2 = encryptField(
          doc.snapshot.shippingAddress.line2,
          'Invoice.snapshot.shippingAddress.line2'
        );
      }
    } else if (colName === 'suppliers') {
      if (doc.phone && !isEncrypted(doc.phone)) doc.phone = encryptField(doc.phone, 'Supplier.phone');
      if (doc.address && !isEncrypted(doc.address)) doc.address = encryptField(doc.address, 'Supplier.address');
    } else if (colName === 'returnrequests') {
      if (doc.pickup && doc.pickup.address && !isEncrypted(doc.pickup.address)) {
        doc.pickup.address = encryptField(doc.pickup.address, 'ReturnRequest.pickup.address');
      }
      if (doc.address && !isEncrypted(doc.address)) {
        doc.address = encryptField(doc.address, 'ReturnRequest.address');
      }
    }
  }

  return docs;
}

async function migrate() {
  if (!fs.existsSync(INPUT_FILE)) {
    throw new Error(`Data file not found at: ${INPUT_FILE}. Run 'npm run export:local' first to generate it locally, or see README.md.`);
  }

  console.log(`Reading data from: ${INPUT_FILE}`);
  const rawData = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));

  console.log('Connecting to MongoDB Atlas...');
  const atlasClient = new MongoClient(ATLAS_URI);
  await atlasClient.connect();
  const atlasDb = atlasClient.db();
  console.log(`Connected to Atlas DB: ${atlasDb.databaseName}`);

  // Step 1: Drop all existing collections in Atlas
  console.log(`\nClearing existing collections in Atlas database "${atlasDb.databaseName}"...`);
  const existingAtlasCollections = await atlasDb.listCollections().toArray();
  for (const col of existingAtlasCollections) {
    if (!col.name.startsWith('system.')) {
      try {
        await atlasDb.collection(col.name).drop();
        console.log(`- Dropped collection: ${col.name}`);
      } catch (err) {
        console.warn(`- Failed to drop ${col.name}, deleting documents: ${err.message}`);
        await atlasDb.collection(col.name).deleteMany({});
      }
    }
  }
  console.log('Existing Atlas collections cleared successfully.');

  // Step 2: Migrate collections from local JSON export
  const collectionNames = Object.keys(rawData).filter(name => !name.startsWith('system.'));
  console.log(`\nFound ${collectionNames.length} collections to migrate: ${collectionNames.join(', ')}\n`);

  const summary = [];

  for (const colName of collectionNames) {
    console.log(`Migrating collection: ${colName}...`);
    const docs = rawData[colName] || [];
    const atlasCol = atlasDb.collection(colName);

    if (docs.length > 0) {
      const encryptedDocs = encryptCollectionDocs(colName, docs);
      const parsedDocs = encryptedDocs.map(d => restoreBsonTypes(d));
      await atlasCol.insertMany(parsedDocs, { ordered: true });
    }

    const atlasCount = await atlasCol.countDocuments();
    summary.push({
      collection: colName,
      exportedCount: docs.length,
      atlasCount: atlasCount,
      status: docs.length === atlasCount ? 'OK' : 'MISMATCH',
    });
  }

  console.log('\n================ MIGRATION SUMMARY ================');
  console.table(summary);

  await atlasClient.close();
  console.log('\nMigration completed successfully.');
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});

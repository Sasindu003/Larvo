const fs = require('fs');
const path = require('path');
const { MongoClient, ObjectId } = require('mongoose').mongo;

// Default target: shop_new or passed via CLI argument / environment variable
const TARGET_URI = process.argv[2] || process.env.TARGET_MONGO_URI || 'mongodb://localhost:27017/shop_new';
const INPUT_FILE = path.resolve(__dirname, '../../local-data.json');

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

async function importFromJson() {
  if (!fs.existsSync(INPUT_FILE)) {
    throw new Error(`Data file not found at: ${INPUT_FILE}`);
  }

  console.log(`Reading data from: ${INPUT_FILE}`);
  const rawData = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));

  console.log(`Connecting to Target DB: ${TARGET_URI}`);
  const client = new MongoClient(TARGET_URI);
  await client.connect();
  const db = client.db();
  console.log(`Connected to: ${db.databaseName}`);

  const summary = [];

  for (const [colName, docs] of Object.entries(rawData)) {
    const col = db.collection(colName);
    await col.deleteMany({}); // clear existing in target collection

    if (docs.length > 0) {
      const parsedDocs = docs.map(d => restoreBsonTypes(d));
      await col.insertMany(parsedDocs, { ordered: true });
    }

    const count = await col.countDocuments();
    summary.push({
      collection: colName,
      imported: count,
      status: count === docs.length ? 'OK' : 'MISMATCH',
    });
  }

  console.log('\n================ IMPORT SUMMARY ================');
  console.table(summary);

  await client.close();
  console.log('\nImport completed successfully.');
}

importFromJson().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});

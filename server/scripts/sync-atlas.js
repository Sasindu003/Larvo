const fs = require('fs');
const path = require('path');
const dns = require('dns');
// Set public DNS servers to prevent Windows querySrv ECONNREFUSED issues on mongodb+srv
dns.setServers(['8.8.8.8', '1.1.1.1']);

const { MongoClient, ObjectId } = require('mongoose').mongo;

const ATLAS_URI = process.env.ATLAS_MONGO_URI || 'mongodb+srv://Vercel-Admin-Larvo_Atlas:b9IrzLjehE2ECZfw@larvo-atlas.ykppr9b.mongodb.net/shop?retryWrites=true&w=majority';
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
      const parsedDocs = docs.map(d => restoreBsonTypes(d));
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

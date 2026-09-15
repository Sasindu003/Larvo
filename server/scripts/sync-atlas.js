const dns = require('dns');
// Set public DNS servers to prevent Windows querySrv ECONNREFUSED issues on mongodb+srv
dns.setServers(['8.8.8.8', '1.1.1.1']);

const { MongoClient } = require('mongoose').mongo;

const LOCAL_URI = process.env.LOCAL_MONGO_URI || 'mongodb://localhost:27017/shop';
const ATLAS_URI = process.env.ATLAS_MONGO_URI || 'mongodb+srv://Vercel-Admin-Larvo_Atlas:b9IrzLjehE2ECZfw@larvo-atlas.ykppr9b.mongodb.net/shop?retryWrites=true&w=majority';

async function migrate() {
  console.log('Connecting to Local MongoDB...');
  const localClient = new MongoClient(LOCAL_URI);
  await localClient.connect();
  const localDb = localClient.db();
  console.log(`Connected to Local DB: ${localDb.databaseName}`);

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

  // Step 2: Get all local collections
  const localCollections = await localDb.listCollections().toArray();
  const filteredCollections = localCollections
    .map(c => c.name)
    .filter(name => !name.startsWith('system.'));

  console.log(`\nFound ${filteredCollections.length} collections to migrate: ${filteredCollections.join(', ')}\n`);

  const summary = [];

  for (const colName of filteredCollections) {
    console.log(`Migrating collection: ${colName}...`);
    const localCol = localDb.collection(colName);
    const atlasCol = atlasDb.collection(colName);

    // Fetch documents
    const docs = await localCol.find({}).toArray();

    if (docs.length > 0) {
      await atlasCol.insertMany(docs, { ordered: true });
    }

    // Recreate indexes
    const indexes = await localCol.indexes();
    const customIndexes = indexes
      .filter(idx => idx.name !== '_id_')
      .map(idx => {
        const { v, ns, ...rest } = idx;
        return rest;
      });

    if (customIndexes.length > 0) {
      try {
        await atlasCol.createIndexes(customIndexes);
      } catch (idxErr) {
        console.warn(`Warning: failed to batch create indexes for ${colName}, attempting individually: ${idxErr.message}`);
        for (const singleIdx of customIndexes) {
          try {
            await atlasCol.createIndex(singleIdx.key, singleIdx);
          } catch (singleErr) {
            console.warn(`  Could not create index ${singleIdx.name}: ${singleErr.message}`);
          }
        }
      }
    }

    const atlasCount = await atlasCol.countDocuments();
    summary.push({
      collection: colName,
      localCount: docs.length,
      atlasCount: atlasCount,
      indexes: customIndexes.length,
      status: docs.length === atlasCount ? 'OK' : 'MISMATCH',
    });
  }

  console.log('\n================ MIGRATION SUMMARY ================');
  console.table(summary);

  await localClient.close();
  await atlasClient.close();
  console.log('\nMigration completed successfully.');
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});

const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongoose').mongo;

const LOCAL_URI = process.env.LOCAL_MONGO_URI || 'mongodb://localhost:27017/shop';
const OUTPUT_FILE = path.resolve(__dirname, '../../local-data.json');

async function exportToJson() {
  console.log('Connecting to Local MongoDB...');
  const client = new MongoClient(LOCAL_URI);
  await client.connect();
  const db = client.db();
  console.log(`Connected to: ${db.databaseName}`);

  const collections = await db.listCollections().toArray();
  const filteredCollections = collections
    .map(c => c.name)
    .filter(name => !name.startsWith('system.'));

  const exportData = {};
  const stats = [];

  for (const colName of filteredCollections) {
    const docs = await db.collection(colName).find({}).toArray();
    exportData[colName] = docs;
    stats.push({ collection: colName, count: docs.length });
  }

  const jsonContent = JSON.stringify(exportData, null, 2);
  fs.writeFileSync(OUTPUT_FILE, jsonContent, 'utf-8');

  console.log('\n================ EXPORT SUMMARY ================');
  console.table(stats);
  const sizeMb = (fs.statSync(OUTPUT_FILE).size / 1024 / 1024).toFixed(2);
  console.log(`Saved to: ${OUTPUT_FILE} (${sizeMb} MB)`);

  await client.close();
}

exportToJson().catch(err => {
  console.error('Export failed:', err);
  process.exit(1);
});

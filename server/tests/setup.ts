import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';

// 1. Set environment variables BEFORE any application module or model is loaded
process.env.NODE_ENV = 'test';
process.env.PORT = '5001';
process.env.JWT_SECRET = 'a_very_secret_key_for_testing_purposes_only_32_chars';
process.env.JWT_EXPIRES_IN = '7d';
process.env.COOKIE_SAMESITE = 'lax';
process.env.LOG_LEVEL = 'fatal';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';

// Import models so schemas and indexes are registered with Mongoose
import '../src/models/Product';
import '../src/models/User';
import '../src/models/Order';
import '../src/models/Category';
import '../src/models/Coupon';
import '../src/models/Wallet';
import '../src/models/PointsTransaction';
import '../src/models/AuditLog';

let mongod: MongoMemoryReplSet;

beforeAll(async () => {
  mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = mongod.getUri();
  process.env.MONGO_URI = uri;

  await mongoose.connect(uri);

  // Increase transaction lock timeout from 5ms to 5000ms to avoid Windows scheduling jitter
  try {
    await mongoose.connection.db?.admin().command({
      setParameter: 1,
      maxTransactionLockRequestTimeoutMillis: 5000,
    });
  } catch {
    // Ignore if not supported
  }

  // Ensure all index builds complete before any multi-document transaction runs
  await Promise.all(
    Object.values(mongoose.models).map((model) => model.init().catch(() => {}))
  );
});

afterEach(async () => {
  if (mongoose.connection.readyState === 1) {
    const collections = mongoose.connection.collections;
    for (const key of Object.keys(collections)) {
      await collections[key].deleteMany({});
    }
  }
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongod) {
    await mongod.stop();
  }
});

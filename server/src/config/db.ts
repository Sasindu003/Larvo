import mongoose from 'mongoose';
import dns from 'dns';

// Only use custom DNS fallback in local development on Windows machines with SRV lookup bugs.
// NEVER override DNS in production on Vercel/AWS Lambda as it breaks internal VPC DNS resolution.
if (process.env.NODE_ENV !== 'production') {
  try {
    if (process.platform === 'win32') {
      dns.setServers(['8.8.8.8', '1.1.1.1']);
    }
  } catch {}
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongooseCache || { conn: null, promise: null };
if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

export const connectDB = async (): Promise<typeof mongoose> => {
  let mongoUri = (process.env.MONGO_URI || process.env.MONGODB_URI || '').trim();

  // Strip accidental surrounding quotes if copied with quotes into Vercel env settings
  if (
    (mongoUri.startsWith('"') && mongoUri.endsWith('"')) ||
    (mongoUri.startsWith("'") && mongoUri.endsWith("'"))
  ) {
    mongoUri = mongoUri.slice(1, -1).trim();
  }

  if (!mongoUri) {
    throw new Error('Neither MONGO_URI nor MONGODB_URI is defined in environment variables');
  }

  if (cached.conn && cached.conn.connection.readyState === 1) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts: mongoose.ConnectOptions = {
      dbName: 'shop',
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 45000,
    };

    cached.promise = mongoose.connect(mongoUri, opts).then((mongooseInstance) => {
      console.log(`MongoDB Connected: ${mongooseInstance.connection.host} (DB: ${mongooseInstance.connection.name})`);
      return mongooseInstance;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    cached.promise = null;
    console.error(`MongoDB Connection Error: ${(error as Error).message}`);
    throw error;
  }

  return cached.conn;
};

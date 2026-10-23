import dns from 'dns';
import mongoose from 'mongoose';
import { env } from '../config/env';
import { encryptField, decryptField, isEncrypted } from '../utils/fieldCrypto';

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
  // Ignore DNS errors if restricted
}

export interface CollectionMigrationStats {
  collection: string;
  scanned: number;
  wouldEncrypt: number;
  alreadyEncrypted: number;
  encrypted: number;
  wouldDecrypt: number;
  alreadyPlaintext: number;
  decrypted: number;
}

export interface MigrationOptions {
  apply?: boolean;
  rollback?: boolean;
  rollbackConfirmed?: boolean;
}

const BATCH_SIZE = 200;

/**
 * Migration: Encrypt Personal Data Fields (AES-256-GCM)
 *
 * Encrypts personal-data fields directly in raw MongoDB collections using bulkWrite:
 * - users: addresses[].line1, line2, phone
 * - orders: shippingAddress.line1, line2
 * - invoices: snapshot.shippingAddress.line1, line2
 * - suppliers: phone, address
 * - returnrequests: pickup.address, address
 *
 * Guaranteed safe:
 * - Dry-run by default; requires --apply to mutate data.
 * - Idempotent: Skips already-encrypted values.
 * - Integrity-verified: Verifies test decryption before queueing write.
 * - Rollback protected: Requires --i-know-this-writes-plaintext flag.
 */
export async function migrateEncryptPersonalFields(
  options: MigrationOptions = {}
): Promise<Record<string, CollectionMigrationStats>> {
  const isApply = Boolean(options.apply);
  const isRollback = Boolean(options.rollback);
  const rollbackConfirmed = Boolean(options.rollbackConfirmed);

  if (isRollback && !rollbackConfirmed) {
    throw new Error(
      'Rollback safety guard: --rollback requires --i-know-this-writes-plaintext confirmation.'
    );
  }

  const modeStr = isRollback
    ? isApply
      ? 'ROLLBACK (APPLY)'
      : 'ROLLBACK (DRY-RUN)'
    : isApply
    ? 'ENCRYPT (APPLY)'
    : 'ENCRYPT (DRY-RUN)';

  console.log('===============================================================');
  console.log(`Running Migration: 2026_encrypt_personal_fields [${modeStr}]`);
  console.log('===============================================================');

  const mongoUri = env.MONGO_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/shop';
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.');
  }

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database connection failed');
  }

  const statsSummary: Record<string, CollectionMigrationStats> = {};

  // 1. Migrate Users
  statsSummary.users = await migrateUsersCollection(db, isApply, isRollback);

  // 2. Migrate Orders
  statsSummary.orders = await migrateOrdersCollection(db, isApply, isRollback);

  // 3. Migrate Invoices
  statsSummary.invoices = await migrateInvoicesCollection(db, isApply, isRollback);

  // 4. Migrate Suppliers
  statsSummary.suppliers = await migrateSuppliersCollection(db, isApply, isRollback);

  // 5. Migrate Return Requests
  statsSummary.returnrequests = await migrateReturnRequestsCollection(db, isApply, isRollback);

  console.log('\n================== MIGRATION SUMMARY ==================');
  console.table(
    Object.values(statsSummary).map((s) => ({
      Collection: s.collection,
      Scanned: s.scanned,
      [isRollback ? 'Would Decrypt' : 'Would Encrypt']: isRollback ? s.wouldDecrypt : s.wouldEncrypt,
      [isRollback ? 'Already Plaintext' : 'Already Encrypted']: isRollback
        ? s.alreadyPlaintext
        : s.alreadyEncrypted,
      Applied: isRollback ? s.decrypted : s.encrypted,
    }))
  );
  console.log('=======================================================\n');

  return statsSummary;
}

async function migrateUsersCollection(
  db: mongoose.mongo.Db,
  isApply: boolean,
  isRollback: boolean
): Promise<CollectionMigrationStats> {
  const collection = db.collection('users');
  const stats: CollectionMigrationStats = {
    collection: 'users',
    scanned: 0,
    wouldEncrypt: 0,
    alreadyEncrypted: 0,
    encrypted: 0,
    wouldDecrypt: 0,
    alreadyPlaintext: 0,
    decrypted: 0,
  };

  const cursor = collection.find({ addresses: { $exists: true, $ne: [] } });

  let batchOps: any[] = [];

  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    if (!doc) break;
    stats.scanned++;

    let docModified = false;
    const addresses = Array.isArray(doc.addresses) ? doc.addresses : [];
    const updatedAddresses = [];

    for (const addr of addresses) {
      const copy = { ...addr };

      if (!isRollback) {
        // Encrypt mode
        if (copy.line1) {
          if (isEncrypted(copy.line1)) {
            stats.alreadyEncrypted++;
          } else {
            stats.wouldEncrypt++;
            const enc = encryptField(copy.line1, 'User.addresses.line1');
            if (decryptField(enc, 'User.addresses.line1') !== copy.line1) {
              throw new Error(`Self-test decryption failure for user ${doc._id} line1`);
            }
            copy.line1 = enc;
            docModified = true;
          }
        }
        if (copy.line2) {
          if (isEncrypted(copy.line2)) {
            stats.alreadyEncrypted++;
          } else {
            stats.wouldEncrypt++;
            const enc = encryptField(copy.line2, 'User.addresses.line2');
            if (decryptField(enc, 'User.addresses.line2') !== copy.line2) {
              throw new Error(`Self-test decryption failure for user ${doc._id} line2`);
            }
            copy.line2 = enc;
            docModified = true;
          }
        }
        if (copy.phone) {
          if (isEncrypted(copy.phone)) {
            stats.alreadyEncrypted++;
          } else {
            stats.wouldEncrypt++;
            const enc = encryptField(copy.phone, 'User.addresses.phone');
            if (decryptField(enc, 'User.addresses.phone') !== copy.phone) {
              throw new Error(`Self-test decryption failure for user ${doc._id} phone`);
            }
            copy.phone = enc;
            docModified = true;
          }
        }
      } else {
        // Rollback mode
        if (copy.line1) {
          if (isEncrypted(copy.line1)) {
            stats.wouldDecrypt++;
            copy.line1 = decryptField(copy.line1, 'User.addresses.line1');
            docModified = true;
          } else {
            stats.alreadyPlaintext++;
          }
        }
        if (copy.line2) {
          if (isEncrypted(copy.line2)) {
            stats.wouldDecrypt++;
            copy.line2 = decryptField(copy.line2, 'User.addresses.line2');
            docModified = true;
          } else {
            stats.alreadyPlaintext++;
          }
        }
        if (copy.phone) {
          if (isEncrypted(copy.phone)) {
            stats.wouldDecrypt++;
            copy.phone = decryptField(copy.phone, 'User.addresses.phone');
            docModified = true;
          } else {
            stats.alreadyPlaintext++;
          }
        }
      }

      updatedAddresses.push(copy);
    }

    if (docModified && isApply) {
      batchOps.push({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: { addresses: updatedAddresses } },
        },
      });

      if (batchOps.length >= BATCH_SIZE) {
        await collection.bulkWrite(batchOps, { ordered: false });
        if (isRollback) stats.decrypted += batchOps.length;
        else stats.encrypted += batchOps.length;
        batchOps = [];
      }
    }
  }

  if (batchOps.length > 0 && isApply) {
    await collection.bulkWrite(batchOps, { ordered: false });
    if (isRollback) stats.decrypted += batchOps.length;
    else stats.encrypted += batchOps.length;
  }

  return stats;
}

async function migrateOrdersCollection(
  db: mongoose.mongo.Db,
  isApply: boolean,
  isRollback: boolean
): Promise<CollectionMigrationStats> {
  const collection = db.collection('orders');
  const stats: CollectionMigrationStats = {
    collection: 'orders',
    scanned: 0,
    wouldEncrypt: 0,
    alreadyEncrypted: 0,
    encrypted: 0,
    wouldDecrypt: 0,
    alreadyPlaintext: 0,
    decrypted: 0,
  };

  const cursor = collection.find({ shippingAddress: { $exists: true } });
  let batchOps: any[] = [];

  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    if (!doc || !doc.shippingAddress) break;
    stats.scanned++;

    let docModified = false;
    const addr = { ...doc.shippingAddress };

    if (!isRollback) {
      if (addr.line1) {
        if (isEncrypted(addr.line1)) {
          stats.alreadyEncrypted++;
        } else {
          stats.wouldEncrypt++;
          const enc = encryptField(addr.line1, 'Order.shippingAddress.line1');
          if (decryptField(enc, 'Order.shippingAddress.line1') !== addr.line1) {
            throw new Error(`Self-test decryption failure for order ${doc._id} line1`);
          }
          addr.line1 = enc;
          docModified = true;
        }
      }
      if (addr.line2) {
        if (isEncrypted(addr.line2)) {
          stats.alreadyEncrypted++;
        } else {
          stats.wouldEncrypt++;
          const enc = encryptField(addr.line2, 'Order.shippingAddress.line2');
          if (decryptField(enc, 'Order.shippingAddress.line2') !== addr.line2) {
            throw new Error(`Self-test decryption failure for order ${doc._id} line2`);
          }
          addr.line2 = enc;
          docModified = true;
        }
      }
    } else {
      if (addr.line1) {
        if (isEncrypted(addr.line1)) {
          stats.wouldDecrypt++;
          addr.line1 = decryptField(addr.line1, 'Order.shippingAddress.line1');
          docModified = true;
        } else {
          stats.alreadyPlaintext++;
        }
      }
      if (addr.line2) {
        if (isEncrypted(addr.line2)) {
          stats.wouldDecrypt++;
          addr.line2 = decryptField(addr.line2, 'Order.shippingAddress.line2');
          docModified = true;
        } else {
          stats.alreadyPlaintext++;
        }
      }
    }

    if (docModified && isApply) {
      batchOps.push({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: { shippingAddress: addr } },
        },
      });

      if (batchOps.length >= BATCH_SIZE) {
        await collection.bulkWrite(batchOps, { ordered: false });
        if (isRollback) stats.decrypted += batchOps.length;
        else stats.encrypted += batchOps.length;
        batchOps = [];
      }
    }
  }

  if (batchOps.length > 0 && isApply) {
    await collection.bulkWrite(batchOps, { ordered: false });
    if (isRollback) stats.decrypted += batchOps.length;
    else stats.encrypted += batchOps.length;
  }

  return stats;
}

async function migrateInvoicesCollection(
  db: mongoose.mongo.Db,
  isApply: boolean,
  isRollback: boolean
): Promise<CollectionMigrationStats> {
  const collection = db.collection('invoices');
  const stats: CollectionMigrationStats = {
    collection: 'invoices',
    scanned: 0,
    wouldEncrypt: 0,
    alreadyEncrypted: 0,
    encrypted: 0,
    wouldDecrypt: 0,
    alreadyPlaintext: 0,
    decrypted: 0,
  };

  const cursor = collection.find({ 'snapshot.shippingAddress': { $exists: true } });
  let batchOps: any[] = [];

  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    if (!doc || !doc.snapshot?.shippingAddress) break;
    stats.scanned++;

    let docModified = false;
    const addr = { ...doc.snapshot.shippingAddress };

    if (!isRollback) {
      if (addr.line1) {
        if (isEncrypted(addr.line1)) {
          stats.alreadyEncrypted++;
        } else {
          stats.wouldEncrypt++;
          const enc = encryptField(addr.line1, 'Invoice.snapshot.shippingAddress.line1');
          if (decryptField(enc, 'Invoice.snapshot.shippingAddress.line1') !== addr.line1) {
            throw new Error(`Self-test decryption failure for invoice ${doc._id} line1`);
          }
          addr.line1 = enc;
          docModified = true;
        }
      }
      if (addr.line2) {
        if (isEncrypted(addr.line2)) {
          stats.alreadyEncrypted++;
        } else {
          stats.wouldEncrypt++;
          const enc = encryptField(addr.line2, 'Invoice.snapshot.shippingAddress.line2');
          if (decryptField(enc, 'Invoice.snapshot.shippingAddress.line2') !== addr.line2) {
            throw new Error(`Self-test decryption failure for invoice ${doc._id} line2`);
          }
          addr.line2 = enc;
          docModified = true;
        }
      }
    } else {
      if (addr.line1) {
        if (isEncrypted(addr.line1)) {
          stats.wouldDecrypt++;
          addr.line1 = decryptField(addr.line1, 'Invoice.snapshot.shippingAddress.line1');
          docModified = true;
        } else {
          stats.alreadyPlaintext++;
        }
      }
      if (addr.line2) {
        if (isEncrypted(addr.line2)) {
          stats.wouldDecrypt++;
          addr.line2 = decryptField(addr.line2, 'Invoice.snapshot.shippingAddress.line2');
          docModified = true;
        } else {
          stats.alreadyPlaintext++;
        }
      }
    }

    if (docModified && isApply) {
      batchOps.push({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: { 'snapshot.shippingAddress': addr } },
        },
      });

      if (batchOps.length >= BATCH_SIZE) {
        await collection.bulkWrite(batchOps, { ordered: false });
        if (isRollback) stats.decrypted += batchOps.length;
        else stats.encrypted += batchOps.length;
        batchOps = [];
      }
    }
  }

  if (batchOps.length > 0 && isApply) {
    await collection.bulkWrite(batchOps, { ordered: false });
    if (isRollback) stats.decrypted += batchOps.length;
    else stats.encrypted += batchOps.length;
  }

  return stats;
}

async function migrateSuppliersCollection(
  db: mongoose.mongo.Db,
  isApply: boolean,
  isRollback: boolean
): Promise<CollectionMigrationStats> {
  const collection = db.collection('suppliers');
  const stats: CollectionMigrationStats = {
    collection: 'suppliers',
    scanned: 0,
    wouldEncrypt: 0,
    alreadyEncrypted: 0,
    encrypted: 0,
    wouldDecrypt: 0,
    alreadyPlaintext: 0,
    decrypted: 0,
  };

  const cursor = collection.find({});
  let batchOps: any[] = [];

  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    if (!doc) break;
    stats.scanned++;

    let docModified = false;
    let newPhone = doc.phone;
    let newAddress = doc.address;

    if (!isRollback) {
      if (newPhone) {
        if (isEncrypted(newPhone)) {
          stats.alreadyEncrypted++;
        } else {
          stats.wouldEncrypt++;
          const enc = encryptField(newPhone, 'Supplier.phone');
          if (decryptField(enc, 'Supplier.phone') !== newPhone) {
            throw new Error(`Self-test decryption failure for supplier ${doc._id} phone`);
          }
          newPhone = enc;
          docModified = true;
        }
      }
      if (newAddress) {
        if (isEncrypted(newAddress)) {
          stats.alreadyEncrypted++;
        } else {
          stats.wouldEncrypt++;
          const enc = encryptField(newAddress, 'Supplier.address');
          if (decryptField(enc, 'Supplier.address') !== newAddress) {
            throw new Error(`Self-test decryption failure for supplier ${doc._id} address`);
          }
          newAddress = enc;
          docModified = true;
        }
      }
    } else {
      if (newPhone) {
        if (isEncrypted(newPhone)) {
          stats.wouldDecrypt++;
          newPhone = decryptField(newPhone, 'Supplier.phone');
          docModified = true;
        } else {
          stats.alreadyPlaintext++;
        }
      }
      if (newAddress) {
        if (isEncrypted(newAddress)) {
          stats.wouldDecrypt++;
          newAddress = decryptField(newAddress, 'Supplier.address');
          docModified = true;
        } else {
          stats.alreadyPlaintext++;
        }
      }
    }

    if (docModified && isApply) {
      batchOps.push({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: { phone: newPhone, address: newAddress } },
        },
      });

      if (batchOps.length >= BATCH_SIZE) {
        await collection.bulkWrite(batchOps, { ordered: false });
        if (isRollback) stats.decrypted += batchOps.length;
        else stats.encrypted += batchOps.length;
        batchOps = [];
      }
    }
  }

  if (batchOps.length > 0 && isApply) {
    await collection.bulkWrite(batchOps, { ordered: false });
    if (isRollback) stats.decrypted += batchOps.length;
    else stats.encrypted += batchOps.length;
  }

  return stats;
}

async function migrateReturnRequestsCollection(
  db: mongoose.mongo.Db,
  isApply: boolean,
  isRollback: boolean
): Promise<CollectionMigrationStats> {
  const collection = db.collection('returnrequests');
  const stats: CollectionMigrationStats = {
    collection: 'returnrequests',
    scanned: 0,
    wouldEncrypt: 0,
    alreadyEncrypted: 0,
    encrypted: 0,
    wouldDecrypt: 0,
    alreadyPlaintext: 0,
    decrypted: 0,
  };

  const cursor = collection.find({});
  let batchOps: any[] = [];

  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    if (!doc) break;
    stats.scanned++;

    let docModified = false;
    let pickupAddr = doc.pickup?.address;
    let directAddr = doc.address;

    if (!isRollback) {
      if (pickupAddr) {
        if (isEncrypted(pickupAddr)) {
          stats.alreadyEncrypted++;
        } else {
          stats.wouldEncrypt++;
          const enc = encryptField(pickupAddr, 'ReturnRequest.pickup.address');
          if (decryptField(enc, 'ReturnRequest.pickup.address') !== pickupAddr) {
            throw new Error(`Self-test decryption failure for return request ${doc._id} pickup address`);
          }
          pickupAddr = enc;
          docModified = true;
        }
      }
      if (directAddr) {
        if (isEncrypted(directAddr)) {
          stats.alreadyEncrypted++;
        } else {
          stats.wouldEncrypt++;
          const enc = encryptField(directAddr, 'ReturnRequest.address');
          if (decryptField(enc, 'ReturnRequest.address') !== directAddr) {
            throw new Error(`Self-test decryption failure for return request ${doc._id} direct address`);
          }
          directAddr = enc;
          docModified = true;
        }
      }
    } else {
      if (pickupAddr) {
        if (isEncrypted(pickupAddr)) {
          stats.wouldDecrypt++;
          pickupAddr = decryptField(pickupAddr, 'ReturnRequest.pickup.address');
          docModified = true;
        } else {
          stats.alreadyPlaintext++;
        }
      }
      if (directAddr) {
        if (isEncrypted(directAddr)) {
          stats.wouldDecrypt++;
          directAddr = decryptField(directAddr, 'ReturnRequest.address');
          docModified = true;
        } else {
          stats.alreadyPlaintext++;
        }
      }
    }

    if (docModified && isApply) {
      const updateFields: Record<string, any> = {};
      if (doc.pickup && pickupAddr !== undefined) {
        updateFields['pickup.address'] = pickupAddr;
      }
      if (directAddr !== undefined) {
        updateFields.address = directAddr;
      }

      batchOps.push({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: updateFields },
        },
      });

      if (batchOps.length >= BATCH_SIZE) {
        await collection.bulkWrite(batchOps, { ordered: false });
        if (isRollback) stats.decrypted += batchOps.length;
        else stats.encrypted += batchOps.length;
        batchOps = [];
      }
    }
  }

  if (batchOps.length > 0 && isApply) {
    await collection.bulkWrite(batchOps, { ordered: false });
    if (isRollback) stats.decrypted += batchOps.length;
    else stats.encrypted += batchOps.length;
  }

  return stats;
}

// CLI execution handling
if (require.main === module) {
  const isApply = process.argv.includes('--apply');
  const isRollback = process.argv.includes('--rollback');
  const rollbackConfirmed = process.argv.includes('--i-know-this-writes-plaintext');

  migrateEncryptPersonalFields({
    apply: isApply,
    rollback: isRollback,
    rollbackConfirmed,
  })
    .then(async () => {
      await mongoose.disconnect();
      console.log('Disconnected from MongoDB.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err.message);
      process.exit(1);
    });
}

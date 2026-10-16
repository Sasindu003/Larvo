import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

interface MigrationTarget {
  collectionName: string;
  fields: string[];
  arrayFields?: {
    arrayPath: string;
    field: string;
  }[];
}

export const TARGETS: MigrationTarget[] = [
  {
    collectionName: 'products',
    fields: ['discountPrice'],
    arrayFields: [{ arrayPath: 'variants', field: 'supplier' }],
  },
  {
    collectionName: 'coupons',
    fields: ['maxDiscountAmount', 'usageLimit', 'perCustomerLimit'],
  },
  {
    collectionName: 'users',
    fields: ['supplierId', 'googleId'],
    arrayFields: [
      { arrayPath: 'addresses', field: 'line2' },
      { arrayPath: 'addresses', field: 'phone' },
      { arrayPath: 'addresses', field: 'label' },
    ],
  },
  {
    collectionName: 'reviews',
    fields: ['adminReply', 'adminReply.text', 'adminReply.repliedAt', 'adminReply.repliedBy'],
  },
  {
    collectionName: 'suppliers',
    fields: ['userId', 'address', 'notes'],
  },
  {
    collectionName: 'pointstransactions',
    fields: ['order', 'returnRequest', 'note', 'createdBy'],
  },
  {
    collectionName: 'returnrequests',
    fields: [
      'pickup',
      'pickup.courier',
      'pickup.waybill',
      'pickup.scheduledDate',
      'pickup.timeWindow',
      'pickup.address',
      'reason',
      'refundAmount',
      'rejectionReason',
      'estimatedRefundPoints',
      'refundPoints',
      'refundMethod',
      'refundedAt',
    ],
  },
  {
    collectionName: 'categories',
    fields: ['parent'],
  },
  {
    collectionName: 'invoices',
    fields: [
      'snapshot.pointsUsed',
      'snapshot.shippingAddress.line2',
      'snapshot.shippingAddress.label',
    ],
  },
  {
    collectionName: 'purchaseorders',
    fields: [
      'estimatedDeliveryDate',
      'expectedDeliveryDate',
      'paymentSlipUrl',
      'paymentReviewNote',
      'declineReason',
      'quotationNotes',
    ],
  },
  {
    collectionName: 'payments',
    fields: [
      'slipImageUrl',
      'transactionId',
      'maskedCardLast4',
      'gatewayResponseCode',
      'pointsUsed',
      'walletTransaction',
      'reviewedBy',
      'reviewedAt',
      'reviewNote',
    ],
  },
  {
    collectionName: 'orders',
    fields: [
      'couponCode',
      'trackingNumber',
      'deliveredAt',
      'shippingAddress.line2',
      'shippingAddress.label',
    ],
    arrayFields: [{ arrayPath: 'items', field: 'lineTotal' }],
  },
  {
    collectionName: 'settings',
    fields: ['updatedBy', 'description'],
  },
];

/**
 * Migration: 2026_unset_null_fields
 *
 * Scans MongoDB collections and executes $unset on literal BSON null values
 * (BSON type 10). Runs completely idempotently.
 */
export const up = async (): Promise<{ totalUnset: number; details: Record<string, number> }> => {
  console.log('Running Migration: 2026_unset_null_fields...');

  if (mongoose.connection.readyState === 0) {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/shop';
    await mongoose.connect(mongoUri);
  }

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database connection is not established.');
  }

  const collectionsList = await db.listCollections().toArray();
  const existingCollections = new Set(collectionsList.map((c) => c.name));

  let totalUnset = 0;
  const details: Record<string, number> = {};

  for (const target of TARGETS) {
    if (!existingCollections.has(target.collectionName)) {
      continue;
    }

    const col = db.collection(target.collectionName);

    // 1. Unset targeted top-level & nested path fields
    for (const field of target.fields) {
      try {
        const result = await col.updateMany(
          { [field]: { $type: 10 } },
          { $unset: { [field]: '' } }
        );

        if (result.modifiedCount > 0) {
          const key = `${target.collectionName}.${field}`;
          details[key] = (details[key] || 0) + result.modifiedCount;
          totalUnset += result.modifiedCount;
          console.log(`  ✔ Unset '${field}' on ${result.modifiedCount} documents in '${target.collectionName}'.`);
        }
      } catch (err: any) {
        console.warn(`  ⚠ Warning unsetting '${field}' on '${target.collectionName}':`, err?.message || err);
      }
    }

    // 2. Unset array elements containing null fields (e.g. variants.supplier)
    if (target.arrayFields) {
      for (const af of target.arrayFields) {
        try {
          const arrayFieldPath = `${af.arrayPath}.${af.field}`;
          const unsetPath = `${af.arrayPath}.$[elem].${af.field}`;
          const filterPath = `elem.${af.field}`;

          const result = await col.updateMany(
            { [arrayFieldPath]: { $type: 10 } },
            { $unset: { [unsetPath]: '' } },
            { arrayFilters: [{ [filterPath]: { $type: 10 } }] }
          );

          if (result.modifiedCount > 0) {
            const key = `${target.collectionName}.${arrayFieldPath}`;
            details[key] = (details[key] || 0) + result.modifiedCount;
            totalUnset += result.modifiedCount;
            console.log(
              `  ✔ Unset '${arrayFieldPath}' on ${result.modifiedCount} documents in '${target.collectionName}'.`
            );
          }
        } catch (err: any) {
          console.warn(
            `  ⚠ Warning unsetting array field '${af.arrayPath}.${af.field}' on '${target.collectionName}':`,
            err?.message || err
          );
        }
      }
    }
  }

  // 3. Fallback sweep: scan all collections for any remaining literal null properties
  for (const collInfo of collectionsList) {
    if (collInfo.name.startsWith('system.')) continue;
    const col = db.collection(collInfo.name);

    // Find documents with at least one field equal to null (using cursor in batches)
    const cursor = col.find({});
    const bulkOps: any[] = [];

    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      if (!doc) break;

      const nullFieldsToUnset: Record<string, string> = {};

      const collectNullKeys = (obj: any, prefix = '') => {
        if (!obj || typeof obj !== 'object') return;
        for (const [k, v] of Object.entries(obj)) {
          if (k === '_id') continue;
          const fullPath = prefix ? `${prefix}.${k}` : k;
          if (v === null) {
            nullFieldsToUnset[fullPath] = '';
          } else if (Array.isArray(v)) {
            v.forEach((item, idx) => {
              if (item && typeof item === 'object' && !(item instanceof Date)) {
                collectNullKeys(item, `${fullPath}.${idx}`);
              }
            });
          } else if (typeof v === 'object' && !(v instanceof Date)) {
            collectNullKeys(v, fullPath);
          }
        }
      };

      collectNullKeys(doc);

      if (Object.keys(nullFieldsToUnset).length > 0) {
        bulkOps.push({
          updateOne: {
            filter: { _id: doc._id },
            update: { $unset: nullFieldsToUnset },
          },
        });
      }
    }

    if (bulkOps.length > 0) {
      const sweepRes = await col.bulkWrite(bulkOps);
      if (sweepRes.modifiedCount > 0) {
        const key = `${collInfo.name}._sweep`;
        details[key] = (details[key] || 0) + sweepRes.modifiedCount;
        totalUnset += sweepRes.modifiedCount;
        console.log(`  ✔ Sweep unset residual nulls on ${sweepRes.modifiedCount} documents in '${collInfo.name}'.`);
      }
    }
  }

  if (totalUnset === 0) {
    console.log('Migration complete (idempotent): No literal null fields found in database.');
  } else {
    console.log(`Migration complete: Successfully unset literal null fields across ${totalUnset} documents.`);
  }

  return { totalUnset, details };
};

if (require.main === module) {
  up()
    .then(async () => {
      console.log('Migration finished successfully.');
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('Migration failed:', err);
      await mongoose.disconnect();
      process.exit(1);
    });
}

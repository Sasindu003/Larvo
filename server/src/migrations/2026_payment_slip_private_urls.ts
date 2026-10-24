import dns from 'dns';
import mongoose from 'mongoose';
import { env } from '../config/env';
import { Payment } from '../models/Payment';

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
  // ignore if restricted
}

export async function migratePaymentSlipPrivateUrls(isApply: boolean = false): Promise<void> {
  console.log('===============================================================');
  console.log(`Running Migration: 2026_payment_slip_private_urls (${isApply ? 'APPLY MODE' : 'DRY RUN'})`);
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

  const gridFilesCollection = db.collection('uploads.files');

  const payments = await Payment.find({
    slipImageUrl: { $exists: true, $ne: null },
  }).lean();

  console.log(`Found ${payments.length} payment records with a slipImageUrl.`);

  let updatedCount = 0;
  let alreadyCompliantCount = 0;
  let missingFilesCount = 0;

  for (const payment of payments) {
    const rawUrl = payment.slipImageUrl;
    if (!rawUrl) continue;

    // Extract fileId from URL (e.g. /api/files/:id or /api/files/payment-slips/:id)
    const match = rawUrl.match(/(?:payment-slips\/|files\/)([a-fA-F0-9]{24})/);
    const fileIdStr = match ? match[1] : (mongoose.Types.ObjectId.isValid(rawUrl) ? rawUrl : null);

    if (!fileIdStr) {
      console.warn(`  [SKIP] Payment ${payment._id}: Unable to extract 24-character ObjectId from slipImageUrl '${rawUrl}'`);
      continue;
    }

    const fileObjectId = new mongoose.Types.ObjectId(fileIdStr);
    const gridFile = await gridFilesCollection.findOne({ _id: fileObjectId });

    if (!gridFile) {
      console.warn(`  [WARNING] Payment ${payment._id}: GridFS file with _id ${fileIdStr} not found in uploads.files.`);
      missingFilesCount++;
      continue;
    }

    const canonicalUrl = `/api/files/payment-slips/${fileIdStr}`;
    const needsUrlRewrite = payment.slipImageUrl !== canonicalUrl;
    const needsMetaUpdate =
      gridFile.metadata?.type !== 'payment_slip' ||
      gridFile.metadata?.orderId !== payment.order?.toString();

    if (!needsUrlRewrite && !needsMetaUpdate) {
      alreadyCompliantCount++;
      continue;
    }

    console.log(`  [UPDATE] Payment ${payment._id}:`);
    if (needsUrlRewrite) {
      console.log(`    - URL: '${payment.slipImageUrl}' -> '${canonicalUrl}'`);
    }
    if (needsMetaUpdate) {
      console.log(`    - Metadata: set type='payment_slip', orderId='${payment.order}'`);
    }

    if (isApply) {
      if (needsMetaUpdate) {
        await gridFilesCollection.updateOne(
          { _id: fileObjectId },
          {
            $set: {
              'metadata.type': 'payment_slip',
              'metadata.orderId': payment.order?.toString(),
            },
          }
        );
      }
      if (needsUrlRewrite) {
        await Payment.updateOne(
          { _id: payment._id },
          { $set: { slipImageUrl: canonicalUrl } }
        );
      }
    }

    updatedCount++;
  }

  console.log('---------------------------------------------------------------');
  console.log(`Migration Summary (${isApply ? 'APPLIED' : 'DRY-RUN'}):`);
  console.log(`  Total Inspected:      ${payments.length}`);
  console.log(`  Already Compliant:    ${alreadyCompliantCount}`);
  console.log(`  Missing GridFS Files: ${missingFilesCount}`);
  console.log(`  ${isApply ? 'Successfully Updated' : 'Identified for Update'}: ${updatedCount}`);
  console.log('===============================================================');
}

// CLI execution check
if (require.main === module) {
  const isApply = process.argv.includes('--apply');
  migratePaymentSlipPrivateUrls(isApply)
    .then(async () => {
      await mongoose.disconnect();
      console.log('Disconnected from MongoDB.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}

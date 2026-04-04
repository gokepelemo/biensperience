/**
 * Migration: photos + default_photo_id → photos[{photo, default}]
 *
 * Run ONCE before deploying the new app code.
 * Safe to re-run — already-migrated documents are detected and skipped.
 *
 * Usage:
 *   node scripts/migrate-photos-to-entries.js
 *
 * Environment variables:
 *   MONGODB_URI  — connection string (required)
 */

'use strict';

require('dotenv').config();
const mongoose = require('mongoose');

const BATCH_SIZE = 500;
const COLLECTIONS = ['experiences', 'destinations', 'users'];

async function migrateCollection(db, collectionName) {
  const collection = db.collection(collectionName);
  let processed = 0;
  let skipped = 0;
  let anomalies = 0;
  let lastId = null;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const query = lastId ? { _id: { $gt: lastId } } : {};
    const docs = await collection
      .find(query, { projection: { photos: 1, default_photo_id: 1 } })
      .sort({ _id: 1 })
      .limit(BATCH_SIZE)
      .toArray();

    if (docs.length === 0) break;
    lastId = docs[docs.length - 1]._id;

    const bulkOps = [];

    for (const doc of docs) {
      // Skip documents with no photos
      if (!doc.photos || doc.photos.length === 0) {
        skipped++;
        continue;
      }

      // Detect already-migrated documents: first entry has a .photo field
      if (doc.photos[0] != null && typeof doc.photos[0] === 'object' && doc.photos[0].photo) {
        skipped++;
        continue;
      }

      // Determine which photo ID is the default
      const defaultIdStr = doc.default_photo_id
        ? doc.default_photo_id.toString()
        : null;

      let defaultFound = false;
      const newPhotos = doc.photos.map((photoId) => {
        const idStr = photoId.toString();
        const isDefault = defaultIdStr && idStr === defaultIdStr;
        if (isDefault) defaultFound = true;
        return { photo: photoId, default: isDefault };
      });

      // If default_photo_id doesn't match any photo, mark first as default
      if (defaultIdStr && !defaultFound) {
        anomalies++;
        console.warn(
          `[${collectionName}] doc ${doc._id}: default_photo_id ${defaultIdStr} not in photos array — marking photos[0] as default`
        );
        newPhotos[0].default = true;
      } else if (!defaultIdStr) {
        // No default_photo_id set — mark first photo as default
        newPhotos[0].default = true;
      }

      bulkOps.push({
        updateOne: {
          filter: { _id: doc._id },
          update: {
            $set: { photos: newPhotos },
            $unset: { default_photo_id: 1 }
          }
        }
      });

      processed++;
    }

    if (bulkOps.length > 0) {
      await collection.bulkWrite(bulkOps, { ordered: false });
    }
  }

  return { processed, skipped, anomalies };
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI environment variable is required');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  console.log('Starting photos migration...\n');

  for (const collectionName of COLLECTIONS) {
    console.log(`Migrating ${collectionName}...`);
    const result = await migrateCollection(db, collectionName);
    console.log(
      `  ✓ ${collectionName}: ${result.processed} migrated, ${result.skipped} skipped, ${result.anomalies} anomalies`
    );
  }

  console.log('\nMigration complete.');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

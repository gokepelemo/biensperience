/**
 * Cleanup: orphan Photo references
 *
 * Removes references to deleted Photo documents from User / Experience /
 * Destination / Plan collections. Pre-existing data may have accumulated
 * orphans from photo deletions that happened BEFORE the cascade-cleanup
 * helper landed in controllers/api/photos.js.
 *
 * What gets cleaned:
 *  - User.photos[]               — wrapper { photo, default }; entries with deleted photo refs are dropped, default is re-normalised.
 *  - Experience.photos[]         — same shape, same treatment.
 *  - Experience.plan_items[].photo — single optional ref; unset when photo is gone.
 *  - Destination.photos[]        — same shape as User/Experience.
 *  - Plan.plan_items[].photos    — bare ObjectId array; orphan IDs pulled.
 *  - Plan.plan_items[].details.photos — bare ObjectId array; orphan IDs pulled.
 *
 * Usage:
 *   node scripts/cleanup-orphan-photo-refs.js              # apply changes
 *   node scripts/cleanup-orphan-photo-refs.js --dry-run    # report only
 *
 * Safe to re-run. Documents whose photos arrays match the expected invariant
 * after cleanup are reported as untouched.
 *
 * Environment variables:
 *   MONGODB_URI — connection string (required)
 */

'use strict';

require('dotenv').config();
const mongoose = require('mongoose');

// We talk directly to collections rather than going through Mongoose models so
// the script doesn't depend on the application's startup graph or fire any
// document middleware accidentally.
const BATCH_SIZE = 500;

const dryRun = process.argv.includes('--dry-run');

function logHeader(title) {
  const bar = '─'.repeat(Math.max(40, title.length + 4));
  console.log(`\n${bar}\n  ${title}\n${bar}`);
}

async function loadValidPhotoIds(db) {
  const cursor = db.collection('photos').find({}, { projection: { _id: 1 } });
  const ids = new Set();
  for await (const doc of cursor) {
    ids.add(doc._id.toString());
  }
  return ids;
}

/**
 * Re-normalise a photos array (wrapped shape) so exactly one entry has
 * default: true. Mirrors the pre('save') hook on userSchema. Mutates in place.
 */
function normalizePhotosDefaults(photos) {
  if (!Array.isArray(photos) || photos.length === 0) return;
  const defaultCount = photos.filter(p => p && p.default).length;
  if (defaultCount === 0) {
    photos[0].default = true;
  } else if (defaultCount > 1) {
    let found = false;
    for (let i = photos.length - 1; i >= 0; i--) {
      if (photos[i].default && !found) {
        found = true;
      } else if (photos[i]) {
        photos[i].default = false;
      }
    }
  }
}

/**
 * Clean User / Experience / Destination — they share the wrapper shape.
 *
 * Strategy: cursor through docs with a non-empty photos array, filter out
 * orphan entries (entries whose .photo isn't in validIds), re-normalise the
 * default flag, and write back via bulkWrite. Skip docs whose photos array is
 * unchanged after filtering.
 */
async function cleanupWrappedCollection(db, collectionName, validIds) {
  const collection = db.collection(collectionName);
  let scanned = 0;
  let docsTouched = 0;
  let entriesRemoved = 0;
  let docsEmptied = 0;
  let lastId = null;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const query = {
      photos: { $exists: true, $ne: [] },
      ...(lastId ? { _id: { $gt: lastId } } : {})
    };
    const docs = await collection
      .find(query, { projection: { photos: 1 } })
      .sort({ _id: 1 })
      .limit(BATCH_SIZE)
      .toArray();

    if (docs.length === 0) break;
    lastId = docs[docs.length - 1]._id;
    scanned += docs.length;

    const bulkOps = [];

    for (const doc of docs) {
      const original = Array.isArray(doc.photos) ? doc.photos : [];

      const cleaned = original.filter(entry => {
        if (!entry || typeof entry !== 'object') return false;
        const photoRef = entry.photo;
        if (!photoRef) return false;
        const idStr = (photoRef._id || photoRef).toString();
        return validIds.has(idStr);
      });

      if (cleaned.length === original.length) continue; // nothing to do

      docsTouched++;
      entriesRemoved += original.length - cleaned.length;
      if (cleaned.length === 0) {
        docsEmptied++;
        bulkOps.push({
          updateOne: {
            filter: { _id: doc._id },
            update: { $set: { photos: [] } }
          }
        });
        continue;
      }

      // Re-normalise the default flag so exactly one entry remains the default.
      // Necessary because if we just removed the default entry, no entry would
      // be marked default, and find(p => p.default) would return undefined on
      // the next read.
      normalizePhotosDefaults(cleaned);

      bulkOps.push({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: { photos: cleaned } }
        }
      });
    }

    if (bulkOps.length > 0 && !dryRun) {
      await collection.bulkWrite(bulkOps, { ordered: false });
    }
  }

  return { scanned, docsTouched, entriesRemoved, docsEmptied };
}

/**
 * Clean Experience.plan_items[].photo — single optional ref.
 *
 * One $unset per matched item via arrayFilters. Returns the modifiedCount.
 */
async function cleanupExperiencePlanItemPhoto(db, validIds) {
  const collection = db.collection('experiences');
  // Find experiences whose plan_items contain a photo we can sample.
  const docsWithPhoto = await collection
    .find(
      { 'plan_items.photo': { $exists: true, $ne: null } },
      { projection: { 'plan_items.photo': 1 } }
    )
    .toArray();

  // Collect orphan photo IDs we need to unset.
  const orphans = new Set();
  for (const doc of docsWithPhoto) {
    for (const item of doc.plan_items || []) {
      if (!item?.photo) continue;
      const idStr = (item.photo._id || item.photo).toString();
      if (!validIds.has(idStr)) orphans.add(idStr);
    }
  }

  if (orphans.size === 0) {
    return { affected: 0, orphanIdsUnset: 0 };
  }

  if (dryRun) {
    return { affected: docsWithPhoto.length, orphanIdsUnset: orphans.size };
  }

  let affected = 0;
  for (const orphanIdStr of orphans) {
    const result = await collection.updateMany(
      { 'plan_items.photo': new mongoose.Types.ObjectId(orphanIdStr) },
      { $unset: { 'plan_items.$[item].photo': '' } },
      { arrayFilters: [{ 'item.photo': new mongoose.Types.ObjectId(orphanIdStr) }] }
    );
    affected += result.modifiedCount;
  }

  return { affected, orphanIdsUnset: orphans.size };
}

/**
 * Clean Plan.plan_items[].photos and Plan.plan_items[].details.photos —
 * bare ObjectId arrays. We collect orphan IDs first, then $pull each one.
 */
async function cleanupPlanPhotoArrays(db, validIds) {
  const collection = db.collection('plans');
  const cursor = collection.find(
    {
      $or: [
        { 'plan_items.photos.0': { $exists: true } },
        { 'plan_items.details.photos.0': { $exists: true } }
      ]
    },
    { projection: { 'plan_items.photos': 1, 'plan_items.details.photos': 1 } }
  );

  const orphans = new Set();
  for await (const doc of cursor) {
    for (const item of doc.plan_items || []) {
      for (const ref of item?.photos || []) {
        if (!validIds.has(ref.toString())) orphans.add(ref.toString());
      }
      for (const ref of item?.details?.photos || []) {
        if (!validIds.has(ref.toString())) orphans.add(ref.toString());
      }
    }
  }

  if (orphans.size === 0) {
    return { orphanIdsPulled: 0, plansAffected: 0 };
  }

  if (dryRun) {
    return { orphanIdsPulled: orphans.size, plansAffected: -1 };
  }

  let plansAffected = 0;
  for (const orphanIdStr of orphans) {
    const orphanId = new mongoose.Types.ObjectId(orphanIdStr);
    const result = await collection.updateMany(
      {
        $or: [
          { 'plan_items.photos': orphanId },
          { 'plan_items.details.photos': orphanId }
        ]
      },
      {
        $pull: {
          'plan_items.$[].photos': orphanId,
          'plan_items.$[].details.photos': orphanId
        }
      }
    );
    plansAffected += result.modifiedCount;
  }

  return { orphanIdsPulled: orphans.size, plansAffected };
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI environment variable is required');
    process.exit(1);
  }

  console.log(`Connecting to MongoDB${dryRun ? ' (DRY RUN — no writes)' : ''}...`);
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  logHeader('Loading valid Photo IDs');
  const validIds = await loadValidPhotoIds(db);
  console.log(`  ${validIds.size} valid Photo documents in DB`);

  logHeader('Cleaning wrapped photos arrays (User, Experience, Destination)');
  for (const collectionName of ['users', 'experiences', 'destinations']) {
    const r = await cleanupWrappedCollection(db, collectionName, validIds);
    console.log(
      `  ${collectionName.padEnd(13)}` +
      ` scanned=${r.scanned}` +
      ` touched=${r.docsTouched}` +
      ` entriesRemoved=${r.entriesRemoved}` +
      ` emptied=${r.docsEmptied}`
    );
  }

  logHeader('Cleaning Experience.plan_items[].photo (single ref)');
  const expRes = await cleanupExperiencePlanItemPhoto(db, validIds);
  console.log(`  orphanIdsUnset=${expRes.orphanIdsUnset} docsAffected=${expRes.affected}`);

  logHeader('Cleaning Plan.plan_items[].photos and details.photos');
  const planRes = await cleanupPlanPhotoArrays(db, validIds);
  console.log(
    `  orphanIdsPulled=${planRes.orphanIdsPulled}` +
    ` plansAffected=${planRes.plansAffected === -1 ? '(dry-run, not measured)' : planRes.plansAffected}`
  );

  console.log(`\n${dryRun ? 'Dry-run complete — re-run without --dry-run to apply.' : 'Cleanup complete.'}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});

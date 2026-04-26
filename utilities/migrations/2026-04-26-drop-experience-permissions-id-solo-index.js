/**
 * Migration: drop the subsumed solo index on `permissions._id` from the
 * `experiences` collection (bd #8f36.9).
 *
 * Why:
 *   `models/experience.js` previously declared three indexes that lead with
 *   `permissions._id`:
 *     1. { 'permissions._id': 1, 'permissions.type': 1 }
 *     2. { 'permissions._id': 1 }                              <-- subsumed
 *     3. { 'permissions._id': 1, 'permissions.type': 1, name: 1 }
 *   Because B-tree prefix-match makes the solo index dead weight (any query
 *   the solo index could serve, the compound index can serve via prefix), the
 *   solo declaration was deleted from the schema. This script drops the index
 *   from existing MongoDB deployments. Mongoose will not auto-drop indexes
 *   removed from the schema — they must be dropped explicitly.
 *
 * Behavior:
 *   - Idempotent: tolerates `IndexNotFound` (code 27) so it is safe to re-run
 *     and safe to run on environments that never had the index (dev/test).
 *   - Connects via mongoose using `MONGODB_URI` from the environment.
 *
 * Usage:
 *   node utilities/migrations/2026-04-26-drop-experience-permissions-id-solo-index.js
 *
 * Environment variables:
 *   MONGODB_URI — connection string (required)
 */

'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const logger = require('../backend-logger');

const COLLECTION = 'experiences';
const INDEX_NAME = 'permissions._id_1';
const INDEX_NOT_FOUND_CODE = 27;

async function dropSubsumedIndex() {
  logger.info('[migration:drop-experience-permissions-id-solo-index] starting', {
    collection: COLLECTION,
    indexName: INDEX_NAME
  });

  const db = mongoose.connection.db;
  const collection = db.collection(COLLECTION);

  try {
    logger.info('[migration:drop-experience-permissions-id-solo-index] found-and-dropping', {
      collection: COLLECTION,
      indexName: INDEX_NAME
    });
    await collection.dropIndex(INDEX_NAME);
    logger.info('[migration:drop-experience-permissions-id-solo-index] dropped', {
      collection: COLLECTION,
      indexName: INDEX_NAME
    });
  } catch (err) {
    if (err && (err.code === INDEX_NOT_FOUND_CODE || err.codeName === 'IndexNotFound')) {
      logger.info('[migration:drop-experience-permissions-id-solo-index] already-gone', {
        collection: COLLECTION,
        indexName: INDEX_NAME,
        reason: err.codeName || 'IndexNotFound'
      });
    } else {
      throw err;
    }
  }
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    logger.error('[migration:drop-experience-permissions-id-solo-index] MONGODB_URI is required');
    process.exit(1);
  }

  await mongoose.connect(uri);
  try {
    await dropSubsumedIndex();
    logger.info('[migration:drop-experience-permissions-id-solo-index] finished');
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    logger.error(
      '[migration:drop-experience-permissions-id-solo-index] failed',
      { error: err && err.message },
      err
    );
    process.exit(1);
  });
}

module.exports = { dropSubsumedIndex };

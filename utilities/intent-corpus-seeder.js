/**
 * Intent Corpus Seeder
 *
 * Seeds and migrates the IntentCorpus collection from the static JSON
 * corpus file. On version mismatch, non-custom entries are overwritten
 * with the new corpus version. Custom entries are never touched.
 *
 * @module utilities/intent-corpus-seeder
 */

const IntentCorpus = require('../models/intent-corpus');
const logger = require('./backend-logger');
const path = require('path');

function loadCorpus() {
  // require() inside the function so Jest can mock the JSON file per-test.
  return require(path.join(__dirname, 'bienbot-intent-corpus.json'));
}

function isValidEntry(entry) {
  return entry && typeof entry.intent === 'string' && entry.intent.trim().length > 0;
}

/**
 * @returns {Promise<{ seeded: number, synced: number, migrated: number }>}
 *   seeded   — count inserted on first boot
 *   synced   — count of intents that gained new utterances at the same version
 *   migrated — count of intents whose utterances were overwritten on version bump
 */
async function seedIntentCorpus() {
  const corpus = loadCorpus();
  const targetVersion = corpus && corpus.version ? corpus.version : 'v1';
  const result = { seeded: 0, synced: 0, migrated: 0 };

  if (!corpus || !Array.isArray(corpus.data) || corpus.data.length === 0) {
    logger.warn('[intent-corpus-seeder] Corpus file is empty or invalid');
    return result;
  }

  const validEntries = corpus.data.filter(isValidEntry);
  const skipped = corpus.data.length - validEntries.length;
  if (skipped > 0) {
    logger.warn('[intent-corpus-seeder] Skipped invalid corpus entries', { skipped });
  }
  if (validEntries.length === 0) return result;

  const count = await IntentCorpus.countDocuments();
  if (count === 0) {
    const docs = validEntries.map(entry => ({
      intent: entry.intent,
      utterances: entry.utterances || [],
      description: entry.description || '',
      is_custom: false,
      enabled: true,
      corpus_version: targetVersion
    }));

    try {
      const inserted = await IntentCorpus.insertMany(docs, { ordered: false });
      result.seeded = Array.isArray(inserted) ? inserted.length : 0;
    } catch (err) {
      // ordered:false continues past dup-key errors when a peer process seeded concurrently.
      const writeErrors = (err && err.writeErrors) || [];
      const allDup = writeErrors.length > 0 && writeErrors.every(we => {
        const code = (we && we.err && we.err.code) || we.code;
        return code === 11000;
      });
      if (!allDup) throw err;
      result.seeded = docs.length - writeErrors.length;
      logger.warn('[intent-corpus-seeder] Concurrent seed handled — some intents already existed', {
        attempted: docs.length,
        inserted: result.seeded,
        skipped: writeErrors.length
      });
    }

    logger.info('[intent-corpus-seeder] Corpus seeded from JSON', {
      intents: result.seeded,
      utterances: docs.reduce((sum, d) => sum + d.utterances.length, 0),
      version: targetVersion
    });

    return result;
  }

  // Sync/migrate path: one read + one bulk write instead of N findOne+save round-trips.
  const intents = validEntries.map(e => e.intent);
  const dbDocs = await IntentCorpus.find({
    intent: { $in: intents },
    is_custom: { $ne: true }
  }).lean();
  const dbDocsByIntent = new Map(dbDocs.map(d => [d.intent, d]));

  const bulkOps = [];
  for (const entry of validEntries) {
    const dbDoc = dbDocsByIntent.get(entry.intent);
    if (!dbDoc) continue;

    const newUtterances = entry.utterances || [];
    if (dbDoc.corpus_version !== targetVersion) {
      bulkOps.push({
        updateOne: {
          filter: { _id: dbDoc._id },
          update: { $set: { utterances: newUtterances, corpus_version: targetVersion } }
        }
      });
      result.migrated++;
      continue;
    }

    const existing = new Set(dbDoc.utterances);
    const toAdd = newUtterances.filter(u => !existing.has(u));
    if (toAdd.length > 0) {
      bulkOps.push({
        updateOne: {
          filter: { _id: dbDoc._id },
          update: { $push: { utterances: { $each: toAdd } } }
        }
      });
      result.synced++;
      logger.info('[intent-corpus-seeder] Synced new utterances for intent', {
        intent: entry.intent,
        added: toAdd.length
      });
    }
  }

  if (bulkOps.length > 0) {
    await IntentCorpus.bulkWrite(bulkOps, { ordered: false });
  }

  if (result.migrated > 0) {
    logger.info('[intent-corpus-seeder] Corpus migrated to new version', {
      migrated: result.migrated,
      version: targetVersion
    });
  }
  if (result.synced > 0) {
    logger.info('[intent-corpus-seeder] Corpus sync complete', { synced: result.synced });
  }

  return result;
}

module.exports = { seedIntentCorpus };

/**
 * Intent Corpus Seeder
 *
 * Seeds the IntentCorpus MongoDB collection from the static JSON
 * corpus file on first boot. Idempotent: does nothing if the
 * collection already has data.
 *
 * @module utilities/intent-corpus-seeder
 */

const IntentCorpus = require('../models/intent-corpus');
const logger = require('./backend-logger');
const path = require('path');

/**
 * Seed intent corpus from JSON file if collection is empty.
 * @returns {Promise<{ seeded: number }>} Number of intents seeded.
 */
async function seedIntentCorpus() {
  const corpus = require(path.join(__dirname, 'bienbot-intent-corpus.json'));

  if (!corpus || !Array.isArray(corpus.data) || corpus.data.length === 0) {
    logger.warn('[intent-corpus-seeder] Corpus file is empty or invalid');
    return { seeded: 0, synced: 0 };
  }

  const count = await IntentCorpus.countDocuments();
  if (count === 0) {
    // First boot: seed everything
    const docs = corpus.data.map(entry => ({
      intent: entry.intent,
      utterances: entry.utterances || [],
      description: '',
      is_custom: false,
      enabled: true
    }));

    await IntentCorpus.insertMany(docs);

    logger.info('[intent-corpus-seeder] Corpus seeded from JSON', {
      intents: docs.length,
      utterances: docs.reduce((sum, d) => sum + d.utterances.length, 0)
    });

    return { seeded: docs.length, synced: 0 };
  }

  // Sync: merge new JSON utterances into existing non-custom DB entries
  let synced = 0;
  for (const entry of corpus.data) {
    const dbDoc = await IntentCorpus.findOne({ intent: entry.intent, is_custom: { $ne: true } });
    if (!dbDoc) continue;
    const existing = new Set(dbDoc.utterances);
    const newUtterances = (entry.utterances || []).filter(u => !existing.has(u));
    if (newUtterances.length > 0) {
      dbDoc.utterances.push(...newUtterances);
      await dbDoc.save();
      synced++;
      logger.info('[intent-corpus-seeder] Synced new utterances for intent', {
        intent: entry.intent,
        added: newUtterances.length
      });
    }
  }

  if (synced > 0) {
    logger.info('[intent-corpus-seeder] Corpus sync complete', { synced });
  }

  return { seeded: 0, synced };
}

module.exports = { seedIntentCorpus };

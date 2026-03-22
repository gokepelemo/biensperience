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
  const count = await IntentCorpus.countDocuments();
  if (count > 0) {
    return { seeded: 0 };
  }

  const corpus = require(path.join(__dirname, 'bienbot-intent-corpus.json'));

  if (!corpus || !Array.isArray(corpus.data) || corpus.data.length === 0) {
    logger.warn('[intent-corpus-seeder] Corpus file is empty or invalid');
    return { seeded: 0 };
  }

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

  return { seeded: docs.length };
}

module.exports = { seedIntentCorpus };

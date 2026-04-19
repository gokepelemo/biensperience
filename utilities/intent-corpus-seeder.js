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

async function seedIntentCorpus() {
  const corpus = require(path.join(__dirname, 'bienbot-intent-corpus.json'));
  const targetVersion = corpus && corpus.version ? corpus.version : 'v1';

  if (!corpus || !Array.isArray(corpus.data) || corpus.data.length === 0) {
    logger.warn('[intent-corpus-seeder] Corpus file is empty or invalid');
    return { seeded: 0, synced: 0, migrated: 0 };
  }

  const count = await IntentCorpus.countDocuments();
  if (count === 0) {
    const docs = corpus.data.map(entry => ({
      intent: entry.intent,
      utterances: entry.utterances || [],
      description: '',
      is_custom: false,
      enabled: true,
      corpus_version: targetVersion
    }));

    await IntentCorpus.insertMany(docs);

    logger.info('[intent-corpus-seeder] Corpus seeded from JSON', {
      intents: docs.length,
      utterances: docs.reduce((sum, d) => sum + d.utterances.length, 0),
      version: targetVersion
    });

    return { seeded: docs.length, synced: 0, migrated: 0 };
  }

  let synced = 0;
  let migrated = 0;
  for (const entry of corpus.data) {
    const dbDoc = await IntentCorpus.findOne({ intent: entry.intent, is_custom: { $ne: true } });
    if (!dbDoc) continue;

    if (dbDoc.corpus_version !== targetVersion) {
      dbDoc.utterances = entry.utterances || [];
      dbDoc.corpus_version = targetVersion;
      await dbDoc.save();
      migrated++;
      continue;
    }

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

  if (migrated > 0) {
    logger.info('[intent-corpus-seeder] Corpus migrated to new version', { migrated, version: targetVersion });
  }
  if (synced > 0) {
    logger.info('[intent-corpus-seeder] Corpus sync complete', { synced });
  }

  return { seeded: 0, synced, migrated };
}

module.exports = { seedIntentCorpus };

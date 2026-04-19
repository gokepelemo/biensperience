/**
 * BienBot Intent Entity Registry
 *
 * Registers named entities (top-K destinations + experiences) and
 * regex fallbacks on an NlpManager so the classifier can emit
 * destination_name / experience_name / user_email entities.
 *
 * @module utilities/bienbot-intent-entity-registry
 */

const logger = require('./backend-logger');
const {
  getTopEntities,
  getCompositionFingerprint
} = require('./bienbot-intent-popularity-scorer');

const DESTINATION_REGEX = /(?:about|visit(?:ing)?|to|in|for|from)\s+([A-Z][a-zA-Z'\-]*(?:\s+[A-Z][a-zA-Z'\-]*)*)\s*(?:[?.!,]|$)/g;
const EXPERIENCE_REGEX = /(?:the\s+)?([A-Z][a-zA-Z'\-]*(?:\s+[A-Z][a-zA-Z'\-]*)*)\s+(?:Tour|Experience|Adventure|Crawl|Festival)\b/g;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

function synonymsFor(name) {
  const variants = new Set([name, name.toLowerCase()]);
  const stripped = name.replace(/[^\w\s]/g, '').trim();
  if (stripped && stripped !== name) {
    variants.add(stripped);
    variants.add(stripped.toLowerCase());
  }
  return Array.from(variants);
}

async function registerEntities(nlp, { kDestinations = 500, kExperiences = 500 } = {}) {
  const topK = await getTopEntities({ kDestinations, kExperiences });
  const fingerprint = getCompositionFingerprint(topK);

  for (const dest of topK.destinations) {
    nlp.addNamedEntityText('destination_name', dest.name, ['en'], synonymsFor(dest.name));
  }

  for (const exp of topK.experiences) {
    nlp.addNamedEntityText('experience_name', exp.name, ['en'], synonymsFor(exp.name));
  }

  nlp.addRegexEntity('destination_name', 'en', DESTINATION_REGEX);
  nlp.addRegexEntity('experience_name', 'en', EXPERIENCE_REGEX);
  nlp.addRegexEntity('user_email', 'en', EMAIL_REGEX);

  logger.info('[entity-registry] Entities registered', {
    destinations: topK.destinations.length,
    experiences: topK.experiences.length,
    fingerprint
  });

  return {
    destinationCount: topK.destinations.length,
    experienceCount: topK.experiences.length,
    fingerprint
  };
}

module.exports = { registerEntities };

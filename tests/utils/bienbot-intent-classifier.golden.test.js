/**
 * Golden-fixture tests for the BienBot intent classifier.
 *
 * Runs the curated case list from tests/fixtures/bienbot-intent-golden.json
 * against the classifier twice:
 *   1. with NLP_SLOT_FILL_V2=false (baseline — skips cases marked
 *      run_flag_off:false, which require the v2 NER path)
 *   2. with NLP_SLOT_FILL_V2=true (slot-fill — runs the full suite)
 *
 * The flag-ON suite depends on MongoDB being seeded with the v2 corpus
 * (entity-registry + slot-filled templates). In a dev environment without
 * seeded data, flag-ON cases that rely on top-K entity matching may fail;
 * this is expected and documented in the plan.
 */

const fixture = require('../fixtures/bienbot-intent-golden.json');

async function runCase(classifier, entry) {
  const result = await classifier.classifyIntent(entry.message);
  const issues = [];

  if (!result) {
    return [`classifier returned null/undefined`];
  }

  if (result.intent !== entry.expected_intent) {
    issues.push(`intent: expected ${entry.expected_intent}, got ${result.intent}`);
  }
  if (entry.min_confidence != null && result.confidence < entry.min_confidence) {
    issues.push(`confidence: ${result.confidence} < ${entry.min_confidence}`);
  }
  if (entry.must_extract_entity) {
    for (const [key, expectedVal] of Object.entries(entry.expected_entities || {})) {
      const got = result.entities?.[key];
      if (!got || String(got).toLowerCase() !== String(expectedVal).toLowerCase()) {
        issues.push(`entity ${key}: expected "${expectedVal}", got "${got}"`);
      }
    }
  }

  return issues;
}

describe('Golden: classifier with flag OFF (baseline)', () => {
  let classifier;

  beforeAll(() => {
    process.env.NLP_SLOT_FILL_V2 = 'false';
    jest.resetModules();
    classifier = require('../../utilities/bienbot-intent-classifier');
  });

  afterAll(() => {
    delete process.env.NLP_SLOT_FILL_V2;
  });

  for (const entry of fixture.cases.filter(c => c.run_flag_off !== false)) {
    test(`${entry.id}: ${entry.message}`, async () => {
      const issues = await runCase(classifier, entry);
      expect(issues).toEqual([]);
    });
  }
});

describe('Golden: classifier with flag ON (slot-fill)', () => {
  let classifier;

  beforeAll(() => {
    process.env.NLP_SLOT_FILL_V2 = 'true';
    jest.resetModules();
    classifier = require('../../utilities/bienbot-intent-classifier');
  });

  afterAll(() => {
    delete process.env.NLP_SLOT_FILL_V2;
  });

  for (const entry of fixture.cases) {
    test(`${entry.id}: ${entry.message}`, async () => {
      const issues = await runCase(classifier, entry);
      expect(issues).toEqual([]);
    });
  }
});

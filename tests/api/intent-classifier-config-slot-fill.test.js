const IntentClassifierConfig = require('../../models/intent-classifier-config');

describe('IntentClassifierConfig nlp_slot_fill_enabled', () => {
  test('defaults to false', () => {
    const doc = new IntentClassifierConfig({});
    expect(doc.nlp_slot_fill_enabled).toBe(false);
  });

  test('accepts true', () => {
    const doc = new IntentClassifierConfig({ nlp_slot_fill_enabled: true });
    expect(doc.nlp_slot_fill_enabled).toBe(true);
  });
});

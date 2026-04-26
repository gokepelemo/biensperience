const IntentClassifierConfig = require('../../models/intent-classifier-config');

describe('IntentClassifierConfig retrain tunables', () => {
  test('retrain_min_interval_seconds defaults to 3600', () => {
    const doc = new IntentClassifierConfig({});
    expect(doc.retrain_min_interval_seconds).toBe(3600);
  });

  test('retrain_min_churn_events defaults to 25', () => {
    const doc = new IntentClassifierConfig({});
    expect(doc.retrain_min_churn_events).toBe(25);
  });

  test('retrain_delta_threshold defaults to 0.1', () => {
    const doc = new IntentClassifierConfig({});
    expect(doc.retrain_delta_threshold).toBe(0.1);
  });
});

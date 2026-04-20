jest.mock('../../utilities/event-bus', () => ({
  subscribe: jest.fn(() => () => {}),
  emit: jest.fn()
}), { virtual: true });

jest.mock('../../utilities/bienbot-intent-popularity-scorer', () => ({
  getTopEntities: jest.fn(),
  getCompositionFingerprint: jest.fn()
}));

jest.mock('../../utilities/bienbot-intent-classifier', () => ({
  resetManager: jest.fn(),
  getLastTrainedFingerprint: jest.fn(() => 'fp-old')
}));

const scorer = require('../../utilities/bienbot-intent-popularity-scorer');
const classifier = require('../../utilities/bienbot-intent-classifier');
const scheduler = require('../../utilities/bienbot-intent-retrain-scheduler');

describe('bienbot-intent-retrain-scheduler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    scheduler.__test__.reset();
  });

  afterEach(() => {
    scheduler.stop();
  });

  test('does nothing below MIN_CHURN_EVENTS', async () => {
    await scheduler.start({ minChurnEvents: 25, minIntervalSeconds: 0, deltaThreshold: 0 });
    for (let i = 0; i < 24; i++) {
      await scheduler.__test__.onChurnEvent();
    }
    expect(scorer.getTopEntities).not.toHaveBeenCalled();
    expect(classifier.resetManager).not.toHaveBeenCalled();
  });

  test('does not retrain when fingerprint matches last trained', async () => {
    scorer.getTopEntities.mockResolvedValue({ destinations: [{ _id: 'a' }], experiences: [] });
    scorer.getCompositionFingerprint.mockReturnValue('fp-old');
    await scheduler.start({ minChurnEvents: 1, minIntervalSeconds: 0, deltaThreshold: 0.1 });
    await scheduler.__test__.onChurnEvent();
    expect(classifier.resetManager).not.toHaveBeenCalled();
  });

  test('retrains when fingerprint differs', async () => {
    scorer.getTopEntities.mockResolvedValue({ destinations: [{ _id: 'a' }], experiences: [] });
    scorer.getCompositionFingerprint.mockReturnValue('fp-new');
    await scheduler.start({ minChurnEvents: 1, minIntervalSeconds: 0, deltaThreshold: 0.1 });
    await scheduler.__test__.onChurnEvent();
    expect(classifier.resetManager).toHaveBeenCalledTimes(1);
  });

  test('respects minIntervalSeconds between retrains', async () => {
    scorer.getTopEntities.mockResolvedValue({ destinations: [{ _id: 'a' }], experiences: [] });
    scorer.getCompositionFingerprint.mockReturnValue('fp-new');
    await scheduler.start({ minChurnEvents: 1, minIntervalSeconds: 60, deltaThreshold: 0 });
    await scheduler.__test__.onChurnEvent();
    classifier.getLastTrainedFingerprint.mockReturnValue('fp-new');
    scorer.getCompositionFingerprint.mockReturnValue('fp-newer');
    await scheduler.__test__.onChurnEvent();
    expect(classifier.resetManager).toHaveBeenCalledTimes(1);
  });

  test('stop() detaches subscriptions', async () => {
    const unsub = jest.fn();
    const bus = require('../../utilities/event-bus');
    bus.subscribe.mockImplementation(() => unsub);
    await scheduler.start({ minChurnEvents: 1, minIntervalSeconds: 0, deltaThreshold: 0 });
    scheduler.stop();
    expect(unsub).toHaveBeenCalled();
  });
});

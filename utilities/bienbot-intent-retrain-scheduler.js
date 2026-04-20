/**
 * BienBot Intent Retrain Scheduler
 *
 * Subscribes to entity-relevant events (plan/destination/experience/favorite
 * create/delete) and triggers an async classifier retrain when:
 *   - churnCounter >= minChurnEvents, AND
 *   - (now - lastRetrainAt) >= minIntervalSeconds, AND
 *   - the popularity-scorer fingerprint differs from the last trained one.
 *
 * Tests mock `./event-bus` virtually; in production the bus is expected to
 * implement `subscribe(event, handler) -> unsubscribe`. When the bus module
 * is not yet wired up the scheduler stays dormant — safe to boot.
 *
 * @module utilities/bienbot-intent-retrain-scheduler
 */

const logger = require('./backend-logger');

const WATCHED_EVENTS = [
  'plan:created', 'plan:deleted',
  'destination:created', 'destination:deleted',
  'experience:created', 'experience:deleted',
  'user:favorite_added', 'user:favorite_removed'
];

let state = {
  started: false,
  unsubs: [],
  lastRetrainAt: 0,
  churnCounter: 0,
  config: { minChurnEvents: 25, minIntervalSeconds: 3600, deltaThreshold: 0.1 }
};

async function start(configOverride = {}) {
  if (state.started) return;

  let bus;
  try {
    bus = require('./event-bus');
  } catch (err) {
    logger.warn('[retrain-scheduler] event-bus not available, scheduler dormant', {
      error: err.message
    });
    state.started = true;
    return;
  }

  state.config = { ...state.config, ...configOverride };

  for (const evt of WATCHED_EVENTS) {
    const unsub = bus.subscribe(evt, () => {
      onChurnEvent().catch(err => {
        logger.warn('[retrain-scheduler] Churn handler failed', { error: err.message });
      });
    });
    state.unsubs.push(unsub);
  }

  state.started = true;
  logger.info('[retrain-scheduler] Started', {
    events: WATCHED_EVENTS.length,
    config: state.config
  });
}

function stop() {
  for (const unsub of state.unsubs) {
    try { unsub(); } catch {}
  }
  state.unsubs = [];
  state.started = false;
}

async function onChurnEvent() {
  state.churnCounter += 1;

  if (state.churnCounter < state.config.minChurnEvents) return;

  const sinceMs = Date.now() - state.lastRetrainAt;
  if (sinceMs < state.config.minIntervalSeconds * 1000) return;

  const scorer = require('./bienbot-intent-popularity-scorer');
  const classifier = require('./bienbot-intent-classifier');

  const topK = await scorer.getTopEntities({ kDestinations: 500, kExperiences: 500 });
  const newFingerprint = scorer.getCompositionFingerprint(topK);
  const oldFingerprint = classifier.getLastTrainedFingerprint();

  if (!oldFingerprint) {
    logger.debug('[retrain-scheduler] No trained fingerprint yet, forcing retrain');
    classifier.resetManager();
    state.lastRetrainAt = Date.now();
    state.churnCounter = 0;
    return;
  }

  if (newFingerprint === oldFingerprint) return;

  classifier.resetManager();
  state.lastRetrainAt = Date.now();
  state.churnCounter = 0;
  logger.info('[retrain-scheduler] Retrain triggered', { oldFingerprint, newFingerprint });
}

function reset() {
  state = {
    started: false,
    unsubs: [],
    lastRetrainAt: 0,
    churnCounter: 0,
    config: { minChurnEvents: 25, minIntervalSeconds: 3600, deltaThreshold: 0.1 }
  };
}

module.exports = { start, stop, __test__: { onChurnEvent, reset } };

/**
 * BienBot Intent Popularity Scorer
 *
 * Computes composite popularity scores for destinations and experiences:
 *   plans * 3 + recent_activity * 1 + favorites * 1
 *
 * Runs only at classifier training time, not per-classification.
 *
 * @module utilities/bienbot-intent-popularity-scorer
 */

const crypto = require('crypto');
const logger = require('./backend-logger');

const WEIGHT_PLANS = 3;
const WEIGHT_ACTIVITY = 1;
const WEIGHT_FAVORITES = 1;
const DEFAULT_ACTIVITY_WINDOW_DAYS = 30;

async function getTopEntities({
  kDestinations = 500,
  kExperiences = 500,
  activityWindowDays = DEFAULT_ACTIVITY_WINDOW_DAYS
} = {}) {
  const Plan = require('../models/plan');
  const Experience = require('../models/experience');
  const Destination = require('../models/destination');
  const Activity = require('../models/activity');
  const User = require('../models/user');

  const since = new Date(Date.now() - activityWindowDays * 24 * 60 * 60 * 1000);

  const [planAgg, expDocs, destDocs, activityAgg, favAgg] = await Promise.all([
    Plan.aggregate([
      { $group: { _id: '$experience', plan_count: { $sum: 1 } } }
    ]),
    Experience.aggregate([
      { $project: { _id: 1, name: 1, destination: 1 } }
    ]),
    Destination.find({}, { _id: 1, name: 1 }).lean(),
    Activity.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: {
          _id: { entity_type: '$entity_type', entity_id: '$entity_id' },
          count: { $sum: 1 }
      }}
    ]),
    User.aggregate([
      { $unwind: { path: '$favorite_destinations', preserveNullAndEmptyArrays: false } },
      { $group: { _id: '$favorite_destinations', count: { $sum: 1 } } }
    ])
  ]);

  const planCountByExp = new Map(planAgg.map(p => [String(p._id), p.plan_count]));

  const planCountByDest = new Map();
  for (const exp of expDocs) {
    const count = planCountByExp.get(String(exp._id)) || 0;
    if (!exp.destination) continue;
    const key = String(exp.destination);
    planCountByDest.set(key, (planCountByDest.get(key) || 0) + count);
  }

  const activityByEntity = new Map();
  for (const a of activityAgg) {
    activityByEntity.set(`${a._id.entity_type}:${a._id.entity_id}`, a.count);
  }

  const favByDest = new Map(favAgg.map(f => [String(f._id), f.count]));

  const destinations = destDocs.map(d => {
    const id = String(d._id);
    const plans = planCountByDest.get(id) || 0;
    const activity = activityByEntity.get(`destination:${id}`) || 0;
    const favorites = favByDest.get(id) || 0;
    return {
      _id: id,
      name: d.name,
      score: plans * WEIGHT_PLANS + activity * WEIGHT_ACTIVITY + favorites * WEIGHT_FAVORITES
    };
  })
  .filter(d => d.score > 0)
  .sort((a, b) => b.score - a.score)
  .slice(0, kDestinations);

  const experiences = expDocs.map(e => {
    const id = String(e._id);
    const plans = planCountByExp.get(id) || 0;
    const activity = activityByEntity.get(`experience:${id}`) || 0;
    return {
      _id: id,
      name: e.name,
      score: plans * WEIGHT_PLANS + activity * WEIGHT_ACTIVITY
    };
  })
  .filter(e => e.score > 0)
  .sort((a, b) => b.score - a.score)
  .slice(0, kExperiences);

  logger.debug('[popularity-scorer] Top entities computed', {
    destinations: destinations.length,
    experiences: experiences.length
  });

  return { destinations, experiences };
}

function getCompositionFingerprint({ destinations = [], experiences = [] } = {}) {
  const destIds = destinations.map(d => d._id).sort().join(',');
  const expIds  = experiences.map(e => e._id).sort().join(',');
  return crypto.createHash('md5').update(`d:${destIds}|e:${expIds}`).digest('hex').slice(0, 16);
}

module.exports = {
  getTopEntities,
  getCompositionFingerprint,
  WEIGHT_PLANS,
  WEIGHT_ACTIVITY,
  WEIGHT_FAVORITES
};

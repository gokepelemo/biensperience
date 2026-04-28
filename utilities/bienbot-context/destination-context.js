/**
 * BienBot Context — Destination
 *
 * Builds the LLM context block for a Destination entity.
 * Extracted verbatim from utilities/bienbot-context-builders.js — mechanical
 * move, no logic changes.
 *
 * @module utilities/bienbot-context/destination-context
 */

const logger = require('../backend-logger');
const { getEnforcer } = require('../permission-enforcer');
const { validateObjectId } = require('../controller-helpers');
const { applySignalDecay, signalsToNaturalLanguage } = require('../hidden-signals');

const {
  loadModels,
  getModels,
  entityJSON,
  trimToTokenBudget,
  DEFAULT_TOKEN_BUDGET,
  buildDisambiguationBlock,
  renderAttentionBlock,
  computePlanProximityTag,
} = require('./_shared');

/**
 * Build context block for a Destination.
 * @param {string} destinationId
 * @param {string} userId
 * @param {object} [options]
 * @param {number} [options.tokenBudget]
 * @returns {Promise<string|null>}
 */
async function buildDestinationContext(destinationId, userId, options = {}) {
  loadModels();
  const { Destination, Experience, Plan, User } = getModels();
  const enforcer = getEnforcer({ Destination, Experience, Plan, User });

  const { valid: destIdValid, objectId: destOid } = validateObjectId(destinationId, 'destinationId');
  if (!destIdValid) return null;

  try {
    // NOT .lean(): preserves resource.constructor.modelName for permission visibility check.
    const destination = await Destination.findById(destOid)
      .select('name country state overview location travel_tips travel_tips_updated_at visibility hidden_signals permissions');
    if (!destination) return null;

    const perm = await enforcer.canView({ userId, resource: destination });
    if (!perm.allowed) return null;

    // Check if travel tips are stale or empty — trigger background enrichment
    const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
    const lastEnriched = destination.travel_tips_updated_at;
    const isStale = !lastEnriched || (Date.now() - new Date(lastEnriched).getTime()) > CACHE_TTL_MS;
    const hasTips = destination.travel_tips && destination.travel_tips.length > 0;

    if (isStale || !hasTips) {
      try {
        const { enrichDestinationViaRegistry } = require('../destination-enrichment');
        // Non-blocking background refresh — serve cached data (if any) immediately
        enrichDestinationViaRegistry(destinationId, { _id: userId }, { background: hasTips, force: !hasTips }).catch(err => {
          logger.warn('[bienbot-context] Background enrichment failed', { destinationId, error: err.message });
        });
      } catch (e) {
        logger.warn('[bienbot-context] Could not trigger enrichment', { error: e.message });
      }
    }

    const lines = [
      `[Destination] ${destination.name}`,
      `Entity: ${entityJSON(destination._id.toString(), destination.name, 'destination')}`,
      destination.country ? `Country: ${destination.country}` : null,
      destination.state ? `State/Region: ${destination.state}` : null,
      destination.overview ? `Overview: ${destination.overview}` : null,
      destination.location?.city ? `City: ${destination.location.city}` : null,
      destination.travel_tips?.length
        ? `Travel tips: ${destination.travel_tips.slice(0, 5).map(t => typeof t === 'string' ? t : t.value || '').join('; ')}`
        : null,
      destination.visibility ? `Visibility: ${destination.visibility}` : null
    ];

    // Pre-fetch user doc (for signals) and user plans in parallel
    let _userDocForDest = null;
    let userPlansForDest = [];
    try {
      const [fetchedUser, fetchedPlans] = await Promise.all([
        User.findById(userId).select('hidden_signals').lean(),
        options.userPlans
          ? Promise.resolve(options.userPlans)
          : Plan.find({ user: userId })
              .populate({ path: 'experience', select: 'name destination', populate: { path: 'destination', select: 'name country' } })
              .select('experience planned_date plan')
              .lean()
      ]);
      _userDocForDest = fetchedUser;
      userPlansForDest = fetchedPlans;
    } catch (prefetchErr) {
      logger.debug('[bienbot-context] Destination pre-fetch partial failure', { error: prefetchErr.message });
    }

    // Inject hidden travel signals for destination and requesting user
    try {
      const destSignals = applySignalDecay(destination.hidden_signals || {});
      const destNL = signalsToNaturalLanguage(destSignals, { role: 'traveler' });
      const userSignals = _userDocForDest ? applySignalDecay(_userDocForDest.hidden_signals || {}) : null;
      const userNL = userSignals ? signalsToNaturalLanguage(userSignals, { role: 'traveler' }) : '';
      if (destNL || userNL) {
        const signalParts = [];
        if (destNL) signalParts.push(`Destination profile: ${destNL}`);
        if (userNL) signalParts.push(`Visitor preference: ${userNL}`);
        lines.push(signalParts.join(' '));
      }
    } catch (sigErr) {
      logger.debug('[bienbot-context] Signal injection skipped', { error: sigErr.message });
    }

    // Cross-entity: Your other plans for this destination (up to 3)
    try {
      const relatedPlans = userPlansForDest.filter(p => {
        if (!p.experience?.destination) return false;
        const planDestId = p.experience.destination._id || p.experience.destination;
        return String(planDestId) === String(destination._id) ||
          (p.experience.destination.country && destination.country &&
           p.experience.destination.country.toLowerCase() === destination.country.toLowerCase());
      }).slice(0, 3);
      if (relatedPlans.length > 0) {
        lines.push('\nYour other plans nearby:');
        for (const p of relatedPlans) {
          const expName = p.experience?.name || '(unnamed)';
          const destName = p.experience?.destination?.name || destination.name;
          const tag = computePlanProximityTag(p);
          lines.push(`  ${expName} (${destName})${tag}`);
        }
      }
    } catch (crossErr) {
      logger.debug('[bienbot-context] Cross-entity destination plans skipped', { error: crossErr.message });
    }

    // Disambiguation: list experiences at this destination
    try {
      const disambigBlock = await buildDisambiguationBlock('experience', userId, {
        destinationId: destination._id.toString(),
        destinationName: destination.name,
      });
      if (disambigBlock) lines.push('\n' + disambigBlock);
    } catch (dErr) {
      logger.debug('[bienbot-context] Destination disambiguation skipped', { error: dErr.message });
    }

    // Attention signals
    try {
      const signals = [];
      const today = new Date(); today.setHours(0, 0, 0, 0);

      // Reuse userPlansForDest fetched above — filter to exact destination ID match
      const destPlans = userPlansForDest.filter(p => {
        const dId = p.experience?.destination?._id || p.experience?.destination;
        return dId && String(dId) === String(destination._id);
      });

      if (destPlans.length === 0) {
        signals.push('⚠ You have no plans here yet');
      } else {
        const futurePlans = destPlans.filter(p => p.planned_date && new Date(p.planned_date) >= today);
        const pastPlans = destPlans.filter(p => !p.planned_date || new Date(p.planned_date) < today);

        if (futurePlans.length === 0 && pastPlans.length > 0) {
          signals.push('⚠ All your plans here are past — time for another visit?');
        } else if (futurePlans.length >= 2) {
          signals.push(`⚠ You have ${futurePlans.length} upcoming plans here`);
        }
      }

      const attentionBlock = renderAttentionBlock(signals);
      if (attentionBlock) lines.push(attentionBlock);
    } catch (sigErr) {
      logger.debug('[bienbot-context] Destination attention signals skipped', { error: sigErr.message });
    }

    return trimToTokenBudget(lines.filter(Boolean).join('\n'), options.tokenBudget || DEFAULT_TOKEN_BUDGET);
  } catch (err) {
    logger.error('[bienbot-context] buildDestinationContext failed', { destinationId, error: err.message });
    return null;
  }
}

module.exports = { buildDestinationContext };

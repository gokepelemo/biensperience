/**
 * AI Admin Controller
 *
 * CRUD operations for AI provider configs, policies, usage analytics,
 * and task routing. All endpoints require super admin + ai_admin flag.
 *
 * @module controllers/api/ai-admin
 */

const mongoose = require('mongoose');
const logger = require('../../utilities/backend-logger');
const { successResponse, errorResponse, validateObjectId } = require('../../utilities/controller-helpers');
const { invalidateConfigCache } = require('../../utilities/ai-provider-registry');
const { invalidatePolicyCache } = require('../../utilities/ai-gateway');
const { INTENTS, retrainManager, invalidateConfigCache: invalidateClassifierConfigCache } = require('../../utilities/bienbot-intent-classifier');
const AIProviderConfig = require('../../models/ai-provider-config');
const AIPolicy = require('../../models/ai-policy');
const AIUsage = require('../../models/ai-usage');
const IntentCorpus = require('../../models/intent-corpus');
const IntentClassificationLog = require('../../models/intent-classification-log');
const IntentClassifierConfig = require('../../models/intent-classifier-config');
const { DEFAULT_PROVIDERS } = require('../../utilities/ai-seed-providers');

// ============================================================================
// Providers
// ============================================================================

/**
 * GET /api/ai-admin/providers
 * List all provider configurations.
 * Merges DB records with known defaults so all providers always appear.
 * Adds a `configured` field indicating whether the env var is set.
 */
exports.listProviders = async (req, res) => {
  try {
    const dbProviders = await AIProviderConfig.find({}).sort({ priority: 1 }).lean();
    const dbByKey = new Map(dbProviders.map(p => [p.provider, p]));

    const providers = DEFAULT_PROVIDERS.map(def => {
      const db = dbByKey.get(def.provider);
      const merged = db || { ...def, _id: null };
      merged.configured = !!process.env[merged.env_key_name];
      return merged;
    });

    // Include any DB-only providers not in defaults (future-proofing)
    for (const dbP of dbProviders) {
      if (!DEFAULT_PROVIDERS.some(d => d.provider === dbP.provider)) {
        dbP.configured = !!process.env[dbP.env_key_name];
        providers.push(dbP);
      }
    }

    providers.sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
    return successResponse(res, { providers });
  } catch (err) {
    logger.error('[ai-admin] Failed to list providers', { error: err.message });
    return errorResponse(res, err, 'Failed to list providers', 500);
  }
};

/**
 * GET /api/ai-admin/providers/:id
 * Get a single provider configuration.
 */
exports.getProvider = async (req, res) => {
  const { id } = req.params;
  const { valid } = validateObjectId(id, 'provider ID');
  if (!valid) return errorResponse(res, null, 'Invalid provider ID', 400);

  try {
    const provider = await AIProviderConfig.findById(id).lean();
    if (!provider) return errorResponse(res, null, 'Provider not found', 404);
    return successResponse(res, { provider });
  } catch (err) {
    logger.error('[ai-admin] Failed to get provider', { error: err.message, id });
    return errorResponse(res, err, 'Failed to get provider', 500);
  }
};

/**
 * POST /api/ai-admin/providers
 * Create a new provider configuration.
 */
exports.createProvider = async (req, res) => {
  try {
    const { provider, display_name, endpoint, api_version, default_model, valid_models, enabled, priority, env_key_name } = req.body;
    const data = {
      provider, display_name, endpoint, api_version, default_model, valid_models, enabled, priority, env_key_name,
      created_by: req.user._id,
      updated_by: req.user._id
    };

    const createdProvider = await AIProviderConfig.create(data);
    invalidateConfigCache();

    logger.info('[ai-admin] Provider created', { provider: createdProvider.provider, by: req.user._id });
    return successResponse(res, { provider: createdProvider }, 201);
  } catch (err) {
    if (err.code === 11000) {
      return errorResponse(res, null, 'Provider already exists', 409);
    }
    logger.error('[ai-admin] Failed to create provider', { error: err.message });
    return errorResponse(res, err, 'Failed to create provider', 500);
  }
};

/**
 * PUT /api/ai-admin/providers/:id
 * Update a provider configuration.
 */
exports.updateProvider = async (req, res) => {
  const { id } = req.params;
  const { valid, objectId: providerOid } = validateObjectId(id, 'provider ID');
  if (!valid) return errorResponse(res, null, 'Invalid provider ID', 400);

  try {
    // Explicitly pick allowed fields to prevent MongoDB operator injection
    const { display_name, endpoint, api_version, default_model, valid_models, enabled, priority, env_key_name } = req.body;
    const updateData = {
      ...(display_name !== undefined && { display_name }),
      ...(endpoint !== undefined && { endpoint }),
      ...(api_version !== undefined && { api_version }),
      ...(default_model !== undefined && { default_model }),
      ...(valid_models !== undefined && { valid_models }),
      ...(enabled !== undefined && { enabled }),
      ...(priority !== undefined && { priority }),
      ...(env_key_name !== undefined && { env_key_name }),
      updated_by: req.user._id
    };

    const provider = await AIProviderConfig.findByIdAndUpdate(providerOid, { $set: updateData }, { new: true, runValidators: true }).lean();
    if (!provider) return errorResponse(res, null, 'Provider not found', 404);

    invalidateConfigCache();

    logger.info('[ai-admin] Provider updated', { provider: provider.provider, by: req.user._id });
    return successResponse(res, { provider });
  } catch (err) {
    logger.error('[ai-admin] Failed to update provider', { error: err.message, id });
    return errorResponse(res, err, 'Failed to update provider', 500);
  }
};

/**
 * PUT /api/ai-admin/providers/reorder
 * Set provider priority by drag order. Accepts { orderedProviders: ['openai', 'anthropic', ...] }.
 * Priority is assigned as array index (0 = highest priority / first fallback).
 */
exports.reorderProviders = async (req, res) => {
  const { orderedProviders } = req.body;
  if (!Array.isArray(orderedProviders) || orderedProviders.length === 0) {
    return errorResponse(res, null, 'orderedProviders must be a non-empty array', 400);
  }

  try {
    const bulkOps = orderedProviders.map((providerKey, index) => {
      const defaultDef = DEFAULT_PROVIDERS.find(d => d.provider === providerKey) || {};
      return {
        updateOne: {
          filter: { provider: providerKey },
          update: {
            $set: { priority: index, updated_by: req.user._id },
            $setOnInsert: {
              display_name: defaultDef.display_name || providerKey,
              endpoint: defaultDef.endpoint || '',
              default_model: defaultDef.default_model || '',
              valid_models: defaultDef.valid_models || [],
              enabled: defaultDef.enabled !== undefined ? defaultDef.enabled : true,
              env_key_name: defaultDef.env_key_name || `${providerKey.toUpperCase()}_API_KEY`,
              created_by: req.user._id
            }
          },
          upsert: true
        }
      };
    });

    await AIProviderConfig.bulkWrite(bulkOps);
    invalidateConfigCache();

    logger.info('[ai-admin] Providers reordered', { order: orderedProviders, by: req.user._id });
    return successResponse(res, { orderedProviders });
  } catch (err) {
    logger.error('[ai-admin] Failed to reorder providers', { error: err.message });
    return errorResponse(res, err, 'Failed to reorder providers', 500);
  }
};

// ============================================================================
// Policies
// ============================================================================

/**
 * GET /api/ai-admin/policies
 * List all policies (global + user-scoped).
 */
exports.listPolicies = async (req, res) => {
  try {
    const policies = await AIPolicy.find({}).sort({ scope: 1, name: 1 }).populate('target', 'name email').lean();
    return successResponse(res, { policies });
  } catch (err) {
    logger.error('[ai-admin] Failed to list policies', { error: err.message });
    return errorResponse(res, err, 'Failed to list policies', 500);
  }
};

/**
 * GET /api/ai-admin/policies/:id
 * Get a single policy.
 */
exports.getPolicy = async (req, res) => {
  const { id } = req.params;
  const { valid } = validateObjectId(id, 'policy ID');
  if (!valid) return errorResponse(res, null, 'Invalid policy ID', 400);

  try {
    const policy = await AIPolicy.findById(id).populate('target', 'name email').lean();
    if (!policy) return errorResponse(res, null, 'Policy not found', 404);
    return successResponse(res, { policy });
  } catch (err) {
    logger.error('[ai-admin] Failed to get policy', { error: err.message, id });
    return errorResponse(res, err, 'Failed to get policy', 500);
  }
};

/**
 * POST /api/ai-admin/policies
 * Create a policy (global or user-scoped).
 */
exports.createPolicy = async (req, res) => {
  try {
    const data = req.body;
    data.created_by = req.user._id;
    data.updated_by = req.user._id;

    // Validate target for user-scoped policies
    if (data.scope === 'user' && !data.target) {
      return errorResponse(res, null, 'User-scoped policies require a target user ID', 400);
    }
    if (data.scope === 'global') {
      data.target = null;
    }

    const policy = await AIPolicy.create(data);
    invalidatePolicyCache();

    logger.info('[ai-admin] Policy created', { policyId: policy._id, scope: policy.scope, by: req.user._id });
    return successResponse(res, { policy }, 201);
  } catch (err) {
    if (err.code === 11000) {
      return errorResponse(res, null, 'A policy with this scope and target already exists', 409);
    }
    logger.error('[ai-admin] Failed to create policy', { error: err.message });
    return errorResponse(res, err, 'Failed to create policy', 500);
  }
};

/**
 * PUT /api/ai-admin/policies/:id
 * Update a policy.
 */
exports.updatePolicy = async (req, res) => {
  const { id } = req.params;
  const { valid, objectId: policyOid } = validateObjectId(id, 'policy ID');
  if (!valid) return errorResponse(res, null, 'Invalid policy ID', 400);

  try {
    // Explicitly pick allowed fields to prevent MongoDB operator injection
    const {
      name, allowed_providers, blocked_providers, fallback_providers, allowed_models,
      rate_limits, token_budget, task_routing, content_filtering, max_tokens_per_request, active
    } = req.body;
    const updateData = {
      ...(name !== undefined && { name }),
      ...(allowed_providers !== undefined && { allowed_providers }),
      ...(blocked_providers !== undefined && { blocked_providers }),
      ...(fallback_providers !== undefined && { fallback_providers }),
      ...(allowed_models !== undefined && { allowed_models }),
      ...(rate_limits !== undefined && { rate_limits }),
      ...(token_budget !== undefined && { token_budget }),
      ...(task_routing !== undefined && { task_routing }),
      ...(content_filtering !== undefined && { content_filtering }),
      ...(max_tokens_per_request !== undefined && { max_tokens_per_request }),
      ...(active !== undefined && { active }),
      updated_by: req.user._id
    };

    const policy = await AIPolicy.findByIdAndUpdate(policyOid, { $set: updateData }, { new: true, runValidators: true }).lean();
    if (!policy) return errorResponse(res, null, 'Policy not found', 404);

    invalidatePolicyCache();

    logger.info('[ai-admin] Policy updated', { policyId: id, by: req.user._id, changedFields: Object.keys(req.body) });
    return successResponse(res, { policy });
  } catch (err) {
    logger.error('[ai-admin] Failed to update policy', { error: err.message, id });
    return errorResponse(res, err, 'Failed to update policy', 500);
  }
};

/**
 * DELETE /api/ai-admin/policies/:id
 * Deactivate a policy (soft delete).
 */
exports.deletePolicy = async (req, res) => {
  const { id } = req.params;
  const { valid } = validateObjectId(id, 'policy ID');
  if (!valid) return errorResponse(res, null, 'Invalid policy ID', 400);

  try {
    const policy = await AIPolicy.findByIdAndUpdate(id, { active: false, updated_by: req.user._id }, { new: true }).lean();
    if (!policy) return errorResponse(res, null, 'Policy not found', 404);

    invalidatePolicyCache();

    logger.info('[ai-admin] Policy deactivated', { policyId: id, by: req.user._id });
    return successResponse(res, { message: 'Policy deactivated' });
  } catch (err) {
    logger.error('[ai-admin] Failed to delete policy', { error: err.message, id });
    return errorResponse(res, err, 'Failed to delete policy', 500);
  }
};

// ============================================================================
// Usage Analytics
// ============================================================================

/**
 * GET /api/ai-admin/usage/summary
 * Dashboard summary (totals across all users).
 */
exports.getUsageSummary = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const daysNum = Math.min(parseInt(days, 10) || 30, 90);

    const startDate = new Date();
    startDate.setUTCDate(startDate.getUTCDate() - daysNum);
    startDate.setUTCHours(0, 0, 0, 0);

    const [summary] = await AIUsage.aggregate([
      { $match: { date: { $gte: startDate } } },
      {
        $group: {
          _id: null,
          total_requests: { $sum: '$total_requests' },
          total_input_tokens: { $sum: '$total_input_tokens' },
          total_output_tokens: { $sum: '$total_output_tokens' },
          total_cost_estimate: { $sum: '$total_cost_estimate' },
          unique_users: { $addToSet: '$user' }
        }
      },
      {
        $project: {
          _id: 0,
          total_requests: 1,
          total_input_tokens: 1,
          total_output_tokens: 1,
          total_cost_estimate: 1,
          unique_users: { $size: '$unique_users' }
        }
      }
    ]);

    // Daily breakdown for chart
    const dailyBreakdown = await AIUsage.aggregate([
      { $match: { date: { $gte: startDate } } },
      {
        $group: {
          _id: '$date',
          requests: { $sum: '$total_requests' },
          input_tokens: { $sum: '$total_input_tokens' },
          output_tokens: { $sum: '$total_output_tokens' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Per-provider totals (unwind providers sub-array)
    const providerBreakdown = await AIUsage.aggregate([
      { $match: { date: { $gte: startDate } } },
      { $unwind: '$providers' },
      {
        $group: {
          _id: '$providers.provider',
          requests: { $sum: '$providers.requests' },
          input_tokens: { $sum: '$providers.input_tokens' },
          output_tokens: { $sum: '$providers.output_tokens' }
        }
      },
      { $sort: { requests: -1 } }
    ]);

    // Per-provider daily breakdown
    const providerDaily = await AIUsage.aggregate([
      { $match: { date: { $gte: startDate } } },
      { $unwind: '$providers' },
      {
        $group: {
          _id: { date: '$date', provider: '$providers.provider' },
          requests: { $sum: '$providers.requests' },
          input_tokens: { $sum: '$providers.input_tokens' },
          output_tokens: { $sum: '$providers.output_tokens' }
        }
      },
      { $sort: { '_id.date': 1 } }
    ]);

    return successResponse(res, {
      summary: summary || {
        total_requests: 0,
        total_input_tokens: 0,
        total_output_tokens: 0,
        total_cost_estimate: 0,
        unique_users: 0
      },
      daily: dailyBreakdown,
      provider_breakdown: providerBreakdown,
      provider_daily: providerDaily,
      period_days: daysNum
    });
  } catch (err) {
    logger.error('[ai-admin] Failed to get usage summary', { error: err.message });
    return errorResponse(res, err, 'Failed to get usage summary', 500);
  }
};

/**
 * GET /api/ai-admin/usage
 * Aggregated usage (filterable by date range and user).
 */
exports.getUsage = async (req, res) => {
  try {
    const { startDate, endDate, userId, limit = 50, offset = 0 } = req.query;

    const match = {};
    if (startDate || endDate) {
      match.date = {};
      if (startDate) match.date.$gte = new Date(startDate);
      if (endDate) match.date.$lte = new Date(endDate);
    }
    if (userId) {
      const { valid } = validateObjectId(userId, 'userId');
      if (valid) {
        match.user = new mongoose.Types.ObjectId(userId);
      }
    }

    const usage = await AIUsage.find(match)
      .sort({ date: -1 })
      .skip(parseInt(offset, 10) || 0)
      .limit(Math.min(parseInt(limit, 10) || 50, 100))
      .populate('user', 'name email')
      .lean();

    const total = await AIUsage.countDocuments(match);

    return successResponse(res, { usage, total });
  } catch (err) {
    logger.error('[ai-admin] Failed to get usage', { error: err.message });
    return errorResponse(res, err, 'Failed to get usage', 500);
  }
};

/**
 * GET /api/ai-admin/usage/users/:userId
 * Usage for a specific user.
 */
exports.getUserUsage = async (req, res) => {
  const { userId } = req.params;
  const { valid, objectId: userOid } = validateObjectId(userId, 'user ID');
  if (!valid) return errorResponse(res, null, 'Invalid user ID', 400);

  try {
    const { days = 30 } = req.query;
    const daysNum = Math.min(parseInt(days, 10) || 30, 90);

    const startDate = new Date();
    startDate.setUTCDate(startDate.getUTCDate() - daysNum);
    startDate.setUTCHours(0, 0, 0, 0);

    const usage = await AIUsage.find({
      user: userOid,
      date: { $gte: startDate }
    }).sort({ date: -1 }).lean();

    const monthly = await AIUsage.getMonthlyUsage(userId);

    return successResponse(res, { usage, monthly, period_days: daysNum });
  } catch (err) {
    logger.error('[ai-admin] Failed to get user usage', { error: err.message, userId });
    return errorResponse(res, err, 'Failed to get user usage', 500);
  }
};

// ============================================================================
// Routing Configuration
// ============================================================================

/**
 * GET /api/ai-admin/routing
 * Get the global task routing configuration from the global policy.
 */
exports.getRouting = async (req, res) => {
  try {
    const globalPolicy = await AIPolicy.findOne({ scope: 'global', active: true }).lean();

    return successResponse(res, {
      task_routing: globalPolicy?.task_routing || [],
      default_provider: process.env.AI_DEFAULT_PROVIDER || 'openai',
      available_intents: Object.values(INTENTS),
      env_routing: {
        autocomplete: process.env.AI_AUTOCOMPLETE_PROVIDER || null,
        edit_language: process.env.AI_EDIT_PROVIDER || null,
        improve_description: process.env.AI_IMPROVE_PROVIDER || null,
        summarize: process.env.AI_SUMMARIZE_PROVIDER || null,
        generate_tips: process.env.AI_TIPS_PROVIDER || null,
        translate: process.env.AI_TRANSLATE_PROVIDER || null
      }
    });
  } catch (err) {
    logger.error('[ai-admin] Failed to get routing', { error: err.message });
    return errorResponse(res, err, 'Failed to get routing', 500);
  }
};

/**
 * PUT /api/ai-admin/routing
 * Update global task routing in the global policy.
 */
exports.updateRouting = async (req, res) => {
  try {
    const { task_routing } = req.body;

    if (!Array.isArray(task_routing)) {
      return errorResponse(res, null, 'task_routing must be an array', 400);
    }

    // Validate each rule has at least task or intent, and always has provider
    for (const rule of task_routing) {
      if (!rule.task && !rule.intent) {
        return errorResponse(res, null, 'Each routing rule must specify a task, an intent, or both', 400);
      }
      if (!rule.provider) {
        return errorResponse(res, null, 'Each routing rule must specify a provider', 400);
      }
    }

    const globalPolicy = await AIPolicy.findOneAndUpdate(
      { scope: 'global' },
      { $set: { task_routing, updated_by: req.user._id } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    invalidatePolicyCache();

    logger.info('[ai-admin] Routing updated', { rules: task_routing.length, by: req.user._id });
    return successResponse(res, { task_routing: globalPolicy.task_routing });
  } catch (err) {
    logger.error('[ai-admin] Failed to update routing', { error: err.message });
    return errorResponse(res, err, 'Failed to update routing', 500);
  }
};

// ============================================================================
// Intent Corpus
// ============================================================================

/**
 * GET /api/ai-admin/corpus
 * List all intents with utterance counts.
 */
exports.listCorpus = async (req, res) => {
  try {
    const intents = await IntentCorpus.find({})
      .sort({ intent: 1 })
      .lean();

    const result = intents.map(i => ({
      _id: i._id,
      intent: i.intent,
      description: i.description,
      utterance_count: i.utterances.length,
      is_custom: i.is_custom,
      enabled: i.enabled,
      updatedAt: i.updatedAt
    }));

    return successResponse(res, { intents: result, total: result.length });
  } catch (err) {
    logger.error('[ai-admin] Failed to list corpus', { error: err.message });
    return errorResponse(res, err, 'Failed to list corpus', 500);
  }
};

/**
 * GET /api/ai-admin/corpus/:intent
 * Get a single intent with all utterances.
 */
exports.getCorpusIntent = async (req, res) => {
  try {
    const doc = await IntentCorpus.findOne({ intent: req.params.intent.toUpperCase() }).lean();
    if (!doc) {
      return errorResponse(res, null, 'Intent not found', 404);
    }
    return successResponse(res, { intent: doc });
  } catch (err) {
    logger.error('[ai-admin] Failed to get corpus intent', { error: err.message });
    return errorResponse(res, err, 'Failed to get corpus intent', 500);
  }
};

/**
 * POST /api/ai-admin/corpus
 * Create a new intent.
 */
exports.createCorpusIntent = async (req, res) => {
  try {
    const { intent, utterances, description } = req.body;

    if (!intent || typeof intent !== 'string') {
      return errorResponse(res, null, 'Intent name is required', 400);
    }

    const intentKey = intent.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
    if (!intentKey || intentKey.length < 2) {
      return errorResponse(res, null, 'Invalid intent name', 400);
    }

    const existing = await IntentCorpus.findOne({ intent: intentKey });
    if (existing) {
      return errorResponse(res, null, 'Intent already exists', 409);
    }

    const doc = await IntentCorpus.create({
      intent: intentKey,
      utterances: Array.isArray(utterances) ? utterances.filter(u => typeof u === 'string' && u.trim()) : [],
      description: description || '',
      is_custom: true,
      enabled: true,
      created_by: req.user._id,
      updated_by: req.user._id
    });

    logger.info('[ai-admin] Corpus intent created', { intent: intentKey, by: req.user._id });
    return successResponse(res, { intent: doc });
  } catch (err) {
    logger.error('[ai-admin] Failed to create corpus intent', { error: err.message });
    return errorResponse(res, err, 'Failed to create corpus intent', 500);
  }
};

/**
 * PUT /api/ai-admin/corpus/:intent
 * Update an intent (utterances, description, enabled).
 */
exports.updateCorpusIntent = async (req, res) => {
  try {
    const intentKey = req.params.intent.toUpperCase();
    const doc = await IntentCorpus.findOne({ intent: intentKey });
    if (!doc) {
      return errorResponse(res, null, 'Intent not found', 404);
    }

    const { utterances, description, enabled } = req.body;

    if (utterances !== undefined) {
      if (!Array.isArray(utterances)) {
        return errorResponse(res, null, 'utterances must be an array', 400);
      }
      doc.utterances = utterances.filter(u => typeof u === 'string' && u.trim());
    }
    if (description !== undefined) {
      doc.description = String(description).slice(0, 500);
    }
    if (enabled !== undefined) {
      doc.enabled = !!enabled;
    }
    doc.updated_by = req.user._id;

    await doc.save();

    logger.info('[ai-admin] Corpus intent updated', { intent: intentKey, by: req.user._id });
    return successResponse(res, { intent: doc });
  } catch (err) {
    logger.error('[ai-admin] Failed to update corpus intent', { error: err.message });
    return errorResponse(res, err, 'Failed to update corpus intent', 500);
  }
};

/**
 * DELETE /api/ai-admin/corpus/:intent
 * Delete a custom intent. Seeded intents can only be disabled, not deleted.
 */
exports.deleteCorpusIntent = async (req, res) => {
  try {
    const intentKey = req.params.intent.toUpperCase();
    const doc = await IntentCorpus.findOne({ intent: intentKey });
    if (!doc) {
      return errorResponse(res, null, 'Intent not found', 404);
    }

    if (!doc.is_custom) {
      return errorResponse(res, null, 'Seeded intents cannot be deleted. Disable them instead.', 400);
    }

    await IntentCorpus.deleteOne({ _id: doc._id });

    logger.info('[ai-admin] Corpus intent deleted', { intent: intentKey, by: req.user._id });
    return successResponse(res, { deleted: true, intent: intentKey });
  } catch (err) {
    logger.error('[ai-admin] Failed to delete corpus intent', { error: err.message });
    return errorResponse(res, err, 'Failed to delete corpus intent', 500);
  }
};

/**
 * POST /api/ai-admin/corpus/retrain
 * Trigger NLP model retraining from current DB corpus.
 */
exports.retrainClassifier = async (req, res) => {
  try {
    const stats = await retrainManager();
    logger.info('[ai-admin] Classifier retrained', { ...stats, by: req.user._id });
    return successResponse(res, { retrained: true, ...stats });
  } catch (err) {
    logger.error('[ai-admin] Failed to retrain classifier', { error: err.message });
    return errorResponse(res, err, 'Failed to retrain classifier', 500);
  }
};

// ============================================================================
// Classification Logs
// ============================================================================

/**
 * GET /api/ai-admin/classifications
 * List classification logs with filters.
 */
exports.listClassifications = async (req, res) => {
  try {
    const {
      low_confidence,
      reviewed,
      intent,
      start_date,
      end_date,
      page = 1,
      limit = 50
    } = req.query;

    const filter = {};

    if (low_confidence === 'true') filter.is_low_confidence = true;
    if (reviewed === 'true') filter.reviewed = true;
    if (reviewed === 'false') filter.reviewed = false;
    if (intent) filter.intent = intent.toUpperCase();

    if (start_date || end_date) {
      filter.createdAt = {};
      if (start_date) filter.createdAt.$gte = new Date(start_date);
      if (end_date) filter.createdAt.$lte = new Date(end_date);
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * pageSize;

    const [logs, total] = await Promise.all([
      IntentClassificationLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean(),
      IntentClassificationLog.countDocuments(filter)
    ]);

    return successResponse(res, {
      logs,
      total,
      page: pageNum,
      pages: Math.ceil(total / pageSize)
    });
  } catch (err) {
    logger.error('[ai-admin] Failed to list classifications', { error: err.message });
    return errorResponse(res, err, 'Failed to list classifications', 500);
  }
};

/**
 * GET /api/ai-admin/classifications/summary
 * Aggregated classification stats.
 */
exports.getClassificationSummary = async (req, res) => {
  try {
    const days = Math.min(90, Math.max(1, parseInt(req.query.days, 10) || 30));
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [totals, intentBreakdown, lowConfidenceIntents] = await Promise.all([
      IntentClassificationLog.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            low_confidence: { $sum: { $cond: ['$is_low_confidence', 1, 0] } },
            unreviewed: { $sum: { $cond: [{ $and: ['$is_low_confidence', { $not: '$reviewed' }] }, 1, 0] } },
            llm_reclassified: { $sum: { $cond: ['$llm_reclassified', 1, 0] } },
            avg_confidence: { $avg: '$confidence' }
          }
        }
      ]),
      IntentClassificationLog.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$intent', count: { $sum: 1 }, avg_confidence: { $avg: '$confidence' } } },
        { $sort: { count: -1 } },
        { $limit: 20 }
      ]),
      IntentClassificationLog.aggregate([
        { $match: { createdAt: { $gte: since }, is_low_confidence: true } },
        { $group: { _id: '$intent', count: { $sum: 1 }, avg_confidence: { $avg: '$confidence' } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ])
    ]);

    const summary = totals[0] || { total: 0, low_confidence: 0, unreviewed: 0, llm_reclassified: 0, avg_confidence: 0 };

    return successResponse(res, {
      days,
      ...summary,
      intent_breakdown: intentBreakdown,
      low_confidence_intents: lowConfidenceIntents
    });
  } catch (err) {
    logger.error('[ai-admin] Failed to get classification summary', { error: err.message });
    return errorResponse(res, err, 'Failed to get classification summary', 500);
  }
};

/**
 * PUT /api/ai-admin/classifications/:id/review
 * Mark a classification as reviewed, optionally set corrected intent.
 */
exports.reviewClassification = async (req, res) => {
  try {
    const { valid: classIdValid, objectId: classOid } = validateObjectId(req.params.id, 'classification ID');
    if (!classIdValid) {
      return errorResponse(res, null, 'Invalid classification ID', 400);
    }

    const log = await IntentClassificationLog.findById(classOid);
    if (!log) {
      return errorResponse(res, null, 'Classification log not found', 404);
    }

    const { corrected_intent } = req.body;

    log.reviewed = true;
    log.reviewed_by = req.user._id;
    log.reviewed_at = new Date();
    if (corrected_intent) {
      log.admin_corrected_intent = corrected_intent.toUpperCase();
    }

    await log.save();

    logger.info('[ai-admin] Classification reviewed', {
      logId: log._id,
      corrected: corrected_intent || null,
      by: req.user._id
    });
    return successResponse(res, { log });
  } catch (err) {
    logger.error('[ai-admin] Failed to review classification', { error: err.message });
    return errorResponse(res, err, 'Failed to review classification', 500);
  }
};

/**
 * POST /api/ai-admin/classifications/batch-add
 * Add reviewed corrections as utterances to the corpus.
 * Expects { corrections: [{ log_id, intent, utterance }] }
 */
exports.batchAddToCorpus = async (req, res) => {
  try {
    const { corrections } = req.body;
    if (!Array.isArray(corrections) || corrections.length === 0) {
      return errorResponse(res, null, 'corrections array is required', 400);
    }

    const results = [];
    for (const { log_id, intent, utterance } of corrections) {
      if (!intent || !utterance) continue;

      const intentKey = intent.toUpperCase();
      const doc = await IntentCorpus.findOne({ intent: intentKey });
      if (!doc) {
        results.push({ intent: intentKey, utterance, status: 'intent_not_found' });
        continue;
      }

      const trimmed = utterance.trim();
      if (doc.utterances.includes(trimmed)) {
        results.push({ intent: intentKey, utterance: trimmed, status: 'duplicate' });
        continue;
      }

      doc.utterances.push(trimmed);
      doc.updated_by = req.user._id;
      await doc.save();

      // Mark log as reviewed if log_id provided
      if (log_id) {
        const { valid: logIdValid, objectId: logOid } = validateObjectId(log_id, 'log_id');
        if (logIdValid) await IntentClassificationLog.findByIdAndUpdate(logOid, {
          reviewed: true,
          reviewed_by: req.user._id,
          reviewed_at: new Date(),
          admin_corrected_intent: intentKey
        });
      }

      results.push({ intent: intentKey, utterance: trimmed, status: 'added' });
    }

    logger.info('[ai-admin] Batch corpus add', {
      total: corrections.length,
      added: results.filter(r => r.status === 'added').length,
      by: req.user._id
    });

    return successResponse(res, { results });
  } catch (err) {
    logger.error('[ai-admin] Failed to batch add to corpus', { error: err.message });
    return errorResponse(res, err, 'Failed to batch add to corpus', 500);
  }
};

// ============================================================================
// Classifier Config
// ============================================================================

/**
 * GET /api/ai-admin/classifier-config
 * Get the singleton classifier config.
 */
exports.getClassifierConfig = async (req, res) => {
  try {
    const config = await IntentClassifierConfig.getConfig();
    return successResponse(res, { config });
  } catch (err) {
    logger.error('[ai-admin] Failed to get classifier config', { error: err.message });
    return errorResponse(res, err, 'Failed to get classifier config', 500);
  }
};

/**
 * PUT /api/ai-admin/classifier-config
 * Update classifier config (thresholds, toggles).
 */
exports.updateClassifierConfig = async (req, res) => {
  try {
    const allowedFields = [
      'low_confidence_threshold',
      'llm_fallback_enabled',
      'llm_fallback_threshold',
      'log_all_classifications',
      'log_retention_days'
    ];

    const fieldTypes = {
      low_confidence_threshold: 'number',
      llm_fallback_enabled: 'boolean',
      llm_fallback_threshold: 'number',
      log_all_classifications: 'boolean',
      log_retention_days: 'number'
    };

    const update = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        const type = fieldTypes[field];
        if (type === 'number') {
          const n = Number(req.body[field]);
          if (!isNaN(n)) update[field] = n;
        } else if (type === 'boolean') {
          update[field] = Boolean(req.body[field]);
        }
      }
    }
    update.updated_by = req.user._id;

    const config = await IntentClassifierConfig.findOneAndUpdate(
      {},
      update,
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );

    invalidateClassifierConfigCache();

    logger.info('[ai-admin] Classifier config updated', { fields: Object.keys(update), by: req.user._id });
    return successResponse(res, { config });
  } catch (err) {
    logger.error('[ai-admin] Failed to update classifier config', { error: err.message });
    return errorResponse(res, err, 'Failed to update classifier config', 500);
  }
};

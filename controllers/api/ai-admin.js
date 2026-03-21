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
const { INTENTS } = require('../../utilities/bienbot-intent-classifier');
const AIProviderConfig = require('../../models/ai-provider-config');
const AIPolicy = require('../../models/ai-policy');
const AIUsage = require('../../models/ai-usage');
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
  const { valid } = validateObjectId(id, 'provider ID');
  if (!valid) return errorResponse(res, null, 'Invalid provider ID', 400);

  try {
    const updateData = { ...req.body, updated_by: req.user._id };
    // Don't allow changing the provider key itself
    delete updateData.provider;
    delete updateData.created_by;

    const provider = await AIProviderConfig.findByIdAndUpdate(id, updateData, { new: true, runValidators: true }).lean();
    if (!provider) return errorResponse(res, null, 'Provider not found', 404);

    invalidateConfigCache();

    logger.info('[ai-admin] Provider updated', { provider: provider.provider, by: req.user._id });
    return successResponse(res, { provider });
  } catch (err) {
    logger.error('[ai-admin] Failed to update provider', { error: err.message, id });
    return errorResponse(res, err, 'Failed to update provider', 500);
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
  const { valid } = validateObjectId(id, 'policy ID');
  if (!valid) return errorResponse(res, null, 'Invalid policy ID', 400);

  try {
    const updateData = { ...req.body, updated_by: req.user._id };
    // Don't allow changing scope/target via update
    delete updateData.scope;
    delete updateData.target;
    delete updateData.created_by;

    const policy = await AIPolicy.findByIdAndUpdate(id, updateData, { new: true, runValidators: true }).lean();
    if (!policy) return errorResponse(res, null, 'Policy not found', 404);

    invalidatePolicyCache();

    logger.info('[ai-admin] Policy updated', { policyId: id, by: req.user._id });
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
  const { valid } = validateObjectId(userId, 'user ID');
  if (!valid) return errorResponse(res, null, 'Invalid user ID', 400);

  try {
    const { days = 30 } = req.query;
    const daysNum = Math.min(parseInt(days, 10) || 30, 90);

    const startDate = new Date();
    startDate.setUTCDate(startDate.getUTCDate() - daysNum);
    startDate.setUTCHours(0, 0, 0, 0);

    const usage = await AIUsage.find({
      user: new mongoose.Types.ObjectId(userId),
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
      {
        task_routing,
        updated_by: req.user._id
      },
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

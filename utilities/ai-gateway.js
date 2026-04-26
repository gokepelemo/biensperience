/**
 * AI Gateway
 *
 * Central entry point for all AI LLM requests. Resolves policies, enforces
 * guardrails (rate limits, token budgets, content filtering), routes to the
 * correct provider/model, and tracks usage.
 *
 * Policy resolution chain (highest priority first):
 * 1. Entity ai_config (experience/plan)
 * 2. User-scoped policy
 * 3. Global policy
 * 4. Environment variable defaults
 *
 * @module utilities/ai-gateway
 */

const logger = require('./backend-logger');
const { callProvider, getApiKeyForProvider, getAllProviderConfigs } = require('./ai-provider-registry');

// Lazy model loading
let AIPolicy, AIUsage;
function loadModels() {
  if (!AIPolicy) {
    AIPolicy = require('../models/ai-policy');
    AIUsage = require('../models/ai-usage');
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POLICY_CACHE_TTL_MS = 5 * 60 * 1000;
const RATE_LIMIT_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const RATE_LIMIT_RETENTION_MS = 24 * 60 * 60 * 1000;
const MAX_RATE_ENTRIES_PER_USER = 10000;
const RATE_ENTRIES_TRIM_TARGET = 5000;
const DEFAULT_HEADROOM_TOKENS = 100;
const DEFAULT_MAX_TOKENS = 1000;
const DEFAULT_MAX_TOKENS_PER_REQUEST = 4000;
const DEFAULT_TEMPERATURE = 0.7;
const TEMPERATURE_MIN = 0;
const TEMPERATURE_MAX = 2;
const MS_PER_MINUTE = 60 * 1000;
const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Policy cache
// ---------------------------------------------------------------------------

let policyCacheMap = null;
let policyCacheTimestamp = 0;
let policyLoadPromise = null;

/**
 * Load all active policies into a cached map.
 * Concurrent first-callers share a single in-flight DB query.
 * @param {boolean} [forceRefresh]
 * @returns {Promise<{global: Object|null, users: Map<string, Object>}>}
 */
async function loadPolicies(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && policyCacheMap && (now - policyCacheTimestamp) < POLICY_CACHE_TTL_MS) {
    return policyCacheMap;
  }
  if (policyLoadPromise) return policyLoadPromise;

  policyLoadPromise = (async () => {
    try {
      loadModels();
      const docs = await AIPolicy.find({ active: true }).lean();

      let globalPolicy = null;
      const userPolicies = new Map();

      for (const doc of docs) {
        if (doc.scope === 'global') {
          globalPolicy = doc;
        } else if (doc.scope === 'user' && doc.target) {
          userPolicies.set(doc.target.toString(), doc);
        }
      }

      policyCacheMap = { global: globalPolicy, users: userPolicies };
      policyCacheTimestamp = Date.now();
      return policyCacheMap;
    } catch (err) {
      logger.warn('[ai-gateway] Failed to load policies from DB', { error: err.message });
      return policyCacheMap || { global: null, users: new Map() };
    } finally {
      policyLoadPromise = null;
    }
  })();

  return policyLoadPromise;
}

/**
 * Invalidate the policy cache. Call after admin updates.
 */
function invalidatePolicyCache() {
  policyCacheMap = null;
  policyCacheTimestamp = 0;
}

// ---------------------------------------------------------------------------
// Policy resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the effective policy for a request by merging the chain.
 *
 * @param {Object} params
 * @param {Object} [params.entityAIConfig] - Entity-level ai_config
 * @param {Object} [params.user] - User object (for user-scoped policy lookup)
 * @returns {Promise<Object>} Merged effective policy
 */
async function resolvePolicy({ entityAIConfig, user } = {}) {
  const policies = await loadPolicies();

  // Start with env-var defaults
  const effective = {
    allowed_providers: [],
    blocked_providers: [],
    allowed_models: [],
    fallback_providers: [],
    rate_limits: {
      requests_per_minute: null,
      requests_per_hour: null,
      requests_per_day: null
    },
    token_budget: {
      daily_input_tokens: null,
      daily_output_tokens: null,
      monthly_input_tokens: null,
      monthly_output_tokens: null
    },
    task_routing: [],
    content_filtering: { enabled: false, block_patterns: [], redact_patterns: [] },
    max_tokens_per_request: DEFAULT_MAX_TOKENS_PER_REQUEST,
    // Provider/model overrides from entity config
    preferred_provider: null,
    preferred_model: null,
    temperature: null,
    max_tokens: null,
    system_prompt_override: null,
    language: null,
    ai_disabled: false,
    // Snapshot of which layers contributed — captured at resolution time
    // so we don't have to re-inspect the cache later (avoids races).
    _meta: {
      hasGlobalPolicy: false,
      hasUserPolicy: false,
      hasEntityConfig: false
    }
  };

  // Layer 3: Global policy
  if (policies.global) {
    mergePolicy(effective, policies.global);
    effective._meta.hasGlobalPolicy = true;
  }

  // Layer 2: User-scoped policy
  if (user && user._id) {
    const userId = user._id.toString();
    const userPolicy = policies.users.get(userId);
    if (userPolicy) {
      mergePolicy(effective, userPolicy);
      effective._meta.hasUserPolicy = true;
    }
  }

  // Layer 1: Entity AI config (highest priority)
  if (entityAIConfig) {
    if (entityAIConfig.preferred_provider) effective.preferred_provider = entityAIConfig.preferred_provider;
    if (entityAIConfig.preferred_model) effective.preferred_model = entityAIConfig.preferred_model;
    if (entityAIConfig.temperature != null) effective.temperature = entityAIConfig.temperature;
    if (entityAIConfig.max_tokens != null) effective.max_tokens = entityAIConfig.max_tokens;
    if (entityAIConfig.system_prompt_override) effective.system_prompt_override = entityAIConfig.system_prompt_override;
    if (entityAIConfig.language) effective.language = entityAIConfig.language;
    if (entityAIConfig.disabled) effective.ai_disabled = true;
    effective._meta.hasEntityConfig = true;
  }

  return effective;
}

/**
 * Merge a policy document into the effective policy.
 * Non-null values from the source override the target.
 */
function mergePolicy(target, source) {
  if (source.allowed_providers && source.allowed_providers.length > 0) {
    target.allowed_providers = source.allowed_providers;
  }
  if (source.blocked_providers && source.blocked_providers.length > 0) {
    target.blocked_providers = source.blocked_providers;
  }
  if (source.fallback_providers && source.fallback_providers.length > 0) {
    target.fallback_providers = source.fallback_providers;
  }
  if (source.allowed_models && source.allowed_models.length > 0) {
    target.allowed_models = source.allowed_models;
  }

  // Rate limits — override individual fields if set
  if (source.rate_limits) {
    if (source.rate_limits.requests_per_minute != null) target.rate_limits.requests_per_minute = source.rate_limits.requests_per_minute;
    if (source.rate_limits.requests_per_hour != null) target.rate_limits.requests_per_hour = source.rate_limits.requests_per_hour;
    if (source.rate_limits.requests_per_day != null) target.rate_limits.requests_per_day = source.rate_limits.requests_per_day;
  }

  // Token budgets
  if (source.token_budget) {
    if (source.token_budget.daily_input_tokens != null) target.token_budget.daily_input_tokens = source.token_budget.daily_input_tokens;
    if (source.token_budget.daily_output_tokens != null) target.token_budget.daily_output_tokens = source.token_budget.daily_output_tokens;
    if (source.token_budget.monthly_input_tokens != null) target.token_budget.monthly_input_tokens = source.token_budget.monthly_input_tokens;
    if (source.token_budget.monthly_output_tokens != null) target.token_budget.monthly_output_tokens = source.token_budget.monthly_output_tokens;
  }

  // Task routing — replace entirely if source has entries
  if (source.task_routing && source.task_routing.length > 0) {
    target.task_routing = source.task_routing;
  }

  // Content filtering
  if (source.content_filtering) {
    if (source.content_filtering.enabled != null) target.content_filtering.enabled = source.content_filtering.enabled;
    if (source.content_filtering.block_patterns && source.content_filtering.block_patterns.length > 0) {
      target.content_filtering.block_patterns = source.content_filtering.block_patterns;
    }
    if (source.content_filtering.redact_patterns && source.content_filtering.redact_patterns.length > 0) {
      target.content_filtering.redact_patterns = source.content_filtering.redact_patterns;
    }
  }

  if (source.max_tokens_per_request != null) {
    target.max_tokens_per_request = source.max_tokens_per_request;
  }
}

// ---------------------------------------------------------------------------
// Rate limiting (in-memory sliding window)
// ---------------------------------------------------------------------------

const rateLimitStore = new Map();

// Periodic cleanup. Skipped under Jest so test runs aren't held open by
// a background timer; `unref()` is a belt-and-suspenders fallback when
// running outside Jest (Bun, Node test runners) since unref'd handles
// don't keep the event loop alive.
if (process.env.NODE_ENV !== 'test') {
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entries] of rateLimitStore) {
      const filtered = entries.filter(ts => now - ts < RATE_LIMIT_RETENTION_MS);
      if (filtered.length === 0) {
        rateLimitStore.delete(key);
      } else {
        rateLimitStore.set(key, filtered);
      }
    }
  }, RATE_LIMIT_CLEANUP_INTERVAL_MS);
  if (typeof cleanupTimer.unref === 'function') cleanupTimer.unref();
}

/**
 * Check rate limits for a user.
 * @param {string} userId
 * @param {Object} rateLimits - { requests_per_minute, requests_per_hour, requests_per_day }
 * @returns {{ allowed: boolean, reason: string|null, retryAfterMs: number|null }}
 */
function checkRateLimit(userId, rateLimits) {
  if (!userId || !rateLimits) return { allowed: true, reason: null, retryAfterMs: null };

  const key = `rate:${userId}`;
  const now = Date.now();
  const entries = rateLimitStore.get(key) || [];

  if (rateLimits.requests_per_minute != null) {
    const minuteCount = entries.filter(ts => now - ts < MS_PER_MINUTE).length;
    if (minuteCount >= rateLimits.requests_per_minute) {
      return { allowed: false, reason: 'Rate limit exceeded (per minute)', retryAfterMs: MS_PER_MINUTE };
    }
  }

  if (rateLimits.requests_per_hour != null) {
    const hourCount = entries.filter(ts => now - ts < MS_PER_HOUR).length;
    if (hourCount >= rateLimits.requests_per_hour) {
      return { allowed: false, reason: 'Rate limit exceeded (per hour)', retryAfterMs: MS_PER_HOUR };
    }
  }

  if (rateLimits.requests_per_day != null) {
    const dayCount = entries.filter(ts => now - ts < MS_PER_DAY).length;
    if (dayCount >= rateLimits.requests_per_day) {
      return { allowed: false, reason: 'Rate limit exceeded (per day)', retryAfterMs: MS_PER_DAY };
    }
  }

  return { allowed: true, reason: null, retryAfterMs: null };
}

/**
 * Record a request timestamp for rate limiting.
 */
function recordRateEntry(userId) {
  const key = `rate:${userId}`;
  let entries = rateLimitStore.get(key) || [];
  entries.push(Date.now());
  if (entries.length > MAX_RATE_ENTRIES_PER_USER) {
    entries = entries.slice(-RATE_ENTRIES_TRIM_TARGET);
  }
  rateLimitStore.set(key, entries);
}

// ---------------------------------------------------------------------------
// Token budget enforcement
// ---------------------------------------------------------------------------

/**
 * Check token budget for a user.
 *
 * Uses a headroom factor to preemptively block requests that would likely
 * exceed the budget once the response arrives. The estimate is conservative:
 * we assume the request will consume `maxTokens` output tokens and roughly
 * the same number of input tokens (messages + context).
 *
 * @param {string} userId
 * @param {Object} tokenBudget
 * @param {number} [estimatedMaxTokens=1000] - Expected max output tokens for the upcoming request
 * @returns {Promise<{ allowed: boolean, reason: string|null }>}
 */
async function checkTokenBudget(userId, tokenBudget, estimatedMaxTokens = DEFAULT_MAX_TOKENS) {
  if (!userId || !tokenBudget) return { allowed: true, reason: null };

  const hasDailyLimit = tokenBudget.daily_input_tokens != null || tokenBudget.daily_output_tokens != null;
  const hasMonthlyLimit = tokenBudget.monthly_input_tokens != null || tokenBudget.monthly_output_tokens != null;

  if (!hasDailyLimit && !hasMonthlyLimit) return { allowed: true, reason: null };

  // Conservative headroom: assume the request will use up to this many tokens.
  // The `>=` comparison below blocks one token early on purpose — this is a
  // pre-flight guard, not an exact accounting.
  const headroom = Math.max(estimatedMaxTokens, DEFAULT_HEADROOM_TOKENS);

  try {
    loadModels();

    if (hasDailyLimit) {
      const daily = await AIUsage.getDailyUsage(userId);
      if (daily) {
        if (tokenBudget.daily_input_tokens != null && (daily.total_input_tokens + headroom) >= tokenBudget.daily_input_tokens) {
          return { allowed: false, reason: 'Daily input token budget exceeded' };
        }
        if (tokenBudget.daily_output_tokens != null && (daily.total_output_tokens + headroom) >= tokenBudget.daily_output_tokens) {
          return { allowed: false, reason: 'Daily output token budget exceeded' };
        }
      }
    }

    if (hasMonthlyLimit) {
      const monthly = await AIUsage.getMonthlyUsage(userId);
      if (tokenBudget.monthly_input_tokens != null && (monthly.total_input_tokens + headroom) >= tokenBudget.monthly_input_tokens) {
        return { allowed: false, reason: 'Monthly input token budget exceeded' };
      }
      if (tokenBudget.monthly_output_tokens != null && (monthly.total_output_tokens + headroom) >= tokenBudget.monthly_output_tokens) {
        return { allowed: false, reason: 'Monthly output token budget exceeded' };
      }
    }

    return { allowed: true, reason: null };
  } catch (err) {
    logger.warn('[ai-gateway] Token budget check failed, allowing request', { error: err.message });
    return { allowed: true, reason: null };
  }
}

// ---------------------------------------------------------------------------
// Content filtering
// ---------------------------------------------------------------------------

/**
 * Compile a list of regex pattern strings, dropping (and logging) any that
 * fail to compile. Returns an array of { pattern, regex } pairs.
 */
function compilePatterns(patterns, flags, kind) {
  if (!patterns || patterns.length === 0) return [];
  const compiled = [];
  for (const pattern of patterns) {
    try {
      compiled.push({ pattern, regex: new RegExp(pattern, flags) });
    } catch (err) {
      logger.warn('[ai-gateway] Invalid content filter regex pattern, skipping', { pattern, kind, error: err.message });
    }
  }
  return compiled;
}

/**
 * Apply content filtering to input messages.
 *
 * Compiles each pattern once (not per message × per pattern) and only walks
 * user messages — system/assistant messages are passed through unmodified.
 *
 * @param {Array} messages
 * @param {Object} filtering - { enabled, block_patterns, redact_patterns }
 * @returns {{ blocked: boolean, reason: string|null, messages: Array }}
 */
function applyContentFiltering(messages, filtering) {
  if (!filtering || !filtering.enabled) {
    return { blocked: false, reason: null, messages };
  }

  const blockRegexes = compilePatterns(filtering.block_patterns, 'i', 'block');
  const redactRegexes = compilePatterns(filtering.redact_patterns, 'gi', 'redact');

  if (blockRegexes.length === 0 && redactRegexes.length === 0) {
    return { blocked: false, reason: null, messages };
  }

  // Check block patterns first; bail out early on first match.
  if (blockRegexes.length > 0) {
    for (const msg of messages) {
      if (msg.role !== 'user') continue;
      for (const { regex } of blockRegexes) {
        if (regex.test(msg.content)) {
          return { blocked: true, reason: 'Content blocked by policy filter', messages };
        }
      }
    }
  }

  if (redactRegexes.length === 0) {
    return { blocked: false, reason: null, messages };
  }

  const redacted = messages.map(msg => {
    if (msg.role !== 'user') return msg;
    let content = msg.content;
    for (const { regex } of redactRegexes) {
      content = content.replace(regex, '[REDACTED]');
    }
    return content === msg.content ? msg : { ...msg, content };
  });
  return { blocked: false, reason: null, messages: redacted };
}

// ---------------------------------------------------------------------------
// Provider/model routing
// ---------------------------------------------------------------------------

/**
 * Find the most-specific task_routing entry that matches a (task, intent) pair.
 * Specificity order: task+intent > task-only > intent-only. Returns null if
 * task_routing is empty or no match is found.
 */
function findTaskRoute(taskRouting, task, intent) {
  if (!taskRouting || taskRouting.length === 0) return null;
  if (task && intent) {
    const match = taskRouting.find(r => r.task === task && r.intent === intent);
    if (match) return match;
  }
  if (task) {
    const match = taskRouting.find(r => r.task === task && !r.intent);
    if (match) return match;
  }
  if (intent) {
    const match = taskRouting.find(r => r.intent === intent && !r.task);
    if (match) return match;
  }
  return null;
}

/**
 * Determine the provider and model for a request.
 *
 * @param {string} task - AI task type
 * @param {Object} policy - Effective policy
 * @param {Object} options - Caller options (may include provider/model/intent override)
 * @returns {Promise<{ provider: string, model: string|null }>}
 */
async function routeRequest(task, policy, options = {}) {
  let provider = null;
  let model = null;
  const intent = options.intent || null;

  // Priority 1: Entity ai_config overrides
  if (policy.preferred_provider) {
    provider = policy.preferred_provider;
    model = policy.preferred_model || null;
  }

  // Priority 2: Caller explicit override (API request option)
  if (options.provider) {
    provider = options.provider;
  }
  if (options.model) {
    model = options.model;
  }

  // Priority 3: Task/intent routing from policy
  if (!provider) {
    const route = findTaskRoute(policy.task_routing, task, intent);
    if (route) {
      provider = route.provider;
      model = route.model || null;
    }
  }

  // Priority 4: Env var task routing
  if (!provider) {
    provider = getEnvProviderForTask(task);
  }

  // Priority 5: Default provider from env
  if (!provider) {
    provider = process.env.AI_DEFAULT_PROVIDER || 'openai';
  }

  // Enforce provider restrictions
  if (policy.blocked_providers && policy.blocked_providers.length > 0) {
    if (policy.blocked_providers.includes(provider)) {
      // Try to find an alternative
      const configs = await getAllProviderConfigs();
      for (const [name, config] of configs) {
        if (config.enabled && !policy.blocked_providers.includes(name)) {
          if (policy.allowed_providers.length === 0 || policy.allowed_providers.includes(name)) {
            provider = name;
            model = null; // Reset model for new provider
            break;
          }
        }
      }
    }
  }

  if (policy.allowed_providers && policy.allowed_providers.length > 0) {
    if (!policy.allowed_providers.includes(provider)) {
      provider = policy.allowed_providers[0];
      model = null;
    }
  }

  // Enforce model restrictions
  if (model && policy.allowed_models && policy.allowed_models.length > 0) {
    const providerModels = policy.allowed_models.find(m => m.provider === provider);
    if (providerModels && providerModels.models.length > 0 && !providerModels.models.includes(model)) {
      model = providerModels.models[0];
    }
  }

  return { provider, model };
}

/**
 * Get provider for a task from env vars (backward compat).
 */
function getEnvProviderForTask(task) {
  const envMap = {
    autocomplete: 'AI_AUTOCOMPLETE_PROVIDER',
    edit_language: 'AI_EDIT_PROVIDER',
    improve_description: 'AI_IMPROVE_PROVIDER',
    summarize: 'AI_SUMMARIZE_PROVIDER',
    generate_tips: 'AI_TIPS_PROVIDER',
    translate: 'AI_TRANSLATE_PROVIDER'
  };
  const envKey = envMap[task];
  if (envKey) return process.env[envKey] || null;
  // Unmapped tasks fall back to the default provider (matches pre-refactor behavior)
  return process.env.AI_DEFAULT_PROVIDER || null;
}

// ---------------------------------------------------------------------------
// Main gateway function
// ---------------------------------------------------------------------------

/**
 * Execute an AI request through the gateway.
 *
 * @param {Object} params
 * @param {Array<{role: string, content: string}>} params.messages - Chat messages
 * @param {string} params.task - AI task type
 * @param {Object} [params.user] - Authenticated user object
 * @param {Object} [params.options] - Caller options { provider, model, temperature, maxTokens, intent }
 * @param {Object} [params.entityContext] - { entityType, entityId, aiConfig }
 * @param {string} [params.intent] - BienBot classified intent (e.g. QUERY_DESTINATION)
 * @returns {Promise<{content: string, usage: Object, model: string, provider: string, policyApplied: Object}>}
 */
async function executeAIRequest(params) {
  const { messages, task, user, options: callerOptions = {}, entityContext, intent, schema } = params;
  // Don't mutate the caller's object — callers commonly pass a shared options
  // bag and a stray `intent` write would leak across requests.
  const options = { ...callerOptions, intent: callerOptions.intent || intent || null };
  const startTime = Date.now();
  const userId = user ? (user._id || user.id || '').toString() : null;
  const isSuperAdmin = user && (user.role === 'super_admin' || user.isSuperAdmin);

  // Step 1: Resolve effective policy
  const policy = await resolvePolicy({
    entityAIConfig: entityContext?.aiConfig || null,
    user
  });

  // Check if AI is disabled for this entity
  if (policy.ai_disabled) {
    throw new GatewayError('AI features are disabled for this entity', 'AI_DISABLED', 403);
  }

  // Step 2: Content filtering
  const filterResult = applyContentFiltering(messages, policy.content_filtering);
  if (filterResult.blocked) {
    // Track filtered request
    await trackUsage(userId, task, null, null, 0, 0, Date.now() - startTime, 'filtered', filterResult.reason, entityContext);
    throw new GatewayError(filterResult.reason, 'CONTENT_FILTERED', 400);
  }

  // Step 3: Rate limiting (super admins exempt)
  if (!isSuperAdmin && userId) {
    const rateCheck = checkRateLimit(userId, policy.rate_limits);
    if (!rateCheck.allowed) {
      throw new GatewayError(rateCheck.reason, 'RATE_LIMIT_EXCEEDED', 429);
    }
  }

  // Step 4: Token budget check (super admins exempt)
  // Pass estimated maxTokens so the check can preemptively block near-limit requests
  if (!isSuperAdmin && userId) {
    const estimatedTokens = options.maxTokens || 1000;
    const budgetCheck = await checkTokenBudget(userId, policy.token_budget, estimatedTokens);
    if (!budgetCheck.allowed) {
      throw new GatewayError(budgetCheck.reason, 'TOKEN_BUDGET_EXCEEDED', 429);
    }
  }

  // Step 5: Route to provider/model
  const route = await routeRequest(task, policy, options);

  // Step 6: Build call options. Task-specific routing entries (if matched)
  // override the policy/caller temperature so admins can tune per-task —
  // matched route, then policy, then caller, then default.
  const taskRoute = findTaskRoute(policy.task_routing, task, options.intent);

  const rawTemp = taskRoute?.temperature ?? policy.temperature ?? options.temperature ?? DEFAULT_TEMPERATURE;
  const tempNumber = Number(rawTemp);
  const validatedTemp = Math.min(
    Math.max(Number.isFinite(tempNumber) ? tempNumber : DEFAULT_TEMPERATURE, TEMPERATURE_MIN),
    TEMPERATURE_MAX
  );

  const rawMaxTokens = policy.max_tokens || options.maxTokens || DEFAULT_MAX_TOKENS;
  let validatedMaxTokens = Math.max(Math.min(
    Math.abs(parseInt(rawMaxTokens, 10)) || DEFAULT_MAX_TOKENS,
    policy.max_tokens_per_request
  ), 1);
  if (taskRoute?.max_tokens != null) {
    validatedMaxTokens = Math.min(validatedMaxTokens, taskRoute.max_tokens);
  }

  const callOptions = {
    model: route.model || undefined,
    temperature: validatedTemp,
    maxTokens: validatedMaxTokens,
    schema: schema || null
  };

  // Step 7: Call the provider with retry logic and failover
  // Use explicit policy fallbacks when set, otherwise default to enabled providers sorted by priority
  let resolvedFallbacks = policy.fallback_providers || [];
  if (resolvedFallbacks.length === 0) {
    const allConfigs = await getAllProviderConfigs();
    resolvedFallbacks = [...allConfigs.values()]
      .filter(c => c.enabled && c.provider !== route.provider)
      .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999))
      .map(c => c.provider);
  }
  const providerChain = [route.provider, ...resolvedFallbacks.filter(p => p !== route.provider)];

  // Record rate limit entry once per user request
  if (userId) recordRateEntry(userId);

  let result;
  let lastError;
  let lastAttemptedProvider = route.provider;
  let lastAttemptedModel = callOptions.model;
  for (let i = 0; i < providerChain.length; i++) {
    const currentProvider = providerChain[i];
    const currentApiKey = getApiKeyForProvider(currentProvider);

    if (!currentApiKey) {
      logger.warn('[ai-gateway] Skipping provider (no API key configured)', { provider: currentProvider });
      continue;
    }

    // For fallback providers, reset the model (models are provider-specific)
    const currentCallOptions = i === 0
      ? callOptions
      : { ...callOptions, model: undefined };

    lastAttemptedProvider = currentProvider;
    lastAttemptedModel = currentCallOptions.model;

    try {
      result = await callWithRetry(
        () => callProvider(currentProvider, filterResult.messages, currentCallOptions),
        options.retryConfig,
        `${currentProvider}/${task || 'unknown'}`
      );

      if (i > 0) {
        logger.info('[ai-gateway] Failover succeeded', {
          primaryProvider: route.provider,
          usedProvider: currentProvider,
          failoverIndex: i
        });
      }

      break; // success – exit provider loop
    } catch (err) {
      lastError = err;

      if (!isRetryableError(err)) {
        // Non-retryable error (auth failure, content policy, etc.) — do not failover
        await trackUsage(userId, task, currentProvider, currentCallOptions.model, 0, 0, Date.now() - startTime, 'error', err.message, entityContext);
        throw err;
      }

      if (i < providerChain.length - 1) {
        logger.warn('[ai-gateway] Provider failed after retries, trying fallback', {
          failedProvider: currentProvider,
          nextProvider: providerChain[i + 1],
          error: err.message
        });
      }
    }
  }

  if (!result) {
    // All providers exhausted (either all failed or all skipped due to missing API keys)
    const finalError = lastError || new GatewayError(
      `No configured AI providers available for this request (tried: ${providerChain.join(', ')})`,
      'PROVIDER_NOT_CONFIGURED',
      503
    );
    await trackUsage(userId, task, lastAttemptedProvider, lastAttemptedModel, 0, 0, Date.now() - startTime, 'error', finalError.message, entityContext);
    throw finalError;
  }

  // Step 8: Track usage
  const latencyMs = Date.now() - startTime;
  await trackUsage(
    userId, task, result.provider, result.model,
    result.usage.inputTokens, result.usage.outputTokens,
    latencyMs, 'success', null, entityContext
  );

  return {
    content: result.content,
    usage: result.usage,
    model: result.model,
    provider: result.provider,
    policyApplied: {
      hasUserPolicy: policy._meta.hasUserPolicy,
      hasGlobalPolicy: policy._meta.hasGlobalPolicy,
      hasEntityConfig: policy._meta.hasEntityConfig,
      maxTokensCap: policy.max_tokens_per_request
    }
  };
}

// ---------------------------------------------------------------------------
// Usage tracking
// ---------------------------------------------------------------------------

/**
 * Track an AI request in the usage model.
 */
async function trackUsage(userId, task, provider, model, inputTokens, outputTokens, latencyMs, status, errorMessage, entityContext) {
  if (!userId) return;

  try {
    loadModels();
    await AIUsage.trackRequest({
      userId,
      task: task || 'unknown',
      provider: provider || 'unknown',
      model: model || 'unknown',
      inputTokens: inputTokens || 0,
      outputTokens: outputTokens || 0,
      latencyMs: latencyMs || 0,
      status: status || 'success',
      errorMessage,
      entityType: entityContext?.entityType || null,
      entityId: entityContext?.entityId || null
    });
  } catch (err) {
    // Don't fail the request due to tracking errors
    logger.warn('[ai-gateway] Usage tracking failed', { error: err.message, userId });
  }
}

// ---------------------------------------------------------------------------
// Retry with exponential backoff
// ---------------------------------------------------------------------------

/**
 * Default retry configuration.
 */
const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000
};

/**
 * HTTP status codes that indicate transient errors worth retrying.
 */
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

/**
 * Error message patterns that indicate transient / retryable failures.
 */
const RETRYABLE_PATTERNS = [
  /rate limit/i,
  /timeout/i,
  /timed out/i,
  /ETIMEDOUT/,
  /ECONNRESET/,
  /ECONNREFUSED/,
  /socket hang up/i,
  /network/i,
  /temporarily unavailable/i,
  /overloaded/i,
  /capacity/i,
  /too many requests/i,
  /service unavailable/i,
  /internal server error/i,
  /bad gateway/i,
  /gateway timeout/i
];

/**
 * Determine whether an error from a provider call is transient and safe to retry.
 *
 * @param {Error} err
 * @returns {boolean}
 */
function isRetryableError(err) {
  // Check HTTP status code (may be set by provider handlers)
  if (err.statusCode && RETRYABLE_STATUS_CODES.has(err.statusCode)) return true;
  if (err.status && RETRYABLE_STATUS_CODES.has(err.status)) return true;

  // Check error message against known patterns
  const msg = err.message || '';
  return RETRYABLE_PATTERNS.some(pattern => pattern.test(msg));
}

/**
 * Calculate delay for a retry attempt using exponential backoff with full jitter.
 *
 * Formula: random(0, min(maxDelay, baseDelay * 2^attempt))
 *
 * @param {number} attempt - Zero-based attempt index
 * @param {number} baseDelayMs
 * @param {number} maxDelayMs
 * @returns {number} Delay in milliseconds
 */
function calculateRetryDelay(attempt, baseDelayMs, maxDelayMs) {
  const exponentialDelay = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt));
  // Full jitter: uniform random in [0, exponentialDelay]
  return Math.floor(Math.random() * exponentialDelay);
}

/**
 * Extract a server-suggested retry delay (in ms) from a provider error, if any.
 * Recognises numeric `retryAfterMs`, header-style `retry-after` in seconds, or
 * `retryAfter` (seconds). Returns null when no signal is present.
 */
function extractRetryAfterMs(err) {
  if (!err) return null;
  if (typeof err.retryAfterMs === 'number' && err.retryAfterMs > 0) return err.retryAfterMs;
  if (typeof err.retryAfter === 'number' && err.retryAfter > 0) return err.retryAfter * 1000;
  const header = err.headers?.['retry-after'] || err.headers?.['Retry-After'];
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
  }
  return null;
}

// Hard upper bound for retry delays. Even though callers clamp against
// config.maxDelayMs, this literal ceiling breaks any taint flow from
// provider-supplied Retry-After headers into setTimeout (CodeQL
// js/resource-exhaustion).
const SLEEP_MAX_MS = 60_000;

/**
 * Sleep for a given number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  const safeMs = Number.isFinite(ms) && ms > 0 ? Math.min(ms, SLEEP_MAX_MS) : 0;
  return new Promise(resolve => setTimeout(resolve, safeMs));
}

/**
 * Call a provider with retry logic using exponential backoff and jitter.
 *
 * Only transient errors (rate limits, timeouts, 5xx) are retried.
 * Non-retryable errors (auth failures, validation, content blocked) are thrown immediately.
 *
 * @param {Function} callFn - () => Promise<result> — the provider call to execute
 * @param {Object} [retryConfig] - Override default retry configuration
 * @param {string} [context] - Logging context (provider name, task)
 * @returns {Promise<Object>} Provider response
 */
async function callWithRetry(callFn, retryConfig = {}, context = '') {
  const config = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  let lastError;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await callFn();
    } catch (err) {
      lastError = err;

      // Don't retry on non-transient errors
      if (!isRetryableError(err)) {
        throw err;
      }

      // Don't retry if we've exhausted all attempts
      if (attempt >= config.maxRetries) {
        break;
      }

      // Honor a server-supplied Retry-After if present (capped at maxDelayMs);
      // otherwise fall back to exponential backoff with full jitter.
      const serverRetryMs = extractRetryAfterMs(err);
      const delayMs = serverRetryMs != null
        ? Math.min(serverRetryMs, config.maxDelayMs)
        : calculateRetryDelay(attempt, config.baseDelayMs, config.maxDelayMs);

      logger.warn('[ai-gateway] Retrying LLM call after transient error', {
        attempt: attempt + 1,
        maxRetries: config.maxRetries,
        delayMs,
        retryAfterFromServer: serverRetryMs != null,
        error: err.message,
        context
      });

      await sleep(delayMs);
    }
  }

  // All retries exhausted
  throw lastError;
}

// ---------------------------------------------------------------------------
// Custom error class
// ---------------------------------------------------------------------------

class GatewayError extends Error {
  constructor(message, code, statusCode = 500) {
    super(message);
    this.name = 'GatewayError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  executeAIRequest,
  resolvePolicy,
  invalidatePolicyCache,
  GatewayError,
  // Exported for testing
  callWithRetry,
  isRetryableError,
  calculateRetryDelay,
  extractRetryAfterMs,
  applyContentFiltering,
  checkRateLimit,
  routeRequest,
  findTaskRoute,
  DEFAULT_RETRY_CONFIG,
  // Exported so the AI controller and utilities can use the canonical
  // implementation. NOTE: this is the env-only resolver, not the policy-aware
  // routing path used inside executeAIRequest.
  getProviderForTask: getEnvProviderForTask
};

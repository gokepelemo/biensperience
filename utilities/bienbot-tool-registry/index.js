/**
 * BienBot Tool Registry
 *
 * Provider-grouped tool registry. Boot-time validated, queried at runtime
 * by the chat handler, action executor, and prompt builder.
 *
 * Replaces the legacy 5-site registration pattern (ALLOWED_ACTION_TYPES,
 * READ_ONLY_ACTION_TYPES, TOOL_CALL_ACTION_TYPES, ACTION_HANDLERS,
 * ACTION_ENTITY_VERIFY) with a single `registerProvider({ ... })` call.
 *
 * This module is the skeleton (T1): it exposes registration + lookup APIs
 * with strict manifest validation. Execution (T3), context plumbing (T2),
 * verifier/prompt contributions (T4), and bootstrap wiring (T5) come later.
 *
 * @module utilities/bienbot-tool-registry
 */

const logger = require('../backend-logger');

// ────────────────────────────────────────────────────────────────────────────
// Module-level state
// ────────────────────────────────────────────────────────────────────────────

/** providerName -> provider manifest */
const providers = new Map();

/** toolName -> { provider, tool } */
const tools = new Map();

/** Set of read-only tool names from enabled providers */
const readToolNames = new Set();

/** Set of mutating tool names from enabled providers */
const writeToolNames = new Set();

// ────────────────────────────────────────────────────────────────────────────
// Validation helpers
// ────────────────────────────────────────────────────────────────────────────

const VALID_AUTH_TYPES = new Set(['none', 'env_key']);

/**
 * Validate top-level provider manifest fields.
 * @throws Error on any violation.
 */
function _validateProviderShape(provider) {
  if (!provider || typeof provider !== 'object') {
    throw new Error('[tool-registry] provider must be an object');
  }

  if (!provider.name || typeof provider.name !== 'string') {
    throw new Error('[tool-registry] provider.name (string) is required');
  }
  if (!provider.displayName || typeof provider.displayName !== 'string') {
    throw new Error(
      `[tool-registry] provider.displayName (string) is required (provider="${provider.name}")`
    );
  }
  if (!provider.baseUrl || typeof provider.baseUrl !== 'string') {
    throw new Error(
      `[tool-registry] provider.baseUrl (string) is required (provider="${provider.name}")`
    );
  }
  if (!provider.authType || !VALID_AUTH_TYPES.has(provider.authType)) {
    throw new Error(
      `[tool-registry] provider.authType must be one of ${[...VALID_AUTH_TYPES].join(', ')} (provider="${provider.name}")`
    );
  }
  if (provider.authType === 'env_key' && (!provider.envKey || typeof provider.envKey !== 'string')) {
    throw new Error(
      `[tool-registry] provider.envKey (string) is required when authType="env_key" (provider="${provider.name}")`
    );
  }
  if (
    provider.retryPolicy === undefined ||
    provider.retryPolicy === null ||
    typeof provider.retryPolicy !== 'object'
  ) {
    throw new Error(
      `[tool-registry] provider.retryPolicy (object) is required (provider="${provider.name}")`
    );
  }
  if (!Array.isArray(provider.tools) || provider.tools.length === 0) {
    throw new Error(
      `[tool-registry] provider.tools[] must be a non-empty array (provider="${provider.name}")`
    );
  }
}

/**
 * Validate a single tool definition under a provider.
 * @throws Error on any violation.
 */
function _validateToolShape(providerName, tool) {
  if (!tool || typeof tool !== 'object') {
    throw new Error(`[tool-registry] tool must be an object (provider="${providerName}")`);
  }
  if (!tool.name || typeof tool.name !== 'string') {
    throw new Error(
      `[tool-registry] tool.name (string) is required (provider="${providerName}")`
    );
  }
  if (typeof tool.mutating !== 'boolean') {
    throw new Error(
      `[tool-registry] tool.mutating (boolean) is required (provider="${providerName}", tool="${tool.name}")`
    );
  }
  if (typeof tool.handler !== 'function') {
    throw new Error(
      `[tool-registry] tool.handler must be a function (provider="${providerName}", tool="${tool.name}")`
    );
  }
  if (!Array.isArray(tool.promptHints) || tool.promptHints.length === 0) {
    throw new Error(
      `[tool-registry] tool.promptHints[] must be a non-empty array (provider="${providerName}", tool="${tool.name}")`
    );
  }

  const payloadSchema =
    tool.payloadSchema && typeof tool.payloadSchema === 'object' ? tool.payloadSchema : {};
  const idRefs = Array.isArray(tool.idRefs) ? tool.idRefs : [];

  // Every idRefs.field MUST appear as a key in payloadSchema. Without this
  // check the executor would silently drop required IDs because verifier
  // resolution operates on the validated payload shape.
  for (const ref of idRefs) {
    if (!ref || typeof ref !== 'object' || !ref.field) {
      throw new Error(
        `[tool-registry] tool.idRefs[] entries must be objects with a "field" key (provider="${providerName}", tool="${tool.name}")`
      );
    }
    if (!Object.prototype.hasOwnProperty.call(payloadSchema, ref.field)) {
      throw new Error(
        `[tool-registry] tool.idRefs field "${ref.field}" is not present in payloadSchema (provider="${providerName}", tool="${tool.name}")`
      );
    }
  }

  if (tool.mutating === true) {
    if (!tool.confirmDescription || typeof tool.confirmDescription !== 'string') {
      throw new Error(
        `[tool-registry] mutating tool requires confirmDescription (string) (provider="${providerName}", tool="${tool.name}")`
      );
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Provider availability
// ────────────────────────────────────────────────────────────────────────────

/**
 * A provider is "enabled" — and therefore its tools are visible via getTool /
 * getReadToolNames / getWriteToolNames — when:
 *   - authType === 'none', OR
 *   - authType === 'env_key' AND (envKeyOptional is false OR the env key is set)
 *
 * Optional providers without their env key configured are still registered
 * (so callers can introspect them) but their tools won't show up in the
 * routing surfaces. This matches "graceful degradation in dev" semantics.
 */
function isProviderEnabled(provider) {
  if (!provider) return false;
  if (provider.authType === 'none') return true;
  if (provider.authType === 'env_key') {
    if (!provider.envKeyOptional) return true;
    return Boolean(process.env[provider.envKey]);
  }
  return false;
}

// ────────────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────────────

/**
 * Register a provider and all its tools. Validates the manifest synchronously
 * and throws on any violation — this is meant to fail loud at boot time.
 *
 * @param {Object} provider - Provider manifest. See module docstring for shape.
 */
function registerProvider(provider) {
  _validateProviderShape(provider);

  if (providers.has(provider.name)) {
    throw new Error(
      `[tool-registry] duplicate provider name: "${provider.name}"`
    );
  }

  for (const tool of provider.tools) {
    _validateToolShape(provider.name, tool);
    if (tools.has(tool.name)) {
      const existing = tools.get(tool.name);
      throw new Error(
        `[tool-registry] duplicate tool name "${tool.name}" — already registered by provider "${existing.provider.name}", tried to register again under "${provider.name}"`
      );
    }
  }

  // All checks passed; commit the provider and its tools atomically.
  providers.set(provider.name, provider);

  const enabled = isProviderEnabled(provider);
  for (const tool of provider.tools) {
    tools.set(tool.name, { provider, tool });
    if (enabled) {
      if (tool.mutating) {
        writeToolNames.add(tool.name);
      } else {
        readToolNames.add(tool.name);
      }
    }
  }

  logger.info('[tool-registry] provider registered', {
    provider: provider.name,
    enabled,
    toolCount: provider.tools.length,
    authType: provider.authType
  });
}

/**
 * Look up a tool by name. Returns `{ provider, tool }` only when the
 * provider is enabled (env key present if required). Returns null otherwise.
 */
function getTool(name) {
  const entry = tools.get(name);
  if (!entry) return null;
  if (!isProviderEnabled(entry.provider)) return null;
  return entry;
}

/**
 * @returns {Set<string>} All read-only tool names from enabled providers.
 */
function getReadToolNames() {
  return new Set(readToolNames);
}

/**
 * @returns {Set<string>} All mutating tool names from enabled providers.
 */
function getWriteToolNames() {
  return new Set(writeToolNames);
}

/**
 * @returns {Array<Object>} All registered providers (enabled or not), in
 *   registration order.
 */
function getAllProviders() {
  return Array.from(providers.values());
}

/**
 * Test-only: clear all registry state. Not exported via index of usage in
 * production paths — used by Jest beforeEach to start each test clean.
 */
function _resetRegistryForTest() {
  providers.clear();
  tools.clear();
  readToolNames.clear();
  writeToolNames.clear();
}

const { createProviderContext } = require('./provider-context');

function _validatePayload(schema, payload) {
  const missing = [];
  const cleaned = {};
  for (const [field, rule] of Object.entries(schema)) {
    if (rule.required && (payload?.[field] === undefined || payload?.[field] === null)) {
      missing.push(field);
      continue;
    }
    if (payload?.[field] !== undefined) {
      cleaned[field] = payload[field];
    }
  }
  return { missing, cleaned };
}

async function executeRegisteredTool(name, payload, user, opts = {}) {
  const entry = getTool(name);
  if (!entry) {
    return { success: false, statusCode: 404, body: { ok: false, error: 'unknown_tool' }, errors: ['unknown_tool'] };
  }
  const { provider, tool } = entry;

  const { missing, cleaned } = _validatePayload(tool.payloadSchema, payload || {});
  if (missing.length > 0) {
    return {
      success: false, statusCode: 400,
      body: { ok: false, error: 'invalid_payload', missing },
      errors: ['invalid_payload']
    };
  }

  const providerCtx = createProviderContext(provider, opts);

  let response;
  try {
    response = await tool.handler(cleaned, user, providerCtx);
  } catch (err) {
    providerCtx.logger.error(`tool ${name} threw`, { error: err.message }, err);
    return { success: false, statusCode: 500, body: { ok: false, error: 'fetch_failed' }, errors: ['fetch_failed'] };
  }

  if (!response || typeof response.statusCode !== 'number') {
    return { success: false, statusCode: 500, body: { ok: false, error: 'fetch_failed' }, errors: ['handler_returned_invalid_shape'] };
  }

  const isSuccess = response.statusCode >= 200 && response.statusCode < 300;
  return {
    success: isSuccess,
    statusCode: response.statusCode,
    body: response.body,
    errors: isSuccess ? [] : [response.body?.error || `status_${response.statusCode}`]
  };
}

module.exports = {
  registerProvider,
  getTool,
  getReadToolNames,
  getWriteToolNames,
  getAllProviders,
  isProviderEnabled,
  executeRegisteredTool,
  _resetRegistryForTest
};

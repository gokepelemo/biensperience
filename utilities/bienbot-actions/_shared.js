/**
 * BienBot action handlers — shared helpers and constants.
 *
 * Pure relocation from utilities/bienbot-action-executor.js — no behavior change.
 * Lives under utilities/bienbot-actions/ and is imported by every per-domain
 * handler module.
 *
 * @module utilities/bienbot-actions/_shared
 */

const logger = require('../backend-logger');

// ---------------------------------------------------------------------------
// Limits / constants
// ---------------------------------------------------------------------------

const MAX_WORKFLOW_STEPS = 10;
const MAX_PLAN_ITEMS_PER_BATCH = 50;
const MAX_DATE_SHIFT_DAYS = 3650; // ±~10 years
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const INVITE_CODE_BYTES = 4;
const DEFAULT_INVITE_EXPIRY_DAYS = 7;
const DEFAULT_LIST_LIMIT = 20;

/**
 * `$step_N.<path>` reference allowlist.
 *
 * When a workflow step's payload references the result of an earlier step,
 * only the leading path segment is consulted. This prevents an LLM-supplied
 * workflow (potentially attacker-influenced via prompt injection) from
 * exfiltrating sensitive fields like `user.password`, `user.email`, or
 * `oauth.*` from a previous step's result.
 */
const STEP_REF_ALLOWED_FIELDS = new Set([
  '_id',
  'id',
  'destination',
  'destination_id',
  'experience',
  'experience_id',
  'plan',
  'plan_id',
  'plan_item_id',
  'name',
  'planned_date',
  'currency'
]);

/**
 * Valid structured_content block types for BienBot session messages.
 * Single source of truth — imported by the BienBotSession model schema
 * so the Mongoose enum stays in sync with the controller/mapper code.
 *
 * When adding a new structured content type:
 *   1. Add it here
 *   2. Add a case in mapReadOnlyResultToStructuredContent() (controllers/api/bienbot.js)
 *   3. Add a renderer in BienBotPanel.jsx
 */
const STRUCTURED_CONTENT_TYPES = [
  'photo_gallery',
  'suggestion_list',
  'discovery_result_list',
  'tip_suggestion_list',
  'entity_ref_list',
  'experience_list',
  'follower_list',
  'document_list',
  'activity_feed'
];

// ---------------------------------------------------------------------------
// Lazy-loaded controllers (resolved on first use to avoid circular deps)
// ---------------------------------------------------------------------------

let destinationsController, experiencesController, plansController, followsController, usersController, activitiesController, documentsController;

function loadControllers() {
  if (!destinationsController) {
    destinationsController = require('../../controllers/api/destinations');
    experiencesController = require('../../controllers/api/experiences');
    plansController = require('../../controllers/api/plans');
    followsController = require('../../controllers/api/follows');
    usersController = require('../../controllers/api/users');
    activitiesController = require('../../controllers/api/activities');
    documentsController = require('../../controllers/api/documents');
  }
  return {
    destinationsController,
    experiencesController,
    plansController,
    followsController,
    usersController,
    activitiesController,
    documentsController
  };
}

// Lazy-loaded models (resolved on first use to avoid circular deps)
let _mongoose, _Plan, _Experience, _Destination, _User, _getEnforcer;

function loadModels() {
  if (!_mongoose) {
    _mongoose = require('mongoose');
    _Plan = require('../../models/plan');
    _Experience = require('../../models/experience');
    _Destination = require('../../models/destination');
    _User = require('../../models/user');
    _getEnforcer = require('../permission-enforcer').getEnforcer;
  }
  return {
    mongoose: _mongoose,
    Plan: _Plan,
    Experience: _Experience,
    Destination: _Destination,
    User: _User,
    getEnforcer: _getEnforcer
  };
}

// ---------------------------------------------------------------------------
// Date normalisation
// ---------------------------------------------------------------------------

/**
 * Normalise an ISO date-only string ("2026-04-24") to noon UTC so that
 * `new Date()` in any timezone still falls on the intended calendar day.
 * Full ISO timestamps (with T, Z, or offset) are returned as-is.
 *
 * @param {*} value - The value to normalise.
 * @returns {*} The original value, or the noon-UTC string if it was date-only.
 */
function normalizeDateOnly(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${value}T12:00:00Z`;
  }
  return value;
}

/**
 * `navigate_to_entity` URL allowlist. Only same-origin relative paths are
 * acceptable — prevents `javascript:`/external-host XSS via attacker-influenced
 * action payloads.
 */
function isSafeNavigationUrl(url) {
  if (typeof url !== 'string' || url.length === 0) return false;
  if (!url.startsWith('/')) return false;
  if (url.startsWith('//')) return false; // protocol-relative
  return true;
}

// ---------------------------------------------------------------------------
// Mock req/res for controller delegation
// ---------------------------------------------------------------------------

/**
 * Build a mock Express request object that controllers can read from.
 *
 * @param {object} user - Authenticated user (from session).
 * @param {object} [body={}] - Request body fields.
 * @param {object} [params={}] - Route params (e.g. :id, :experienceId).
 * @param {object} [query={}] - Query string parameters (e.g. { limit: 10 }).
 * @returns {object} Mock req compatible with controller expectations.
 */
function buildMockReq(user, body = {}, params = {}, query = {}) {
  return {
    user,
    body,
    params,
    query,
    ip: '127.0.0.1',
    method: 'POST',
    path: '/api/bienbot/action',
    get: (header) => {
      if (header === 'user-agent') return 'BienBot/1.0';
      return undefined;
    }
  };
}

/**
 * Build a mock Express response that captures the status + body sent by
 * the controller. Controllers use one of three patterns:
 *   1. successResponse(res, data, msg, status, meta) → res.status(code).send(json)
 *   2. errorResponse(res, err, msg, status) → res.status(code).send(json)
 *   3. res.status(code).json(data) / res.json(data)
 *
 * The mock captures whatever pattern is used.
 *
 * @returns {{ res: object, getResult: () => { statusCode, body } }}
 */
function buildMockRes() {
  let captured = { statusCode: 200, body: null, headers: {} };

  const res = {
    statusCode: 200,
    setHeader(name, value) {
      captured.headers[name] = value;
      return res;
    },
    status(code) {
      captured.statusCode = code;
      res.statusCode = code;
      return res;
    },
    json(data) {
      captured.body = data;
      return res;
    },
    send(data) {
      // Controllers may send pre-serialised JSON strings
      if (typeof data === 'string') {
        try { captured.body = JSON.parse(data); } catch { captured.body = data; }
      } else {
        captured.body = data;
      }
      return res;
    }
  };

  return {
    res,
    getResult: () => ({
      statusCode: captured.statusCode,
      body: captured.body
    })
  };
}

// ---------------------------------------------------------------------------
// Service-result adapter
// ---------------------------------------------------------------------------

/**
 * Convert a service-layer result (`{ <dataKey>, error, code }` shape) into the
 * `{ statusCode, body }` shape the executor returns to its callers.
 *
 * Mirrors the helper introduced in bd #8f36.13 on the (pre-split) executor.
 *
 * @param {object} result - Service-layer response.
 * @param {object} [options]
 * @param {string} [options.dataKey] - Key in `result` that holds the success entity.
 * @param {number} [options.successCode=200]
 * @param {object} [options.extraBody] - Extra fields to merge into the success body.
 * @returns {{ statusCode: number, body: object }}
 */
function toExecutorResult(result, { dataKey, successCode = 200, extraBody = {} } = {}) {
  if (!result || result.error) {
    return {
      statusCode: result?.code || 400,
      body: { success: false, error: result?.error || 'Unknown error' }
    };
  }
  const data = dataKey ? result[dataKey] : (result.data || result);
  return {
    statusCode: successCode,
    body: { success: true, data, ...extraBody }
  };
}

module.exports = {
  // Constants
  MAX_WORKFLOW_STEPS,
  MAX_PLAN_ITEMS_PER_BATCH,
  MAX_DATE_SHIFT_DAYS,
  MS_PER_DAY,
  INVITE_CODE_BYTES,
  DEFAULT_INVITE_EXPIRY_DAYS,
  DEFAULT_LIST_LIMIT,
  STEP_REF_ALLOWED_FIELDS,
  STRUCTURED_CONTENT_TYPES,
  // Lazy loaders
  loadControllers,
  loadModels,
  // Helpers
  normalizeDateOnly,
  isSafeNavigationUrl,
  buildMockReq,
  buildMockRes,
  toExecutorResult,
  // Logger
  logger
};

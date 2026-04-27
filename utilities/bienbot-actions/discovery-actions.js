/**
 * BienBot discovery / read-only data action handlers.
 *
 * Pure relocation from utilities/bienbot-action-executor.js — no behavior change.
 * Covers content discovery, suggestion fetching, photo gallery operations,
 * document listing, and the client-only navigate_to_entity passthrough.
 *
 * @module utilities/bienbot-actions/discovery-actions
 */

const {
  loadControllers,
  buildMockReq,
  buildMockRes,
  isSafeNavigationUrl
} = require('./_shared');

const { suggestPlanItems, fetchEntityPhotos, addEntityPhotos } = require('../bienbot-external-data');

// ---------------------------------------------------------------------------
// Suggestion + photo handlers (delegate to bienbot-external-data)
// ---------------------------------------------------------------------------

/**
 * suggest_plan_items — read-only, no confirmation.
 * payload: { destination_id, experience_id?, exclude_items?, limit? }
 */
async function executeSuggestPlanItems(payload, user) {
  return suggestPlanItems(payload, user);
}

/**
 * fetch_entity_photos — read-only, no confirmation.
 * payload: { entity_type, entity_id, query?, limit? }
 */
async function executeFetchEntityPhotos(payload, user, session) {
  return fetchEntityPhotos(payload, user, session);
}

/**
 * add_entity_photos — mutating, requires confirmation.
 * payload: { entity_type, entity_id, photos: [{ url, photographer, photographer_url }] }
 */
async function executeAddEntityPhotos(payload, user, session) {
  return addEntityPhotos(payload, user, session);
}

// ---------------------------------------------------------------------------
// Discovery / cross-entity content search
// ---------------------------------------------------------------------------

/**
 * discover_content — read-only, no confirmation.
 * Uses buildDiscoveryContext to find popular experiences matching filters.
 * payload: { activity_types?, destination_name?, destination_id?, min_plans?, max_cost? }
 */
async function executeDiscoverContent(payload, user) {
  const { buildDiscoveryContext } = require('../bienbot-context-builders');
  const discoveryResult = await buildDiscoveryContext(payload, user._id.toString());

  if (!discoveryResult) {
    return {
      statusCode: 200,
      body: {
        message: 'No matching experiences found for your search.',
        results: [],
        query_metadata: {
          filters_applied: payload,
          cache_hit: false,
          result_count: 0,
          cross_destination: !!(payload.cross_destination || (!payload.destination_id && !payload.destination_name))
        }
      }
    };
  }

  return {
    statusCode: 200,
    body: {
      message: discoveryResult.contextBlock,
      results: discoveryResult.results,
      query_metadata: discoveryResult.query_metadata
    }
  };
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

/**
 * list_entity_documents — read-only, no confirmation.
 * payload: { entity_type, entity_id, plan_id?, limit?: 10 }
 * Lists documents attached to an entity (plan, experience, destination, plan_item).
 */
async function executeListEntityDocuments(payload, user) {
  const { entity_type, entity_id, plan_id, limit = 10 } = payload || {};
  if (!entity_type || !entity_id) return { statusCode: 400, body: { success: false, error: 'entity_type and entity_id are required' } };
  const { documentsController } = loadControllers();
  const req = buildMockReq(
    user,
    {},
    { entityType: entity_type, entityId: entity_id },
    { planId: plan_id, limit }
  );
  const { res, getResult } = buildMockRes();
  await documentsController.getByEntity(req, res);
  return getResult();
}

// ---------------------------------------------------------------------------
// navigate_to_entity (client-only no-op)
// ---------------------------------------------------------------------------

/**
 * navigate_to_entity — no-op on the backend, executes without confirmation.
 * The frontend handles navigation; the backend just marks it as successful.
 * payload: { entity, entityId, url }
 *
 * The URL is validated against `isSafeNavigationUrl` to refuse `javascript:`,
 * external hosts, and protocol-relative URLs that an LLM-supplied payload
 * could otherwise route a user to.
 */
async function executeNavigateToEntity(payload) {
  const { entity, entityId, url } = payload || {};
  if (!isSafeNavigationUrl(url)) {
    return {
      statusCode: 400,
      body: { success: false, error: 'navigate_to_entity: url must be a same-origin path starting with "/"' }
    };
  }
  return { statusCode: 200, body: { data: { url, entity, entityId } } };
}

// ---------------------------------------------------------------------------
// Module exports
// ---------------------------------------------------------------------------

const HANDLERS = {
  suggest_plan_items: executeSuggestPlanItems,
  fetch_entity_photos: executeFetchEntityPhotos,
  add_entity_photos: executeAddEntityPhotos,
  discover_content: executeDiscoverContent,
  list_entity_documents: executeListEntityDocuments,
  navigate_to_entity: executeNavigateToEntity
};

const ALLOWED_TYPES = Object.keys(HANDLERS);

const READ_ONLY_TYPES = [
  'suggest_plan_items',
  'fetch_entity_photos',
  'discover_content',
  'list_entity_documents'
];

// No tool-call types — these are card-producing or mutating; not LLM-consumed
// fetchers (per CLAUDE.md guidance).
const TOOL_CALL_TYPES = [];

module.exports = {
  ALLOWED_TYPES,
  READ_ONLY_TYPES,
  TOOL_CALL_TYPES,
  HANDLERS
};

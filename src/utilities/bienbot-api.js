/**
 * BienBot API Utility
 *
 * Frontend API calls for the BienBot AI assistant.
 * Uses sendRequest for standard REST endpoints and native fetch + ReadableStream
 * for the SSE streaming chat endpoint.
 *
 * @module utilities/bienbot-api
 */

import { sendRequest } from "./send-request";
import { getToken } from "./users-service.js";
import { logger } from "./logger";
import { broadcastEvent } from "./event-bus";
import { getSessionId, refreshSessionIfNeeded } from "./session-utils.js";
import { generateTraceId } from "./trace-utils.js";

const BASE_URL = "/api/bienbot";

/**
 * Extract data from API response.
 * Handles responses wrapped in { data } or already unwrapped.
 * @param {Object} response - API response
 * @returns {Object} Extracted data
 */
function extractData(response) {
  if (response && typeof response === 'object' && 'data' in response) {
    return response.data;
  }
  return response;
}

/**
 * Build auth headers for SSE fetch requests.
 * Mirrors the header logic in send-request.js (JWT, session ID, trace ID).
 * Does NOT include CSRF — the SSE endpoint uses POST but the token is handled separately.
 * @returns {Promise<Object>} Headers object
 */
async function buildAuthHeaders() {
  const headers = {
    'Content-Type': 'application/json'
  };

  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;

    try {
      const tokenPayload = JSON.parse(atob(token.split('.')[1]));
      const userId = tokenPayload.user?._id;

      if (userId) {
        const { sessionId } = await refreshSessionIfNeeded(userId);
        if (sessionId) {
          headers['bien-session-id'] = sessionId;
        }
      }
    } catch (e) {
      logger.trace('[bienbot-api] Session handling warning', { error: e.message });
    }
  }

  headers['bien-trace-id'] = generateTraceId();
  return headers;
}

/**
 * Fetch a CSRF token for state-changing requests.
 * @returns {Promise<string|null>}
 */
async function fetchCsrfToken() {
  try {
    const res = await fetch('/api/auth/csrf-token', {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store'
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.csrfToken || null;
  } catch (e) {
    logger.error('[bienbot-api] Failed to fetch CSRF token', { error: e.message });
    return null;
  }
}

// ---------------------------------------------------------------------------
// SSE Chat
// ---------------------------------------------------------------------------

/**
 * Post a message to BienBot and stream the response via SSE.
 *
 * @param {string|null} sessionId - Existing session ID, or null to create a new session
 * @param {string} message - User message text
 * @param {Object} [options={}]
 * @param {Object} [options.invokeContext] - Entity context ({ entity, id, label }), only sent when sessionId is null
 * @param {Function} [options.onToken] - Called with each text chunk: (text: string) => void
 * @param {Function} [options.onSession] - Called with session info: ({ sessionId, title }) => void
 * @param {Function} [options.onActions] - Called with pending actions: (actions: Array) => void
 * @param {Function} [options.onDone] - Called on stream completion: ({ usage, intent, confidence }) => void
 * @param {Function} [options.onError] - Called on error: (error: Error) => void
 * @param {AbortSignal} [options.signal] - AbortSignal for cancellation
 * @returns {Promise<void>}
 */
export async function postMessage(sessionId, message, options = {}) {
  const {
    invokeContext,
    onToken,
    onSession,
    onActions,
    onDone,
    onError,
    signal
  } = options;

  const headers = await buildAuthHeaders();

  // Add CSRF token for this state-changing request
  const csrfToken = await fetchCsrfToken();
  if (csrfToken) {
    headers['x-csrf-token'] = csrfToken;
  }

  const body = { message };

  if (sessionId) {
    body.sessionId = sessionId;
  }

  // invokeContext is only forwarded on the first message (when sessionId is null)
  if (!sessionId && invokeContext) {
    body.invokeContext = invokeContext;
  }

  let response;
  try {
    response = await fetch(`${BASE_URL}/chat`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(body),
      signal
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      logger.debug('[bienbot-api] Chat request aborted');
      return;
    }
    const error = new Error('Network error. Please check your connection and try again.');
    if (onError) onError(error);
    throw error;
  }

  if (!response.ok) {
    let errorMessage = `Chat request failed: ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData.error) errorMessage = errorData.error;
    } catch {
      // ignore parse errors
    }
    const error = new Error(errorMessage);
    if (onError) onError(error);
    throw error;
  }

  // Parse SSE stream
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE events (separated by double newlines)
      const events = buffer.split('\n\n');
      // Keep the last incomplete chunk in the buffer
      buffer = events.pop() || '';

      for (const eventBlock of events) {
        if (!eventBlock.trim()) continue;

        let eventType = null;
        let eventData = null;

        for (const line of eventBlock.split('\n')) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            try {
              eventData = JSON.parse(line.slice(6));
            } catch {
              logger.warn('[bienbot-api] Failed to parse SSE data', { line });
            }
          }
        }

        if (!eventType || !eventData) continue;

        switch (eventType) {
          case 'session':
            if (onSession) onSession(eventData);
            break;

          case 'token':
            if (onToken) onToken(eventData.text);
            break;

          case 'actions':
            if (onActions) onActions(eventData.pending_actions);
            break;

          case 'done':
            if (onDone) onDone(eventData);
            break;

          default:
            logger.debug('[bienbot-api] Unknown SSE event type', { eventType });
        }
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      logger.debug('[bienbot-api] SSE stream aborted');
      return;
    }
    throw err;
  }

  // Emit event after successful chat turn
  try {
    broadcastEvent('bienbot:message_added', {
      sessionId,
      message,
      version: Date.now()
    });
    logger.debug('[bienbot-api] bienbot:message_added event dispatched', { sessionId });
  } catch (e) {
    // Silently ignore — don't break the mutation
  }
}

// ---------------------------------------------------------------------------
// Sessions (REST)
// ---------------------------------------------------------------------------

/**
 * List BienBot sessions for the current user.
 * @param {Object} [options={}]
 * @param {string} [options.status] - Filter by status: 'active' or 'archived'
 * @returns {Promise<Object>} { sessions: Array }
 */
export async function getSessions(options = {}) {
  const { status } = options;
  let url = `${BASE_URL}/sessions`;

  if (status) {
    url += `?status=${encodeURIComponent(status)}`;
  }

  const result = await sendRequest(url, "GET");
  return extractData(result);
}

/**
 * Get a single BienBot session by ID.
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object>} { session }
 */
export async function getSession(sessionId) {
  const result = await sendRequest(`${BASE_URL}/sessions/${sessionId}`, "GET");
  return extractData(result);
}

/**
 * Resume a past BienBot session.
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object>} { session, greeting }
 */
export async function resumeSession(sessionId) {
  const result = await sendRequest(`${BASE_URL}/sessions/${sessionId}/resume`, "POST");

  try {
    broadcastEvent('bienbot:session_resumed', {
      sessionId,
      version: Date.now()
    });
    logger.debug('[bienbot-api] bienbot:session_resumed event dispatched', { sessionId });
  } catch (e) {
    // Silently ignore
  }

  return extractData(result);
}

/**
 * Delete (archive) a BienBot session.
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object>} { message }
 */
export async function deleteSession(sessionId) {
  const result = await sendRequest(`${BASE_URL}/sessions/${sessionId}`, "DELETE");

  try {
    broadcastEvent('bienbot:session_deleted', {
      sessionId,
      version: Date.now()
    });
    logger.debug('[bienbot-api] bienbot:session_deleted event dispatched', { sessionId });
  } catch (e) {
    // Silently ignore
  }

  return extractData(result);
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Execute pending actions from a BienBot session.
 *
 * After successful execution, broadcasts events for each entity mutation
 * so DataContext and component subscriptions update automatically.
 *
 * @param {string} sessionId - Session ID
 * @param {string[]} actionIds - Array of action IDs to execute
 * @returns {Promise<Object>} { results, contextUpdates, session }
 */
export async function executeActions(sessionId, actionIds) {
  const result = await sendRequest(
    `${BASE_URL}/sessions/${sessionId}/execute`,
    "POST",
    { actionIds }
  );

  const data = extractData(result);

  // Broadcast entity events for each successful action result
  try {
    if (data.results && Array.isArray(data.results)) {
      for (const actionResult of data.results) {
        if (!actionResult.success) continue;

        const entity = actionResult.entity || actionResult.data;
        if (!entity) continue;

        switch (actionResult.type) {
          case 'create_destination':
            broadcastEvent('destination:created', {
              destination: entity,
              destinationId: entity._id
            });
            break;

          case 'update_destination':
          case 'toggle_favorite_destination':
            broadcastEvent('destination:updated', {
              destination: entity,
              destinationId: entity._id
            });
            break;

          case 'create_experience':
            broadcastEvent('experience:created', {
              experience: entity,
              experienceId: entity._id
            });
            break;

          case 'update_experience':
          case 'add_experience_plan_item':
          case 'update_experience_plan_item':
          case 'delete_experience_plan_item':
            broadcastEvent('experience:updated', {
              experience: entity,
              experienceId: entity._id
            });
            break;

          case 'create_plan':
            broadcastEvent('plan:created', {
              plan: entity,
              planId: entity._id,
              experienceId: entity.experience,
              version: Date.now()
            });
            break;

          case 'delete_plan':
            broadcastEvent('plan:deleted', {
              planId: actionResult.planId || entity?._id,
              version: Date.now()
            });
            break;

          case 'add_plan_items':
          case 'update_plan_item':
          case 'delete_plan_item':
          case 'sync_plan':
          case 'add_plan_item_note':
          case 'add_plan_item_detail':
          case 'assign_plan_item':
          case 'unassign_plan_item':
          case 'update_plan':
          case 'add_plan_cost':
          case 'update_plan_cost':
          case 'delete_plan_cost':
          case 'remove_collaborator':
          case 'set_member_location':
          case 'remove_member_location':
            broadcastEvent('plan:updated', {
              plan: entity,
              planId: entity._id || actionResult.planId,
              version: Date.now()
            });
            break;

          case 'invite_collaborator':
            broadcastEvent('invite:created', {
              invite: entity,
              inviteId: entity._id
            });
            break;

          default:
            logger.debug('[bienbot-api] No event mapping for action type', { type: actionResult.type });
        }
      }
    }

    broadcastEvent('bienbot:actions_executed', {
      sessionId,
      actionIds,
      results: data.results,
      version: Date.now()
    });
    logger.debug('[bienbot-api] Action events dispatched', { sessionId, actionCount: actionIds.length });
  } catch (e) {
    // Silently ignore — don't break the mutation
    logger.warn('[bienbot-api] Failed to dispatch action events', { error: e.message });
  }

  return data;
}

/**
 * Cancel (remove) a pending action from a BienBot session.
 * @param {string} sessionId - Session ID
 * @param {string} actionId - Action ID to remove
 * @returns {Promise<Object>} { message }
 */
export async function cancelAction(sessionId, actionId) {
  const result = await sendRequest(
    `${BASE_URL}/sessions/${sessionId}/pending/${actionId}`,
    "DELETE"
  );

  try {
    broadcastEvent('bienbot:action_cancelled', {
      sessionId,
      actionId,
      version: Date.now()
    });
    logger.debug('[bienbot-api] bienbot:action_cancelled event dispatched', { sessionId, actionId });
  } catch (e) {
    // Silently ignore
  }

  return extractData(result);
}

// ---------------------------------------------------------------------------
// Context update (mid-session)
// ---------------------------------------------------------------------------

/**
 * Update session context mid-conversation (e.g. when user opens a plan item
 * modal while the BienBot drawer is already open).
 *
 * @param {string} sessionId - Session ID
 * @param {string} entity - Entity type (destination|experience|plan|plan_item|user)
 * @param {string} entityId - Entity ID
 * @returns {Promise<Object>} { entityLabel, context }
 */
export async function updateSessionContext(sessionId, entity, entityId) {
  const result = await sendRequest(
    `${BASE_URL}/sessions/${sessionId}/context`,
    "POST",
    { entity, entityId }
  );

  try {
    broadcastEvent('bienbot:context_updated', {
      sessionId,
      entity,
      entityId,
      version: Date.now()
    });
    logger.debug('[bienbot-api] bienbot:context_updated event dispatched', { sessionId, entity, entityId });
  } catch (e) {
    // Silently ignore
  }

  return extractData(result);
}

/**
 * BienBot — main chat endpoint (POST /api/bienbot/chat) plus the SSE-streaming
 * pipeline: response parsing, tool-call loop, plan-discover branch.
 *
 * Split out from `controllers/api/bienbot.js` (bd #f4ed).
 *
 * @module controllers/api/bienbot/chat
 */

const {
  crypto, fs, mongoose, logger, path,
  validateObjectId, successResponse, errorResponse,
  getEnforcer, classifyIntent,
  loadModels, Destination, Experience, Plan, User,
  BienBotSession,
  buildContextForInvokeContext, buildDestinationContext, buildExperienceContext,
  buildUserPlanContext, buildPlanItemContext, buildUserProfileContext,
  buildUserGreetingContext, buildSearchContext, buildSuggestionContext,
  buildDiscoveryContext, buildPlanNextStepsContext,
  executeActions, executeSingleWorkflowStep,
  ALLOWED_ACTION_TYPES, READ_ONLY_ACTION_TYPES, TOOL_CALL_ACTION_TYPES,
  validateActionPayload, summarizeIssues,
  resolveEntities, formatResolutionBlock, formatResolutionObjects, FIELD_TYPE_MAP,
  validateNavigationSchema, extractContextIds,
  extractMemoryFromSession, extractMemoryForCollaborators, formatMemoryBlock,
  extractText, validateDocument,
  uploadWithPipeline, retrieveFile, resolveAndValidateLocalUploadPath,
  GatewayError, callProvider, getApiKey, getProviderForTask, AI_TASKS,
  affinityCache, computeAndCacheAffinity, toolRegistry,
  MAX_MESSAGE_LENGTH, SUMMARY_CACHE_TTL_MS,
  HISTORY_TOKEN_BUDGET, HISTORY_CHARS_PER_TOKEN, HISTORY_MAX_CHARS,
  CONTEXT_TOKEN_BUDGET, CONTEXT_CHAR_BUDGET,
  ENTITY_LABEL_MAP, TOOL_CALL_LABELS,
  NAV_DEST_RE, NAV_EXP_RE, NAV_PLAN_RE,
  escapeUserInputLiteral, resolveExperienceIdFromInvokeContext, stripNullBytes,
  mergeReferencedEntitiesIntoContext, resolveEntityLabel, findPlanContainingItem,
  extractNavIds,
  enforceContextBudget, buildTokenAwareHistory,
  sendSSE, sendToolCallStart, sendToolCallEnd,
  adaptiveChunks, mapReadOnlyResultToStructuredContent,
  summarizeSession,
} = require('./_shared');

const { buildSystemPrompt, extractSearchTermFromHistory, buildContextBlocks } = require('./system-prompt');
const { ACTION_ENTITY_VERIFY, verifyPendingActionEntityIds, explodeWorkflows } = require('./actions');

// ---------------------------------------------------------------------------
// LLM response parsing
// ---------------------------------------------------------------------------

/**
 * Repair LLM output where the model embedded an inline entity JSON object
 * inside the `message` string field WITHOUT escaping its inner quotes,
 * e.g. `{"message":"Did you mean {"_id":"abc","name":"Casablanca"}?", ...}`
 *
 * Strategy: find `"message"\s*:\s*"`, then walk forward bracket-by-bracket.
 * The message string ends at the first `"` that is followed (after optional
 * whitespace) by `,` or `}` AND is at brace depth 0. Any `{` ... `}` block
 * encountered before that — including its inner `"` chars — is treated as
 * inline entity JSON and gets its quotes escaped.
 *
 * Returns the repaired text, or null if no repair was possible.
 */
function repairUnescapedInlineJson(text) {
  const startMatch = text.match(/"message"\s*:\s*"/);
  if (!startMatch) return null;
  const valueStart = startMatch.index + startMatch[0].length;

  let i = valueStart;
  let depth = 0;
  let endIdx = -1;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '\\' && i + 1 < text.length) {
      i += 2;
      continue;
    }
    if (ch === '{') {
      depth++;
      i++;
      continue;
    }
    if (ch === '}') {
      if (depth > 0) depth--;
      i++;
      continue;
    }
    if (ch === '"' && depth === 0) {
      // Check if this is the message-string terminator.
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j])) j++;
      if (j < text.length && (text[j] === ',' || text[j] === '}')) {
        endIdx = i;
        break;
      }
    }
    i++;
  }

  if (endIdx === -1) return null;

  const messageBody = text.slice(valueStart, endIdx);
  // Re-escape: turn unescaped " into \" inside the body. Existing escaped \"
  // and \\ stay intact.
  const repairedBody = messageBody.replace(/(^|[^\\])"/g, (_, prefix) => `${prefix}\\"`);

  return text.slice(0, valueStart) + repairedBody + text.slice(endIdx);
}

/**
 * Parse structured JSON response from LLM.
 *
 * Returns `{ message, pending_actions, entity_refs, tool_calls, _anomalies }`
 * — the leading-underscore `_anomalies` field is read by the chat controller
 * for prompt-injection telemetry and is NOT serialised to the client.
 *
 *   _anomalies = {
 *     unknown_action_types: string[],   // pending_actions or tool_calls with
 *                                        // types outside ALLOWED_ACTION_TYPES
 *     malformed_payloads: Array<{ type, summary }>,
 *                                        // actions that failed zod validation
 *     parse_errors: number               // count of fallback paths used
 *   }
 *
 * Anomaly counters are NEVER trusted from LLM output — they are produced
 * here from the validator/allowlist results.
 *
 * @param {string} text - The raw LLM response text.
 * @returns {object}
 */
function parseLLMResponse(text) {
  const anomalies = {
    unknown_action_types: [],
    malformed_payloads: [],
    parse_errors: 0
  };

  const tryParse = (raw) => {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
    try {
      if (typeof parsed.message !== 'string') return null;

      const registryWriteTools = toolRegistry.getWriteToolNames();
      const registryReadToolsForAction = toolRegistry.getReadToolNames();
      // pending_actions can include either write tools OR read tools that the
      // controller chooses to surface as cards (e.g. fetch_destination_tips,
      // fetch_entity_photos). Both must be allowed here.
      const isAllowedAction = (type) =>
        ALLOWED_ACTION_TYPES.includes(type) ||
        registryWriteTools.has(type) ||
        registryReadToolsForAction.has(type);

      const actions = Array.isArray(parsed.pending_actions)
        ? parsed.pending_actions
          .filter(a => {
            // Shape filter — keep the existing strict check
            if (!a || typeof a.id !== 'string' || typeof a.type !== 'string' ||
                !a.payload || typeof a.description !== 'string') {
              return false;
            }
            // Allowlist filter — track unknown types for telemetry
            if (!isAllowedAction(a.type)) {
              anomalies.unknown_action_types.push(a.type);
              return false;
            }
            // Per-action zod validation — track malformed payloads
            // Registry-owned tools have their own per-tool payload schemas
            // enforced at execute time; we still run the lenient default
            // schema here (which accepts any object) to surface parse-shape
            // anomalies in telemetry without false-positives.
            const validation = validateActionPayload(a.type, a.payload);
            if (!validation.ok) {
              if (validation.unknownType &&
                  (registryWriteTools.has(a.type) || registryReadToolsForAction.has(a.type))) {
                // Registry tool with no internal schema — defer validation
                // to the registry's per-tool schema at execute time.
                return true;
              }
              anomalies.malformed_payloads.push({
                type: a.type,
                summary: summarizeIssues(validation)
              });
              return false;
            }
            return true;
          })
          .map(a => {
            const action = { ...a };
            if (typeof action.confirm_label === 'string') {
              action.confirm_label = action.confirm_label.slice(0, 40) || undefined;
              if (!action.confirm_label) delete action.confirm_label;
            } else {
              delete action.confirm_label;
            }
            if (typeof action.dismiss_label === 'string') {
              action.dismiss_label = action.dismiss_label.slice(0, 40) || undefined;
              if (!action.dismiss_label) delete action.dismiss_label;
            } else {
              delete action.dismiss_label;
            }
            return action;
          })
        : [];

      const registryReadTools = toolRegistry.getReadToolNames();
      const isAllowedToolCall = (type) => TOOL_CALL_ACTION_TYPES.has(type) || registryReadTools.has(type);

      const toolCalls = Array.isArray(parsed.tool_calls)
        ? parsed.tool_calls
          .filter(tc => {
            if (!tc || typeof tc.type !== 'string' || !tc.payload || typeof tc.payload !== 'object') {
              return false;
            }
            if (!isAllowedToolCall(tc.type)) {
              anomalies.unknown_action_types.push(tc.type);
              return false;
            }
            const validation = validateActionPayload(tc.type, tc.payload);
            if (!validation.ok) {
              if (validation.unknownType && registryReadTools.has(tc.type)) {
                return true;
              }
              anomalies.malformed_payloads.push({
                type: tc.type,
                summary: summarizeIssues(validation)
              });
              return false;
            }
            return true;
          })
          .map(tc => ({ type: tc.type, payload: tc.payload }))
        : [];

      const isValidEntityRef = (r) =>
        r && typeof r._id === 'string' && r._id.length > 0 &&
        typeof r.type === 'string' && typeof r.name === 'string' &&
        !/<[^>]+>/.test(r._id); // reject placeholder values like <experience_id>

      const entityRefs = Array.isArray(parsed.entity_refs)
        ? parsed.entity_refs.filter(isValidEntityRef)
        : [];

      // Defensive harvest: if the LLM ignores instructions and embeds inline
      // JSON entity objects in the message text, lift them into entity_refs
      // and replace each occurrence with a ⟦entity:N⟧ placeholder so the
      // frontend renders a chip instead of raw JSON. New prompt instructs the
      // LLM to use ⟦entity:N⟧ directly; this branch handles legacy/drifted output.
      let messageText = typeof parsed.message === 'string' ? parsed.message : '';
      if (messageText.includes('{') && messageText.includes('"_id"')) {
        const seenIds = new Set(entityRefs.map(r => r._id));
        const inlinePattern = /\{[^{}]*"_id"\s*:\s*"[^"]*"[^{}]*\}/g;
        messageText = messageText.replace(inlinePattern, (match) => {
          try {
            const obj = JSON.parse(match);
            if (!isValidEntityRef(obj)) return match;
            let idx = entityRefs.findIndex(r => r._id === obj._id);
            if (idx === -1) {
              entityRefs.push(obj);
              seenIds.add(obj._id);
              idx = entityRefs.length - 1;
            }
            return `⟦entity:${idx}⟧`;
          } catch {
            return match;
          }
        });
      }

      return { message: messageText, pending_actions: actions, entity_refs: entityRefs, tool_calls: toolCalls, _anomalies: anomalies };
    } catch {
      return null;
    }
  };

  // 1. Try direct parse (optionally strip markdown fences)
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const direct = tryParse(cleaned);
  if (direct) return direct;

  // 1b. Strip markdown fences from anywhere in the text (handles prose before/after fences)
  const fenceStripped = text.replace(/```(?:json)?\s*\n?/gi, '').replace(/\n?\s*```/g, '').trim();
  if (fenceStripped !== cleaned) {
    const fenceResult = tryParse(fenceStripped);
    if (fenceResult) return fenceResult;
  }

  // 2. Try extracting the first JSON object from the text (handles leading/trailing prose)
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const extracted = tryParse(text.slice(firstBrace, lastBrace + 1));
    if (extracted) return extracted;
  }

  // 2b. Try extracting from fence-stripped text as well
  if (fenceStripped !== cleaned) {
    const fsBrace = fenceStripped.indexOf('{');
    const fsLastBrace = fenceStripped.lastIndexOf('}');
    if (fsBrace !== -1 && fsLastBrace > fsBrace) {
      const fsExtracted = tryParse(fenceStripped.slice(fsBrace, fsLastBrace + 1));
      if (fsExtracted) return fsExtracted;
    }
  }

  // 2c. Repair attempt for legacy unescaped inline-entity-JSON output.
  // Old prompt asked the LLM to embed {"_id":"...","name":"...","type":"..."}
  // inside the message string. Models sometimes forgot to escape inner quotes,
  // breaking the outer envelope. Detect that pattern, escape the inline JSON,
  // and reparse — so the legacy failure mode no longer truncates messages.
  if (text.trimStart().startsWith('{') && /"message"\s*:\s*"[^"]*\{\s*"_id"/.test(text)) {
    const repaired = repairUnescapedInlineJson(text);
    if (repaired && repaired !== text) {
      const repairedResult = tryParse(repaired);
      if (repairedResult) {
        logger.info('[bienbot] parseLLMResponse: repaired legacy inline-JSON envelope', {
          length: text.length
        });
        return repairedResult;
      }
    }
  }

  // From here down we are in an LLM-output-anomaly fallback path — count it
  // for telemetry so persistent provider drift becomes visible to operators.
  anomalies.parse_errors += 1;

  // 3. JSON-like but unparseable — try regex extraction, else friendly error
  if (text.trimStart().startsWith('{')) {
    const msgMatch = text.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (msgMatch) {
      let message;
      try {
        message = JSON.parse(`"${msgMatch[1]}"`);
      } catch {
        message = msgMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
      }

      // Also try to salvage pending_actions from the broken JSON
      let actions = [];
      try {
        const actionsMatch = text.match(/"pending_actions"\s*:\s*\[/);
        if (actionsMatch) {
          const actionsStart = actionsMatch.index + actionsMatch[0].length - 1;
          let depth = 0;
          let actionsEnd = -1;
          for (let i = actionsStart; i < text.length; i++) {
            if (text[i] === '[') depth++;
            else if (text[i] === ']') {
              depth--;
              if (depth === 0) { actionsEnd = i + 1; break; }
            }
          }
          if (actionsEnd > actionsStart) {
            const rawActions = JSON.parse(text.slice(actionsStart, actionsEnd));
            // Salvage path uses the same per-action validator so prompt-injection
            // defenses do not bypass when the LLM produces partly-broken JSON.
            actions = (Array.isArray(rawActions) ? rawActions : [])
              .filter(a => {
                if (!a || typeof a.id !== 'string' || typeof a.type !== 'string' ||
                    !a.payload || typeof a.description !== 'string') {
                  return false;
                }
                if (!ALLOWED_ACTION_TYPES.includes(a.type)) {
                  anomalies.unknown_action_types.push(a.type);
                  return false;
                }
                const validation = validateActionPayload(a.type, a.payload);
                if (!validation.ok) {
                  anomalies.malformed_payloads.push({
                    type: a.type,
                    summary: summarizeIssues(validation)
                  });
                  return false;
                }
                return true;
              });
          }
        }
      } catch { /* ignore — return message without actions */ }

      return { message, pending_actions: actions, entity_refs: [], tool_calls: [], _anomalies: anomalies };
    }
    logger.warn('[bienbot] parseLLMResponse: could not extract message from JSON-like response', {
      length: text.length,
      preview: text.slice(0, 120)
    });
    return { message: 'I had trouble formatting my response. Could you try rephrasing your request?', pending_actions: [], entity_refs: [], tool_calls: [], _anomalies: anomalies };
  }

  // 4. Plain text (no JSON structure) — return the text as the message
  // rather than showing an error, so the user at least sees the LLM response
  const trimmed = text.trim();
  if (trimmed.length > 0 && trimmed.length < 5000) {
    logger.warn('[bienbot] parseLLMResponse: returning plain text response (no JSON)', {
      length: trimmed.length,
      preview: trimmed.slice(0, 120)
    });
    return { message: trimmed, pending_actions: [], entity_refs: [], tool_calls: [], _anomalies: anomalies };
  }

  logger.warn('[bienbot] parseLLMResponse: no message field in response', {
    length: text.length,
    preview: text.slice(0, 120)
  });
  return { message: 'I had trouble formatting my response. Could you try rephrasing your request?', pending_actions: [], entity_refs: [], tool_calls: [], _anomalies: anomalies };
}

// ---------------------------------------------------------------------------
// Tool-use loop
// ---------------------------------------------------------------------------

/**
 * Execute a batch of LLM-proposed tool calls (read-only fetches) in parallel.
 * Returns a formatted tool-results block ready to inject into the second LLM
 * prompt, plus per-call metadata for telemetry.
 *
 * @param {Object} opts
 * @param {Array}  opts.toolCalls    - Parsed tool_calls array from first LLM response
 * @param {Object} opts.user         - req.user
 * @param {Object} opts.session      - BienBotSession (passed through to handlers)
 * @param {Function} [opts.executeAction] - Injected for tests; defaults to real executor
 * @param {Function} [opts.onCallStart] - Called per-call with { call_id, type, label }
 * @param {Function} [opts.onCallEnd]   - Called per-call with { call_id, ok }
 * @returns {Promise<{ toolResultsBlock: string, calls: Array }>}
 */
async function executeToolCallLoop({
  toolCalls,
  user,
  session,
  executeAction = require('../../../utilities/bienbot-action-executor').executeAction,
  onCallStart = () => {},
  onCallEnd = () => {},
  signal = undefined
}) {
  if (signal?.aborted) throw new Error('AbortError');

  const calls = await Promise.all(toolCalls.map(async (tc, idx) => {
    if (signal?.aborted) throw new Error('AbortError');
    const callId = `tc_${Date.now()}_${idx}`;
    const label = TOOL_CALL_LABELS[tc.type] || `Fetching ${tc.type.replace(/_/g, ' ')}…`;
    onCallStart({ call_id: callId, type: tc.type, label });
    const startedAt = Date.now();

    let body;
    let ok;
    let toolSource;
    try {
      let outcome;
      const registryEntry = toolRegistry.getTool(tc.type);
      if (registryEntry) {
        toolSource = 'registry';
        outcome = await toolRegistry.executeRegisteredTool(tc.type, tc.payload, user, {
          abortSignal: signal,
          session
        });
      } else {
        toolSource = 'internal';
        const action = { id: callId, type: tc.type, payload: tc.payload, description: label };
        outcome = await executeAction(action, user, session);
      }
      if (signal?.aborted) throw new Error('AbortError');
      body = outcome?.result?.body ?? outcome?.body ?? { ok: false, error: 'no_body' };
      ok = !!outcome?.success && !(body && body.ok === false);
    } catch (err) {
      if (err.message === 'AbortError') throw err;
      logger.error('[bienbot:tool-loop] handler threw', { type: tc.type, error: err.message });
      body = { ok: false, error: 'fetch_failed' };
      ok = false;
    }

    onCallEnd({ call_id: callId, ok });
    return {
      call_id: callId,
      type: tc.type,
      payload: tc.payload,
      body,
      ok,
      duration_ms: Date.now() - startedAt,
      tool_source: toolSource
    };
  }));

  if (signal?.aborted) throw new Error('AbortError');

  const toolResultsBlock = [
    '[TOOL RESULTS — for use in your reply, do not echo verbatim]',
    ...calls.map(c => {
      const payloadDigest = Object.entries(c.payload || {})
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(', ');
      return `${c.type}(${payloadDigest}): ${JSON.stringify(c.body)}`;
    }),
    '[/TOOL RESULTS]'
  ].join('\n');

  return { toolResultsBlock, calls };
}

// Export under a `_for-test` alias so tests can drive the function with a mock
// executeAction. The production callers use the closure-bound default.
exports._executeToolCallLoopForTest = executeToolCallLoop;

// ---------------------------------------------------------------------------
// Controller endpoints
// ---------------------------------------------------------------------------

/**
 * POST /api/bienbot/chat
 *
 * Main chat endpoint. Runs the full pipeline:
 * 1. Validate input
 * 2. Handle invokeContext (validate, resolve label, permission check, build context)
 * 3. Load or create session
 * 4. Classify intent
 * 5. Build context blocks
 * 6. Build augmented prompt and call LLM
 * 7. Parse structured JSON response
 * 8. Store pending_actions and messages in session
 * 9. SSE-stream the response
 */
exports.chat = async (req, res) => {
  const userId = req.user._id.toString();

  // --- Input validation ---
  // When multipart/form-data is used (file attachment), fields are strings in req.body
  let { message, sessionId, invokeContext } = req.body;

  // hiddenUserMessage — ephemeral override sent to the LLM instead of `message`.
  // Stored message (session history) always uses `message`; never stored.
  let hiddenUserMessage = req.body.hiddenUserMessage || null;
  if (hiddenUserMessage && typeof hiddenUserMessage === 'string') {
    hiddenUserMessage = stripNullBytes(hiddenUserMessage).trim().slice(0, MAX_MESSAGE_LENGTH) || null;
  } else {
    hiddenUserMessage = null;
  }

  // Parse invokeContext from string when sent as multipart form data
  if (typeof invokeContext === 'string') {
    try {
      invokeContext = JSON.parse(invokeContext);
    } catch {
      invokeContext = null;
    }
  }

  // Parse and validate navigationSchema (lean breadcrumb for BienBot context seeding)
  let navigationSchema = null;
  const rawNavSchema = req.body.navigationSchema;
  if (rawNavSchema) {
    try {
      const parsed = typeof rawNavSchema === 'string' ? JSON.parse(rawNavSchema) : rawNavSchema;
      const { valid, schema } = validateNavigationSchema(parsed);
      if (valid) navigationSchema = schema;
    } catch {
      // Ignore malformed schema — fall back to single-entity seeding
    }
  }

  if (!message || typeof message !== 'string') {
    return errorResponse(res, null, 'Message is required', 400);
  }

  // Strip null bytes and enforce length cap
  message = stripNullBytes(message).trim();
  if (message.length === 0) {
    return errorResponse(res, null, 'Message cannot be empty', 400);
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return errorResponse(res, null, `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters`, 400);
  }

  // Validate sessionId if provided
  let sessionObjId;
  if (sessionId) {
    const { valid, objectId } = validateObjectId(sessionId, 'sessionId');
    if (!valid) {
      return errorResponse(res, null, 'Invalid session ID format', 400);
    }
    sessionObjId = objectId;
  }

  // --- Attachment processing ---
  let attachmentData = null; // { filename, mimeType, fileSize, extractedText, extractionMethod, s3Key, ... }
  let pendingLocalFile = null; // Local temp file path to upload to S3 after session creation
  const uploadedFile = req.file;

  if (uploadedFile) {
    let safeTempPath;
    try {
      // Validate the uploaded file
      const validation = validateDocument({
        mimetype: uploadedFile.mimetype,
        size: uploadedFile.size
      });

      if (!validation.valid) {
        // Clean up temp file before returning error. resolveAndValidateLocalUploadPath
        // is the CodeQL-sanctioned sanitizer that breaks the taint chain from
        // uploadedFile.path. The multer dest is configured as 'uploads/temp' (inside
        // the upload root), so validation always succeeds for legitimate multer files.
        // The outer catch handles any unexpected failure gracefully.
        try {
          const safeCleanupPath = resolveAndValidateLocalUploadPath(uploadedFile.path);
          await fs.promises.unlink(safeCleanupPath);
        } catch { /* ignore — file may not exist or path check failed */ }
        return errorResponse(res, null, validation.error, 400);
      }

      // Resolve and validate the local path before any filesystem I/O.
      // Re-derive path from its own dirname+basename after validation so that
      // CodeQL's taint-tracking sees a locally-constructed path, not the
      // raw uploadedFile.path flowing into filesystem operations.
      const validatedTempPath = resolveAndValidateLocalUploadPath(uploadedFile.path);
      safeTempPath = path.resolve(path.dirname(validatedTempPath), path.basename(validatedTempPath));

      logger.info('[bienbot] Processing attachment', {
        filename: uploadedFile.originalname,
        mimeType: uploadedFile.mimetype,
        size: uploadedFile.size,
        userId
      });

      // Extract text from the file
      const extraction = await extractText(safeTempPath, uploadedFile.mimetype);

      attachmentData = {
        filename: uploadedFile.originalname,
        mimeType: uploadedFile.mimetype,
        fileSize: uploadedFile.size,
        extractedText: extraction.text || null,
        extractionMethod: extraction.metadata?.method || null
      };

      // Keep local file for S3 upload after session is created (need session ID for key)
      pendingLocalFile = safeTempPath;

      logger.info('[bienbot] Attachment text extracted', {
        method: attachmentData.extractionMethod,
        textLength: attachmentData.extractedText?.length || 0,
        userId
      });
    } catch (err) {
      logger.error('[bienbot] Attachment processing failed', { error: err.message, userId });
      // Continue without the attachment rather than failing the whole request
      attachmentData = {
        filename: uploadedFile.originalname,
        mimeType: uploadedFile.mimetype,
        fileSize: uploadedFile.size,
        extractedText: null,
        extractionMethod: 'failed'
      };
      // Clean up on extraction failure using the validated path if available
      if (safeTempPath) {
        try { await fs.promises.unlink(safeTempPath); } catch { /* ignore */ }
      }
    }
  }

  // --- Step 0: Handle invokeContext ---
  let invokeLabel = null;
  let invokeContextBlock = null;
  let resolvedInvokeContext = null;

  if (invokeContext && invokeContext.id && invokeContext.entity) {
    // Strip null bytes from invoke context fields
    invokeContext.id = stripNullBytes(invokeContext.id);
    invokeContext.entity = stripNullBytes(invokeContext.entity);
    if (invokeContext.contextDescription) {
      invokeContext.contextDescription = stripNullBytes(String(invokeContext.contextDescription)).slice(0, 200);
    }

    const { valid, objectId: invokeObjId } = validateObjectId(invokeContext.id, 'invokeContext.id');
    if (!valid) {
      return errorResponse(res, null, 'Invalid invokeContext.id format', 400);
    }

    // Resolve entity label from DB (never trust client-supplied label)
    invokeLabel = await resolveEntityLabel(invokeContext.entity, invokeContext.id);
    if (!invokeLabel) {
      return errorResponse(res, null, 'Entity not found', 404);
    }

    // Permission check: canView
    loadModels();
    const enforcer = getEnforcer({ Destination, Experience, Plan, User });
    let resource;

    try {
      switch (invokeContext.entity) {
        case 'destination':
          resource = await Destination.findById(invokeObjId).lean();
          break;
        case 'experience':
          resource = await Experience.findById(invokeObjId).lean();
          break;
        case 'plan':
          resource = await Plan.findById(invokeObjId).lean();
          break;
        case 'plan_item': {
          // plan_item is a subdocument — find parent plan and use it for permission check
          const parentPlan = await findPlanContainingItem(invokeObjId);
          if (parentPlan) {
            resource = parentPlan;
            // Stash the parent plan ID for context builder and session context
            invokeContext._parentPlanId = parentPlan._id.toString();
          }
          break;
        }
        case 'user':
          resource = await User.findById(invokeObjId).lean();
          break;
        default:
          return errorResponse(res, null, 'Unknown entity type', 400);
      }
    } catch (err) {
      logger.error('[bienbot] Failed to load entity for permission check', { error: err.message });
      return errorResponse(res, null, 'Failed to verify permissions', 500);
    }

    if (!resource) {
      return errorResponse(res, null, 'Entity not found', 404);
    }

    // User entities don't go through canView - any authenticated user can view profiles
    if (invokeContext.entity !== 'user') {
      const permCheck = await enforcer.canView({ userId: req.user._id, resource });
      if (!permCheck.allowed) {
        return errorResponse(res, null, 'You do not have permission to view this entity', 403);
      }
    }

    resolvedInvokeContext = {
      entity: invokeContext.entity,
      entity_id: invokeContext.id,
      entity_label: invokeLabel
    };

    // Ensure affinity is cached for this entity before building invoke context.
    // If the background refresh has not yet run, compute now (blocking) so the
    // invoke context receives enriched affinity data on first open.
    if (invokeContext.entity === 'experience' || invokeContext.entity === 'plan') {
      const experienceId = resolveExperienceIdFromInvokeContext(resolvedInvokeContext);
      if (experienceId) {
        try {
          const existing = await affinityCache.getAffinityEntry(userId, experienceId);
          if (!existing) {
            // Cache miss — compute now (blocking) so invoke context is enriched
            await computeAndCacheAffinity(userId, experienceId);
          }
        } catch (affinityErr) {
          // Non-fatal — proceed without affinity enrichment
          logger.warn('[bienbot] Affinity cache-miss fallback failed, continuing without it', {
            userId,
            experienceId,
            error: affinityErr.message
          });
        }
      }
    }

    // Build context block for invokeContext
    const contextOptions = {};
    if (invokeContext.entity === 'plan_item' && invokeContext._parentPlanId) {
      contextOptions.planId = invokeContext._parentPlanId;
    }
    // Use navigationSchema to supply parent plan_id when not passed explicitly by the client
    if (invokeContext.entity === 'plan_item' && !contextOptions.planId && navigationSchema?.plan_item?.plan_id) {
      contextOptions.planId = navigationSchema.plan_item.plan_id;
    }
    invokeContextBlock = await buildContextForInvokeContext(
      resolvedInvokeContext,
      userId,
      contextOptions
    );
  }

  // --- Step 1: Load or create session ---
  let session;
  // Hoisted so the LLM pipeline gate below can enforce role regardless of control flow.
  // null means a new session (owner by definition); 'owner' | 'editor' | 'viewer' for existing.
  let sessionRole = null;

  try {
    if (sessionId) {
      session = await BienBotSession.findById(sessionObjId);
      if (!session) {
        return errorResponse(res, null, 'Session not found', 404);
      }
      const access = session.checkAccess(userId);
      if (!access.hasAccess) {
        return errorResponse(res, null, 'Session not found', 404);
      }
      sessionRole = access.role;
      // Viewers cannot send messages — only owner and editors can
      if (access.role === 'viewer') {
        return errorResponse(res, null, 'You have view-only access to this session', 403);
      }

      // --- Shared comment shortcut ---
      // Editors (shared collaborators) always post shared_comments — no LLM pipeline.
      // Session owners posting a reply to a shared comment are also peer exchanges.
      // comment_only flag: explicitly signals that the frontend wants a JSON response,
      // not SSE (used by postSharedComment regardless of replyTo).
      const { reply_to: replyToMsgId, comment_only: commentOnly } = req.body;
      const isSharedComment = access.role === 'editor' || commentOnly === true || (access.role === 'owner' && replyToMsgId);

      if (isSharedComment) {
        try {
          // Resolve reply preview if replying to an existing message
          let replyToPreview = null;
          if (replyToMsgId) {
            const repliedMsg = (session.messages || []).find(m => m.msg_id === replyToMsgId);
            if (repliedMsg) {
              replyToPreview = repliedMsg.content.length > 200
                ? repliedMsg.content.substring(0, 197) + '...'
                : repliedMsg.content;
            }
          }

          const senderName = req.user.name || req.user.email || 'User';
          await session.addMessage('user', message, {
            message_type: 'shared_comment',
            sender_name: senderName,
            sentBy: req.user._id,
            reply_to: replyToMsgId || null,
            reply_to_preview: replyToPreview
          });
          await session.generateTitle();

          const savedMsg = session.messages[session.messages.length - 1];
          logger.info('[bienbot] Shared comment posted', {
            sessionId: session._id.toString(),
            userId,
            role: access.role
          });

          return successResponse(res, {
            session: { _id: session._id, title: session.title },
            message: savedMsg
          }, 'Comment posted');
        } catch (commentErr) {
          logger.error('[bienbot] Failed to save shared comment', { error: commentErr.message });
          return errorResponse(res, commentErr, 'Failed to post comment', 500);
        }
      }
    } else {
      session = await BienBotSession.createSession(userId, resolvedInvokeContext || {});

      // Persist the analysis greeting (if any) as the opening assistant turn so
      // the LLM has context for follow-up questions. Only accepted on new sessions
      // (no sessionId) to prevent injecting arbitrary history into existing sessions.
      const rawPriorGreeting = req.body.priorGreeting;
      if (rawPriorGreeting && typeof rawPriorGreeting === 'string') {
        const sanitizedGreeting = stripNullBytes(rawPriorGreeting).trim().slice(0, 4000);
        // Only accept analysis greetings that originate from the server's own /analyze
        // endpoint. The [ANALYSIS] sentinel is prepended client-side from formatAnalysisSuggestions;
        // greetings without it are silently dropped to prevent prompt injection.
        const isServerAnalysisGreeting = sanitizedGreeting.startsWith('[ANALYSIS]');
        if (sanitizedGreeting && isServerAnalysisGreeting) {
          // Strip the [ANALYSIS] sentinel before persisting — it is a server-side
          // origin marker, not user-facing content. Leaving it in the stored message
          // would surface "[ANALYSIS] 🔍 Here's what I noticed..." every time the
          // session is reloaded in the panel.
          const greetingForStorage = sanitizedGreeting
            .replace(/^\[ANALYSIS\]\s*\n?/, '')
            .trim();
          if (greetingForStorage) {
            try {
              await session.addMessage('assistant', greetingForStorage, { message_type: 'greeting' });
            } catch (greetingErr) {
              // Non-fatal — proceed without the prior greeting
              logger.warn('[bienbot] Failed to persist prior greeting', { error: greetingErr.message });
            }
          }
        }
      }

      // Pre-populate context with the full ancestor chain.
      // navigationSchema carries all ancestor IDs transitively (e.g. opening BienBot
      // from a Plan also provides experience_id and destination_id immediately), so we
      // can fire all context builders in parallel from the very first message.
      // Fall back to single-entity seeding when no schema is present.
      let contextUpdate = {};
      if (navigationSchema) {
        contextUpdate = extractContextIds(navigationSchema);
      } else if (resolvedInvokeContext) {
        switch (resolvedInvokeContext.entity) {
          case 'destination':
            contextUpdate.destination_id = resolvedInvokeContext.entity_id;
            break;
          case 'experience':
            contextUpdate.experience_id = resolvedInvokeContext.entity_id;
            break;
          case 'plan':
            contextUpdate.plan_id = resolvedInvokeContext.entity_id;
            break;
          case 'plan_item':
            contextUpdate.plan_item_id = resolvedInvokeContext.entity_id;
            if (invokeContext._parentPlanId) {
              contextUpdate.plan_id = invokeContext._parentPlanId;
            }
            break;
        }
      }
      if (Object.keys(contextUpdate).length > 0) {
        await session.updateContext(contextUpdate);
      }

      // Merge priorReferencedEntities (the entities the analyze LLM identified
      // as the focus of its greeting) into session.context. Tied to the same
      // gating as priorGreeting — only accepted on new sessions, only when a
      // valid analysis sentinel is also provided.
      const rawReferenced = req.body.priorReferencedEntities;
      const isServerAnalysisGreeting =
        typeof req.body.priorGreeting === 'string'
        && stripNullBytes(req.body.priorGreeting).trim().startsWith('[ANALYSIS]');
      if (
        Array.isArray(rawReferenced)
        && rawReferenced.length > 0
        && isServerAnalysisGreeting
      ) {
        try {
          const merged = await mergeReferencedEntitiesIntoContext({
            referencedEntities: rawReferenced,
            session,
            userId
          });
          if (merged.appliedCount > 0) {
            logger.info('[bienbot] Seeded session.context from priorReferencedEntities', {
              sessionId: session._id.toString(),
              userId,
              applied: merged.applied,
              skipped: merged.skipped
            });
          }
        } catch (refErr) {
          // Non-fatal — context can be re-derived from the conversation later
          logger.warn('[bienbot] Failed to merge priorReferencedEntities', { error: refErr.message });
        }
      }
    }
  } catch (err) {
    logger.error('[bienbot] Session load/create failed', { error: err.message });
    return errorResponse(res, null, 'Failed to load session', 500);
  }

  // --- LLM pipeline gate ---
  // Hard enforcement: only session owners may reach the LLM pipeline.
  // Editors are always diverted to the shared-comment path above and must never
  // reach this point. If they do (e.g. due to a future code path change or
  // payload manipulation that bypasses the isSharedComment check), reject here.
  // sessionRole is null only for brand-new sessions, where the creator is owner.
  if (sessionRole !== null && sessionRole !== 'owner') {
    logger.error('[bienbot] LLM pipeline access denied — non-owner reached pipeline', {
      userId,
      sessionId: session?._id?.toString(),
      role: sessionRole
    });
    return errorResponse(res, null, 'Only the session owner can use the AI assistant', 403);
  }

  // --- Step 2: Classify intent ---
  // Use hiddenUserMessage when present so the classifier sees the true intent
  // ("confirm plan, suggest next steps") rather than the stored visible text.
  const classifyText = hiddenUserMessage || message;
  const classification = await classifyIntent(classifyText, {
    userId,
    sessionId: session._id.toString(),
    user: req.user
  });

  logger.info('[bienbot] Intent classified', {
    userId,
    sessionId: session._id.toString(),
    intent: classification.intent,
    confidence: classification.confidence,
    source: classification.source,
    isMultiAction: classification.isMultiAction || false,
    multiActionVerbs: classification.multiActionVerbs || null
  });

  // --- Step 2b: Resolve entity names ---
  let entityResolutionBlock = null;
  let resolvedEntityObjects = [];
  try {
    // Extract only the fields the resolver knows about
    const extractedNames = {};
    if (classification.entities) {
      for (const [key, value] of Object.entries(classification.entities)) {
        if (FIELD_TYPE_MAP[key] && value) {
          extractedNames[key] = value;
        }
      }
    }

    // Enrich with multi-action entity names when detected
    if (classification.isMultiAction && classification.multiActionEntities) {
      const mae = classification.multiActionEntities;
      if (mae.destination_names?.length && !extractedNames.destination_name) {
        extractedNames.destination_name = mae.destination_names[0];
      }
      if (mae.experience_names?.length && !extractedNames.experience_name) {
        extractedNames.experience_name = mae.experience_names[0];
      }
      if (mae.user_refs?.length && !extractedNames.user_email && !extractedNames.assignee_name) {
        // Check if it looks like an email
        const emailRef = mae.user_refs.find(r => r.includes('@'));
        if (emailRef) {
          extractedNames.user_email = emailRef;
        } else {
          extractedNames.assignee_name = mae.user_refs[0];
        }
      }
    }

    if (Object.keys(extractedNames).length > 0) {
      const resolutionResult = await resolveEntities(extractedNames, req.user, {
        destinationId: session.context?.destination_id?.toString() || null,
      });

      entityResolutionBlock = formatResolutionBlock(resolutionResult, extractedNames);
      resolvedEntityObjects = formatResolutionObjects(resolutionResult);

      logger.info('[bienbot] Entity resolution complete', {
        userId,
        sessionId: session._id.toString(),
        resolved: Object.keys(resolutionResult.resolved),
        ambiguous: Object.keys(resolutionResult.ambiguous),
        unresolved: resolutionResult.unresolved,
      });

      // For each unresolved entity name, run a DB search and attach to the entity
      // resolution block so the LLM gets search results even when the resolver
      // couldn't find a high-confidence match.
      if (resolutionResult.unresolved.length > 0) {
        const unresolvedSearchBlocks = await Promise.all(
          resolutionResult.unresolved.map(field =>
            extractedNames[field]
              ? buildSearchContext(extractedNames[field], userId).catch(() => null)
              : Promise.resolve(null)
          )
        );
        const unresolvedBlocks = unresolvedSearchBlocks.filter(Boolean);
        if (unresolvedBlocks.length > 0) {
          entityResolutionBlock = [entityResolutionBlock, ...unresolvedBlocks].filter(Boolean).join('\n\n');
        }
      }

      // Short-circuit with disambiguation actions for ambiguous entity matches.
      // Only handles destination and plan since experience/user ambiguity is left to the LLM.
      const disambiguationActions = [];
      if (Object.keys(resolutionResult.ambiguous).length > 0) {
        for (const [field, candidates] of Object.entries(resolutionResult.ambiguous)) {
          const entityType = FIELD_TYPE_MAP[field];
          let actionType = null;
          if (entityType === 'destination') {
            actionType = 'select_destination';
          } else if (entityType === 'plan') {
            actionType = 'select_plan';
          }
          if (actionType && candidates?.length > 1) {
            disambiguationActions.push({
              id: `action_${crypto.randomBytes(4).toString('hex')}`,
              type: actionType,
              payload: { candidates },
              description: `Which ${entityType} did you mean? (${candidates.map(c => c.name).join(', ')})`,
              executed: false
            });
          }
        }
      }
      if (disambiguationActions.length > 0) {
        logger.info('[bienbot] Short-circuiting with disambiguation actions', {
          userId,
          sessionId: session._id.toString(),
          count: disambiguationActions.length,
          types: disambiguationActions.map(a => a.type)
        });
        await session.addMessage('user', message, { intent: classification.intent, sentBy: req.user._id });
        await session.addMessage('assistant', 'I found multiple possible matches. Please select which one you meant.', {
          actions_taken: disambiguationActions.map(a => a.type)
        });
        sendSSE(res, 'actions', { actions: disambiguationActions });
        sendSSE(res, 'done', { intent: 'disambiguate', message: '' });
        res.end();
        return;
      }
    }
  } catch (err) {
    logger.warn('[bienbot] Entity resolution failed, continuing without it', { error: err.message });
  }

  // --- Step 2d: Navigation resolution (runs BEFORE plan disambiguation) ---
  // Detect navigation intent via pattern matching (NLP classifier may not catch all forms).
  // Short-circuit with a navigate_to_entity action instead of relying on the LLM to build URLs.
  const NAV_PATTERN = /^(?:navigate\s+to|take\s+me\s+to|go\s+to|show\s+me|open|bring\s+me\s+to|direct\s+me\s+to|i\s+want\s+to\s+(?:see|view|visit|go\s+to))\b/i;
  const isNavIntent = classification.intent === 'NAVIGATE_TO_ENTITY' || NAV_PATTERN.test(message.trim());
  logger.debug('[bienbot] Nav resolution check', { intent: classification.intent, isNavIntent, messageStart: message.trim().substring(0, 50) });
  if (isNavIntent) {
    try {
      loadModels();

      // Build a search hint from entities or the raw message (strip navigation verbs)
      const rawHint = classification.entities?.experience_name
        || classification.entities?.destination_name
        || message.trim().replace(NAV_PATTERN, '').trim().replace(/^the\s+/i, '').trim();
      const navHint = rawHint.toLowerCase();
      logger.debug('[bienbot] Nav search hint', { rawHint, navHint });

      // Search user plans, experiences, and destinations in parallel.
      // Experiences include public ones AND those the user has access to (owns or is a collaborator on).
      const navUserObjectId = new mongoose.Types.ObjectId(userId);
      const [navUserPlans, navExperiences, navDestinations] = await Promise.all([
        Plan.find({ user: userId })
          .populate({ path: 'experience', select: 'name destination', populate: { path: 'destination', select: 'name' } })
          .select('experience planned_date')
          .lean(),
        Experience.find({
          $or: [{ visibility: 'public' }, { 'permissions._id': navUserObjectId }]
        }).select('name destination').populate('destination', 'name').limit(100).lean(),
        Destination.find({ visibility: 'public' }).select('name').limit(50).lean()
      ]);

      // Score matches using substring containment and word overlap (both directions)
      const navHintWords = navHint.split(/\s+/).filter(w => w.length > 2);
      const scoreNavMatch = (name) => {
        if (!name) return 0;
        const lower = name.toLowerCase();
        if (lower === navHint || navHint === lower) return 100;
        if (lower.includes(navHint) || navHint.includes(lower)) return 80;
        if (navHintWords.length >= 2) {
          // Query-side: most hint words appear in entity name
          const matchCount = navHintWords.filter(w => lower.includes(w)).length;
          const ratio = matchCount / navHintWords.length;
          if (ratio >= 0.5) return Math.round(ratio * 60);
          // Entity-side: most entity name words appear in hint (handles long hints)
          const nameWords = lower.split(/\s+/).filter(w => w.length > 2);
          if (nameWords.length >= 2) {
            const entityMatchCount = nameWords.filter(w => navHint.includes(w)).length;
            if (entityMatchCount >= Math.ceil(nameWords.length * 0.5)) return Math.round((entityMatchCount / nameWords.length) * 55);
          }
        }
        return 0;
      };

      const navCandidates = [];

      // Score user plans
      for (const p of navUserPlans) {
        const expName = p.experience?.name || '';
        const destName = p.experience?.destination?.name || '';
        const score = Math.max(scoreNavMatch(expName), scoreNavMatch(destName), scoreNavMatch(`${expName} ${destName}`));
        if (score > 0) {
          const expId = p.experience?._id?.toString();
          navCandidates.push({
            score,
            type: 'plan',
            url: expId ? `/experiences/${expId}#plan-${p._id}` : null,
            label: `${expName}${destName ? ` in ${destName}` : ''}`
          });
        }
      }

      // Score experiences
      for (const e of navExperiences) {
        const score = scoreNavMatch(e.name);
        if (score > 0) {
          navCandidates.push({
            score,
            type: 'experience',
            url: `/experiences/${e._id}`,
            label: `${e.name}${e.destination?.name ? ` in ${e.destination.name}` : ''}`
          });
        }
      }

      // Score destinations
      for (const d of navDestinations) {
        const score = scoreNavMatch(d.name);
        if (score > 0) {
          navCandidates.push({
            score,
            type: 'destination',
            url: `/destinations/${d._id}`,
            label: d.name
          });
        }
      }

      // Sort by score descending and pick the best match
      navCandidates.sort((a, b) => b.score - a.score);
      logger.debug('[bienbot] Nav candidates', { count: navCandidates.length, top3: navCandidates.slice(0, 3).map(c => ({ label: c.label, score: c.score, type: c.type })) });
      const best = navCandidates.find(c => c.url);

      if (best) {
        const navAction = {
          id: `action_${crypto.randomBytes(4).toString('hex')}`,
          type: 'navigate_to_entity',
          payload: { url: best.url, entity: best.type, label: best.label },
          description: `Navigate to ${best.label}`
        };

        const navMsg = `Taking you to ${best.label}.`;

        // Store in session
        await session.addMessage('user', message, { intent: classification.intent, sentBy: req.user._id });
        await session.addMessage('assistant', navMsg, { actions_taken: ['navigate_to_entity'] });
        await session.setPendingActions([navAction]);
        await session.generateTitle();

        // SSE-stream the response
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no'
        });

        sendSSE(res, 'session', { sessionId: session._id.toString(), title: session.title });
        sendSSE(res, 'token', { text: navMsg });
        sendSSE(res, 'actions', { pending_actions: [navAction] });
        sendSSE(res, 'done', { intent: classification.intent, confidence: classification.confidence, source: 'nav_resolution' });
        res.end();

        logger.info('[bienbot] Navigation resolved directly', {
          userId,
          target: best.label,
          type: best.type,
          score: best.score
        });
        return;
      }
      // No match found → fall through to plan disambiguation / normal LLM flow
    } catch (err) {
      logger.warn('[bienbot] Navigation resolution failed, continuing with LLM', { error: err.message });
    }
  }

  // --- Step 2e: Destination gate + Plan/Discover short-circuit for PLAN_EXPERIENCE ---
  // When the user wants to plan a trip to a destination, show:
  //   1. Their existing plans for that destination (select_plan cards)
  //   2. Available experiences to create a new plan from (discovery_result_list)
  // This bypasses the LLM for a faster, deterministic, richer response.
  //
  // Branch A: destination already in session context → run plan+discover immediately.
  // Branch B: no destination in context → resolve from message:
  //   HIGH confidence  → auto-inject destination_id + run plan+discover
  //   MEDIUM confidence → stream select_destination disambiguation cards
  //   LOW confidence    → fall through to LLM

  // runPlanDiscover is defined as a module-level function — see below exports.chat.


  if (classification.intent === 'PLAN_EXPERIENCE' && !session.context?.plan_id) {
    try {
      loadModels();
      // 1. Check for selected experience (from session context, invokeContext, or resolved entities)
      let selectedExperienceId = null;
      let selectedExperienceName = null;
      // Priority: session.context.experience_id, invokeContext, resolvedEntityObjects
      if (session.context?.experience_id) {
        selectedExperienceId = session.context.experience_id.toString();
      } else if (resolvedInvokeContext && resolvedInvokeContext.entity === 'experience') {
        selectedExperienceId = resolvedInvokeContext.entity_id;
      } else if (resolvedEntityObjects && resolvedEntityObjects.length > 0) {
        const expRef = resolvedEntityObjects.find(e => e.type === 'experience');
        if (expRef) selectedExperienceId = expRef._id;
      }

      if (selectedExperienceId && mongoose.Types.ObjectId.isValid(selectedExperienceId)) {
        const selectedExpOid = new mongoose.Types.ObjectId(selectedExperienceId);
        // Fetch the experience name
        const expDoc = await Experience.findById(selectedExpOid).select('name destination').populate('destination', 'name').lean();
        // Sanitize DB-fetched name strings at assignment to break the
        // user-input taint chain that flows through the ObjectId query result.
        selectedExperienceName = String(expDoc?.name || '').replace(/[\u0000-\u001F\u007F]/g, '').trim() || '(unnamed experience)';
        const destinationName = String(expDoc?.destination?.name || '').replace(/[\u0000-\u001F\u007F]/g, '').trim();

        // Check if user already has a plan for this experience
        const existingPlan = await Plan.findOne({ user: userId, experience: selectedExpOid }).lean();

        await session.addMessage('user', message, { intent: classification.intent, sentBy: req.user._id });

        if (existingPlan) {
          // User already has a plan for this experience
          // Ask if they want to create a new plan or work on the existing one
          const actions = [
            {
              id: `action_${crypto.randomBytes(4).toString('hex')}`,
              type: 'select_plan',
              payload: {
                plan_id: existingPlan._id.toString(),
                experience_name: selectedExperienceName,
                destination_name: destinationName,
                planned_date: existingPlan.planned_date || null,
                item_count: (existingPlan.plan || []).length
              },
              description: `Work on your existing plan for ${selectedExperienceName}${destinationName ? ` in ${destinationName}` : ''}`
            },
            {
              id: `action_${crypto.randomBytes(4).toString('hex')}`,
              type: 'create_plan',
              payload: {
                experience_id: selectedExperienceId
              },
              description: `Create a new plan for ${selectedExperienceName}${destinationName ? ` in ${destinationName}` : ''}`
            }
          ];
          const msg = `You already have a plan for ${selectedExperienceName}${destinationName ? ` in ${destinationName}` : ''}. Would you like to work on your existing plan or create a new one?`;
          await session.addMessage('assistant', msg, { actions_taken: ['select_plan', 'create_plan'] });
          await session.setPendingActions(actions);
          await session.generateTitle();

          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no'
          });
          sendSSE(res, 'session', { sessionId: session._id.toString(), title: session.title });
          for (const chunk of adaptiveChunks(msg)) {
            sendSSE(res, 'token', { text: chunk });
          }
          sendSSE(res, 'actions', { pending_actions: actions });
          sendSSE(res, 'done', { intent: classification.intent, confidence: classification.confidence, source: 'plan_experience_existing_plan' });
          res.end();
          logger.info('[bienbot] PLAN_EXPERIENCE: user has existing plan for experience', { userId, experience: selectedExperienceId });
          return;
        } else {
          // No plan exists for this experience, propose create_plan
          const action = {
            id: `action_${crypto.randomBytes(4).toString('hex')}`,
            type: 'create_plan',
            payload: {
              experience_id: selectedExperienceId
            },
            description: `Create a new plan for ${selectedExperienceName}${destinationName ? ` in ${destinationName}` : ''}`
          };
          const msg = `Let's create a new plan for ${selectedExperienceName}${destinationName ? ` in ${destinationName}` : ''}. Ready to get started?`;
          await session.addMessage('assistant', msg, { actions_taken: ['create_plan'] });
          await session.setPendingActions([action]);
          await session.generateTitle();

          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no'
          });
          sendSSE(res, 'session', { sessionId: session._id.toString(), title: session.title });
          for (const chunk of adaptiveChunks(msg)) {
            sendSSE(res, 'token', { text: chunk });
          }
          sendSSE(res, 'actions', { pending_actions: [action] });
          sendSSE(res, 'done', { intent: classification.intent, confidence: classification.confidence, source: 'plan_experience_create_plan' });
          res.end();
          logger.info('[bienbot] PLAN_EXPERIENCE: proposed create_plan for experience', { userId, experience: selectedExperienceId });
          return;
        }
      }
      // If no experience is selected, fall back to original plan/discover logic
      // ── A: Destination already in context → resolve name and run plan+discover ──
      const { resolveEntity, ResolutionConfidence } = require('../../../utilities/bienbot-entity-resolver');
      if (session.context?.destination_id) {
        const ctxDest = await Destination.findById(session.context.destination_id).select('name').lean();
        const destNameFromCtx = ctxDest?.name || classification.entities?.destination_name || '';
        if (destNameFromCtx) {
          const streamed = await runPlanDiscover(destNameFromCtx, { userId, session, message, classification, req, res });
          if (streamed) return;
        }
      } else {
        // ── B: No destination in context → resolve from message ──────────────────
        const destQuery = classification.entities?.destination_name
          || classification.entities?.experience_name
          || message;
        if (destQuery && destQuery.trim().length >= 2) {
          const { candidates, confidence } = await resolveEntity(
            destQuery.trim(), 'destination', req.user
          );
          if (confidence === ResolutionConfidence.HIGH && candidates.length > 0) {
            const top = candidates[0];
            await session.updateContext({ destination_id: top.id });
            const streamed = await runPlanDiscover(top.name || destQuery.trim(), { userId, session, message, classification, req, res });
            if (streamed) return;
          } else if (confidence === ResolutionConfidence.MEDIUM && candidates.length > 0) {
            const destActions = candidates.slice(0, 5).map(c => ({
              id: `action_${crypto.randomBytes(4).toString('hex')}`,
              type: 'select_destination',
              payload: {
                destination_id: c.id,
                destination_name: c.name,
                experience_name: c.name,
                country: c.meta?.country || null,
                city: c.meta?.city || null
              },
              description: c.name
            }));
            const disambigMsg = candidates.length > 1
              ? `I found a few destinations matching "${destQuery.trim()}". Which one did you mean?`
              : `I found a destination matching "${destQuery.trim()}". Is this the one?`;
            await session.addMessage('assistant', disambigMsg, { actions_taken: ['select_destination'] });
            await session.setPendingActions(destActions);
            await session.generateTitle();
            res.writeHead(200, {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
              'X-Accel-Buffering': 'no'
            });
            sendSSE(res, 'session', { sessionId: session._id.toString(), title: session.title });
            for (const chunk of adaptiveChunks(disambigMsg)) {
              sendSSE(res, 'token', { text: chunk });
            }
            sendSSE(res, 'actions', { pending_actions: destActions });
            sendSSE(res, 'done', { intent: classification.intent, confidence: classification.confidence, source: 'destination_gate' });
            res.end();
            logger.info('[bienbot] Destination gate — streamed select_destination cards', { userId, destQuery: destQuery.trim(), count: destActions.length });
            return;
          }
        }
      }
    } catch (err) {
      logger.warn('[bienbot] PLAN_EXPERIENCE handler failed, continuing with LLM', { error: err.message });
    }
  }

  // --- Step 2c: Plan disambiguation ---
  // If a plan-related intent is detected but no plan_id in session context,
  // find matching plans. 1 match → auto-inject; 2+ → stream disambiguation.
  const PLAN_RELATED_INTENTS = new Set([
    'QUERY_PLAN', 'ADD_PLAN_ITEMS', 'UPDATE_PLAN_ITEM', 'COMPLETE_PLAN_ITEM',
    'UNCOMPLETE_PLAN_ITEM', 'SCHEDULE_PLAN_ITEM', 'ADD_PLAN_ITEM_NOTE',
    'SET_PLAN_ITEM_LOCATION', 'UPDATE_PLAN_ITEM_COST', 'ADD_PLAN_ITEM_DETAIL',
    'ASSIGN_PLAN_ITEM', 'UPDATE_PLAN_ITEM_TEXT', 'UPDATE_PLAN_ITEM_URL',
    'UPDATE_PLAN', 'DELETE_PLAN', 'DELETE_PLAN_ITEM', 'ADD_PLAN_COST',
    'SYNC_PLAN', 'PLAN_EXPERIENCE'
  ]);

  const ctx = session.context || {};
  if (PLAN_RELATED_INTENTS.has(classification.intent) && !ctx.plan_id) {
    // When the user is on a specific entity page (resolvedInvokeContext or session.invoke_context),
    // they are clearly referring to THAT entity. Skip disambiguation entirely —
    // the LLM/executor will resolve the correct plan from the invoke context.
    // This prevents "Unplan this experience" on Nashville from showing a picker
    // of all 42 user plans across all destinations.
    //
    // resolvedInvokeContext comes from the current request's invokeContext param;
    // session.invoke_context is the stored context from when BienBot was opened.
    // For resumed sessions that don't re-send invokeContext, we fall back to session.invoke_context.
    const effectiveInvokeContext = resolvedInvokeContext || (
      session.invoke_context?.entity && session.invoke_context?.entity_id
        ? { entity: session.invoke_context.entity, entity_id: session.invoke_context.entity_id.toString() }
        : null
    );
    const hasEntityPageContext =
      (effectiveInvokeContext?.entity === 'experience' && effectiveInvokeContext?.entity_id) ||
      (effectiveInvokeContext?.entity === 'plan' && effectiveInvokeContext?.entity_id);

    logger.info('[bienbot] Step 2c plan disambiguation gate', {
      hasEntityPageContext,
      resolvedInvokeContext: resolvedInvokeContext ? { entity: resolvedInvokeContext.entity, entity_id: resolvedInvokeContext.entity_id } : null,
      sessionInvokeContext: session.invoke_context ? { entity: session.invoke_context.entity, entity_id: session.invoke_context.entity_id?.toString() } : null,
      effectiveInvokeContext: effectiveInvokeContext ? { entity: effectiveInvokeContext.entity, entity_id: effectiveInvokeContext.entity_id } : null,
      intent: classification.intent,
      ctxPlanId: ctx.plan_id || null,
      userId
    });

    if (hasEntityPageContext) {
      // Only auto-inject if we can find the exact plan — if not found (user may not
      // have planned this experience), skip silently and let the LLM handle it.
      try {
        loadModels();
        const userPlans = await Plan.find({ user: userId })
          .populate('experience', 'name destination')
          .populate({ path: 'experience', populate: { path: 'destination', select: 'name' } })
          .select('experience planned_date plan')
          .lean();

        let pinned = [];
        if (effectiveInvokeContext.entity === 'experience') {
          pinned = userPlans.filter(p =>
            String(p.experience?._id) === String(effectiveInvokeContext.entity_id)
          );
        } else if (effectiveInvokeContext.entity === 'plan') {
          pinned = userPlans.filter(p =>
            String(p._id) === String(effectiveInvokeContext.entity_id)
          );
        }

        if (pinned.length === 1) {
          const plan = pinned[0];
          await session.updateContext({
            plan_id: plan._id.toString(),
            experience_id: plan.experience?._id?.toString() || null,
            destination_id: plan.experience?.destination?._id?.toString()
              || plan.experience?.destination?.toString() || null
          });
          logger.info('[bienbot] Auto-injected plan from entity page context', {
            planId: plan._id.toString(),
            userId,
            invokeEntity: effectiveInvokeContext.entity,
            invokeEntityId: effectiveInvokeContext.entity_id,
            source: resolvedInvokeContext ? 'request' : 'session'
          });
        }
        // If 0 or 2+ found: skip silently — LLM will handle with invoke context info
      } catch (err) {
        logger.warn('[bienbot] Plan auto-inject from entity page failed, continuing', { error: err.message });
      }
    } else {
    try {
      loadModels();
      const userPlans = await Plan.find({ user: userId })
        .populate('experience', 'name destination')
        .populate({ path: 'experience', populate: { path: 'destination', select: 'name' } })
        .select('experience planned_date plan')
        .lean();

      if (userPlans.length > 0) {
        let matchedPlans = userPlans;

        // Fuzzy-filter by destination/experience name if user mentioned one
        const nameHint = classification.entities?.destination_name
          || classification.entities?.experience_name
          || null;
        if (nameHint) {
          const hint = nameHint.toLowerCase();
          const filtered = userPlans.filter(p => {
            const expName = (p.experience?.name || '').toLowerCase();
            const destName = (p.experience?.destination?.name || '').toLowerCase();
            return expName.includes(hint) || destName.includes(hint)
              || hint.includes(expName) || hint.includes(destName);
          });
          if (filtered.length > 0) matchedPlans = filtered;
        }

        if (matchedPlans.length === 1) {
          // Auto-inject the single matching plan into session context
          const plan = matchedPlans[0];
          await session.updateContext({
            plan_id: plan._id.toString(),
            experience_id: plan.experience?._id?.toString() || null,
            destination_id: plan.experience?.destination?._id?.toString()
              || plan.experience?.destination?.toString() || null
          });
          logger.info('[bienbot] Auto-injected single matching plan', {
            planId: plan._id.toString(),
            userId
          });
        } else if (matchedPlans.length >= 2) {
          // Stream disambiguation: return select_plan actions without LLM call
          const disambActions = matchedPlans.slice(0, 8).map(p => ({
            id: `action_${crypto.randomBytes(4).toString('hex')}`,
            type: 'select_plan',
            payload: {
              plan_id: p._id.toString(),
              experience_name: p.experience?.name || '(unnamed)',
              destination_name: p.experience?.destination?.name || '',
              planned_date: p.planned_date || null,
              item_count: (p.plan || []).length
            },
            description: `${p.experience?.name || 'Plan'}${p.experience?.destination?.name ? ` in ${p.experience.destination.name}` : ''}${p.planned_date ? ` (${new Date(p.planned_date).toISOString().split('T')[0]})` : ''}`
          }));

          // Build clarifying message with date-aware grouping
          const destDateGroups = {};
          for (const p of matchedPlans) {
            const dest = p.experience?.destination?.name || 'unknown destination';
            if (!destDateGroups[dest]) destDateGroups[dest] = {};
            const monthKey = p.planned_date
              ? new Date(p.planned_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
              : 'unscheduled';
            destDateGroups[dest][monthKey] = (destDateGroups[dest][monthKey] || 0) + 1;
          }
          const groupDesc = Object.entries(destDateGroups)
            .map(([dest, months]) => {
              const totalForDest = Object.values(months).reduce((s, c) => s + c, 0);
              const monthEntries = Object.entries(months);
              // If only one time group or too many (>4), keep it concise
              if (monthEntries.length <= 1) {
                const [monthLabel] = monthEntries[0];
                const suffix = monthLabel === 'unscheduled' ? ' (unscheduled)' : ` in ${monthLabel}`;
                return `${totalForDest} plan${totalForDest !== 1 ? 's' : ''} to ${dest}${suffix}`;
              }
              // Multiple time groups — show breakdown
              const monthParts = monthEntries.map(([month, count]) => {
                if (month === 'unscheduled') return `${count} unscheduled`;
                return `${count} in ${month}`;
              });
              // For >4 date groups, summarize to avoid overly long messages
              if (monthParts.length > 4) {
                return `${totalForDest} plan${totalForDest !== 1 ? 's' : ''} to ${dest} across ${monthParts.length} different months`;
              }
              return `${totalForDest} plan${totalForDest !== 1 ? 's' : ''} to ${dest} (${monthParts.join(', ')})`;
            })
            .join('; ');
          const clarifyMsg = `I found ${matchedPlans.length} plans — ${groupDesc}. Which plan would you like to work on?`;

          // Store in session
          await session.addMessage('user', message, { intent: classification.intent, sentBy: req.user._id });
          await session.addMessage('assistant', clarifyMsg);
          await session.setPendingActions(disambActions);
          await session.generateTitle();

          // SSE-stream the disambiguation response
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no'
          });
          sendSSE(res, 'session', { sessionId: session._id.toString(), title: session.title });
          const chunks = adaptiveChunks(clarifyMsg);
          for (const chunk of chunks) {
            sendSSE(res, 'token', { text: chunk });
          }
          sendSSE(res, 'actions', { pending_actions: disambActions });
          sendSSE(res, 'done', {
            intent: classification.intent,
            confidence: classification.confidence,
            source: 'disambiguation'
          });
          res.end();
          return;
        }
      }
      // 0 matches → continue normal LLM flow
    } catch (err) {
      logger.warn('[bienbot] Plan disambiguation failed, continuing normally', { error: err.message });
    }
    } // end else (no entity page context)
  }



  // --- Step 3: Build context blocks ---
  const intentContextBlock = await buildContextBlocks(
    classification.intent,
    classification.entities,
    session,
    userId,
    classifyText,
    navigationSchema,
    resolvedInvokeContext
  );

  // Merge invokeContext block with intent-based blocks, enforcing hard token cap
  // Include attachment extracted text as a context block if available
  let attachmentContextBlock = null;
  if (attachmentData?.extractedText) {
    // Cap extracted text to prevent blowing the context budget
    const maxAttachmentChars = 4000;
    const trimmedText = attachmentData.extractedText.length > maxAttachmentChars
      ? attachmentData.extractedText.substring(0, maxAttachmentChars) + '\n[... text truncated ...]'
      : attachmentData.extractedText;
    attachmentContextBlock = `--- Attached Document: ${attachmentData.filename} ---\n${trimmedText}`;
  } else if (attachmentData && !attachmentData.extractedText) {
    attachmentContextBlock = `--- Attached Document: ${attachmentData.filename} ---\n[Text extraction failed or yielded no content. The file was a ${attachmentData.mimeType} file.]`;
  }
  const combinedContext = enforceContextBudget([invokeContextBlock, intentContextBlock, attachmentContextBlock]);

  // --- Step 3b: Load user memory for cross-session context injection ---
  let userMemoryBlock = null;
  try {
    loadModels();
    const userDoc = await User.findById(userId).select('bienbot_memory.entries').lean();
    const memoryEntries = userDoc?.bienbot_memory?.entries;
    if (memoryEntries && memoryEntries.length > 0) {
      userMemoryBlock = formatMemoryBlock(memoryEntries);
    }
  } catch (err) {
    logger.warn('[bienbot] Failed to load user memory, continuing without it', { error: err.message });
  }

  // --- Step 4: Build system prompt and call LLM ---

  // Extract entity refs from the most recent assistant message so the LLM
  // can treat a short follow-up ("plan it", "yes", "go ahead") as referring
  // to the entity that was just shown in a card.
  // Refs are verified against the DB so a fabricated ID stored in a prior turn
  // cannot re-enter the LAST SHOWN ENTITY prompt block and drive a bad action.
  const lastAssistantMsg = (session.messages || [])
    .filter(m => m.role === 'assistant')
    .slice(-1)[0];
  const rawLastShownRefs = lastAssistantMsg
    ? ((lastAssistantMsg.structured_content || [])
        .find(b => b.type === 'entity_ref_list')
        ?.data?.refs || [])
      .filter(r => r._id && !/<[^>]+>/.test(r._id) && mongoose.Types.ObjectId.isValid(r._id))
    : [];
  let lastShownEntities = [];
  if (rawLastShownRefs.length > 0) {
    loadModels();
    const verifiedLastShown = [];
    await Promise.all(rawLastShownRefs.map(async (ref) => {
      try {
        if (ref.type === 'plan') {
          const plan = await Plan.findById(ref._id).select('_id experience').lean();
          if (plan) verifiedLastShown.push({ ...ref, experience_id: plan.experience?.toString() || ref.experience_id });
          else logger.warn('[bienbot] lastShownEntity plan not found, dropping from LAST SHOWN ENTITY', { id: ref._id });
        } else if (ref.type === 'experience') {
          const exists = await Experience.findById(ref._id).select('_id').lean();
          if (exists) verifiedLastShown.push(ref);
          else logger.warn('[bienbot] lastShownEntity experience not found, dropping from LAST SHOWN ENTITY', { id: ref._id });
        } else if (ref.type === 'destination') {
          const exists = await Destination.findById(ref._id).select('_id').lean();
          if (exists) verifiedLastShown.push(ref);
          else logger.warn('[bienbot] lastShownEntity destination not found, dropping from LAST SHOWN ENTITY', { id: ref._id });
        } else {
          verifiedLastShown.push(ref); // plan_item: pass through
        }
      } catch (e) {
        logger.warn('[bienbot] lastShownEntity verification error, dropping', { id: ref._id, error: e.message });
      }
    }));
    lastShownEntities = verifiedLastShown;
  }

  const systemPrompt = buildSystemPrompt({
    invokeLabel,
    invokeEntityType: invokeContext?.entity || null,
    contextDescription: invokeContext?.contextDescription || null,
    contextBlock: combinedContext,
    session,
    userMemoryBlock,
    entityResolutionBlock,
    resolvedEntityObjects,
    userCurrency: req.user?.preferences?.currency || null,
    userName: req.user?.name ? req.user.name.split(' ')[0] : null,
    userLanguage: req.user?.preferences?.language || null,
    userTimezone: req.user?.preferences?.timezone || null,
    userHiddenSignals: req.user?.hidden_signals || null,
    lastShownEntities
  });

  // Build conversation history for multi-turn
  const conversationMessages = [
    { role: 'system', content: systemPrompt }
  ];

  // Build token-aware conversation history (trims oldest messages when over budget)
  const { windowedMessages, olderMessageCount, summaryText } = buildTokenAwareHistory(
    session.messages || [],
    session.summary
  );

  // If older messages were excluded, inject a context note so the LLM is aware
  if (olderMessageCount > 0) {
    const summaryContent = summaryText
      ? `[EARLIER CONTEXT]\nSummary of the ${olderMessageCount} earlier message(s) in this conversation not included below due to context limits:\n${summaryText}\n[/EARLIER CONTEXT]`
      : `[EARLIER CONTEXT]\nThis conversation has ${olderMessageCount} earlier message(s) not shown due to context limits.\n[/EARLIER CONTEXT]`;
    conversationMessages.push({ role: 'system', content: summaryContent });
  }

  for (const msg of windowedMessages) {
    conversationMessages.push({
      role: msg.role,
      content: msg.role === 'user'
        ? `<USER_INPUT>\n${escapeUserInputLiteral(msg.content)}\n</USER_INPUT>`
        : msg.content
    });
  }

  // Add the current user message with sentinel tags.
  // When hiddenUserMessage is present, use it as the LLM prompt while the
  // visible `message` is stored in session history (already done above).
  // The escapeUserInputLiteral helper neutralises any literal closing tag the
  // user may have typed so they cannot break out of the sentinel block.
  const llmUserContent = hiddenUserMessage || message;
  let userContent = `<USER_INPUT>\n${escapeUserInputLiteral(llmUserContent)}\n</USER_INPUT>`;
  if (attachmentData) {
    // Sanitize filename before embedding in the LLM context to prevent prompt injection.
    // Replace non-word characters with underscores and cap length.
    const displayName = attachmentData.filename
      ? path.basename(String(attachmentData.filename)).replace(/[^\w\s.\-()]/g, '_').slice(0, 80)
      : 'attachment';
    // Only include MIME types from the known allowlist to prevent Content-Type header injection.
    const ALLOWED_MIME_DISPLAY = new Set([
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'
    ]);
    const displayMime = ALLOWED_MIME_DISPLAY.has(attachmentData.mimeType)
      ? attachmentData.mimeType
      : 'application/octet-stream';
    userContent += `\n[ATTACHMENT: ${displayName} (${displayMime})]`;
  }
  conversationMessages.push({
    role: 'user',
    content: userContent
  });

  const provider = getProviderForTask(AI_TASKS.GENERAL);

  if (!getApiKey(provider)) {
    return errorResponse(res, null, 'The AI service is not configured yet.', 503);
  }

  // Increase token budget for intents that produce large action payloads
  // (e.g. add_plan_items with 10+ items, workflow with many steps)
  const BULK_ACTION_INTENTS = new Set([
    'ADD_PLAN_ITEMS', 'PLAN_EXPERIENCE', 'BULK_OPERATION'
  ]);
  const baseBudget = 1500;
  const needsMoreTokens = BULK_ACTION_INTENTS.has(classification.intent) ||
    /add\s+(these|all|selected)\s+plan\s+items/i.test(classifyText);
  const maxTokens = needsMoreTokens ? 3000 : baseBudget;

  let llmResult;
  try {
    llmResult = await callProvider(provider, conversationMessages, {
      temperature: 0.7,
      maxTokens,
      _user: req.user,
      _req: req,
      task: AI_TASKS.BIENBOT_CHAT,
      intent: classification.intent || null,
      entityContext: resolvedInvokeContext ? {
        entityType: resolvedInvokeContext.entity,
        entityId: resolvedInvokeContext.entity_id
      } : (session.invoke_context?.entity ? {
        entityType: session.invoke_context.entity,
        entityId: session.invoke_context.entity_id?.toString()
      } : null)
    });
  } catch (err) {
    logger.error('[bienbot] LLM call failed', { error: err.message, userId, requestId: req.id });
    return errorResponse(res, null, 'AI service temporarily unavailable', 503);
  }

  // --- Step 5: Parse structured response ---
  const rawParsed = parseLLMResponse(llmResult.content || '');

  // --- Step 5a: Tool-use loop (silent fetch + re-prompt) ---
  // If the first response carries tool_calls, run them in parallel, open the
  // SSE stream so pill events stream during the wait, then re-prompt the LLM
  // with the tool results and use the second response as the final answer.
  // Recursion budget = 1 — any tool_calls in the second response are dropped.
  const toolLoopAbort = new AbortController();
  // Fire the abort only when the client actually disconnects before the
  // response finishes. `res.on('close')` always fires (even on normal end),
  // so guard with `!res.writableEnded` to distinguish disconnect from completion.
  res.on('close', () => {
    if (!res.writableEnded) toolLoopAbort.abort();
  });

  let parsedFinal = rawParsed;
  if (Array.isArray(rawParsed.tool_calls) && rawParsed.tool_calls.length > 0) {
    const startedAtLoop = Date.now();
    // Verify tool-call entity IDs (reuse the verifier — drops hallucinated IDs).
    const verifiedToolCalls = await verifyPendingActionEntityIds(
      rawParsed.tool_calls.map(tc => ({ ...tc, id: `tc_${tc.type}` }))
    );

    // Open the SSE stream NOW so we can emit pill events while fetching.
    if (!res.headersSent) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
      });
      sendSSE(res, 'session', { sessionId: session._id.toString(), title: session.title });
    }

    let toolResultsBlock;
    let calls;
    try {
      ({ toolResultsBlock, calls } = await executeToolCallLoop({
        toolCalls: verifiedToolCalls,
        user: req.user,
        session,
        onCallStart: (p) => sendToolCallStart(res, p),
        onCallEnd: (p) => sendToolCallEnd(res, p),
        signal: toolLoopAbort.signal
      }));
    } catch (err) {
      if (err.message === 'AbortError' || toolLoopAbort.signal.aborted) {
        return res.end();
      }
      logger.error('[bienbot:tool-loop] tool loop threw', { error: err.message, requestId: req.id, sessionId: session._id.toString() });
      sendSSE(res, 'token', { text: 'I had trouble pulling that data — try again in a moment.' });
      sendSSE(res, 'done', { intent: classification.intent, source: 'tool_loop_failure' });
      return res.end();
    }

    // Build re-prompt: same conversation + an extra user-role message
    // containing the tool-results block. The LLM treats it as fresh context.
    const repromptMessages = [
      ...conversationMessages,
      { role: 'assistant', content: JSON.stringify({ message: '', tool_calls: rawParsed.tool_calls }) },
      { role: 'user', content: toolResultsBlock }
    ];

    let secondLlm;
    try {
      secondLlm = await callProvider(provider, repromptMessages, {
        temperature: 0.7,
        maxTokens,
        _user: req.user,
        _req: req,
        task: AI_TASKS.BIENBOT_CHAT,
        intent: classification.intent || null
      });
    } catch (err) {
      if (toolLoopAbort.signal.aborted) {
        return res.end();
      }
      logger.error('[bienbot:tool-loop] second LLM call failed', { error: err.message, requestId: req.id });
      sendSSE(res, 'token', { text: 'I had trouble pulling that data — try again in a moment.' });
      sendSSE(res, 'done', { intent: classification.intent, source: 'tool_loop_failure' });
      return res.end();
    }

    parsedFinal = parseLLMResponse(secondLlm.content || '');

    // Recursion-budget enforcement: drop tool_calls in the second response.
    if (parsedFinal.tool_calls && parsedFinal.tool_calls.length > 0) {
      logger.warn('[bienbot:tool-loop] second response proposed more tool_calls — ignoring', {
        count: parsedFinal.tool_calls.length,
        types: parsedFinal.tool_calls.map(t => t.type),
        requestId: req.id,
        sessionId: session._id.toString()
      });
      parsedFinal.tool_calls = [];
    }

    // Aggregate prompt-injection telemetry across both LLM responses in this
    // tool-use turn. _anomalies is produced by parseLLMResponse — never trusted
    // from LLM output. The action-type names ARE LLM output but are safe to log
    // because we don't execute them; we just count them so persistent drift is
    // visible to operators.
    const firstAnoms = rawParsed._anomalies || { unknown_action_types: [], malformed_payloads: [], parse_errors: 0 };
    const finalAnoms = parsedFinal._anomalies || { unknown_action_types: [], malformed_payloads: [], parse_errors: 0 };
    const mergedUnknown = [...firstAnoms.unknown_action_types, ...finalAnoms.unknown_action_types];
    const mergedMalformed = [...firstAnoms.malformed_payloads, ...finalAnoms.malformed_payloads];
    const mergedParseErrors = firstAnoms.parse_errors + finalAnoms.parse_errors;
    const hasAnomalies = mergedUnknown.length > 0 || mergedMalformed.length > 0 || mergedParseErrors > 0;
    const turnLog = {
      sessionId: session._id.toString(),
      requestId: req.id,
      userId,
      tool_calls_count: calls.length,
      tool_call_types: calls.map(c => c.type),
      re_prompt_duration_ms: Date.now() - startedAtLoop,
      per_call: calls.map(c => ({ type: c.type, ok: c.ok, duration_ms: c.duration_ms, tool_source: c.tool_source })),
      // Prompt-injection telemetry (added in bd #8f36.11)
      unknown_action_types: mergedUnknown,
      malformed_payloads: mergedMalformed,
      parse_errors: mergedParseErrors
    };
    if (hasAnomalies) {
      logger.warn('[bienbot:tool-loop] turn complete (anomalies detected)', turnLog);
    } else {
      logger.info('[bienbot:tool-loop] turn complete', turnLog);
    }
  } else {
    // No tool-use loop ran — emit a parallel anomaly-only telemetry line so
    // prompt-injection drift is visible across ALL chat turns, not just those
    // that triggered a fetcher round-trip.
    const a = rawParsed._anomalies || { unknown_action_types: [], malformed_payloads: [], parse_errors: 0 };
    if (a.unknown_action_types.length > 0 || a.malformed_payloads.length > 0 || a.parse_errors > 0) {
      logger.warn('[bienbot:turn-anomaly] LLM output anomalies detected', {
        sessionId: session._id.toString(),
        unknown_action_types: a.unknown_action_types,
        malformed_payloads: a.malformed_payloads,
        parse_errors: a.parse_errors
      });
    }
  }

  // Explode workflow actions into individual step-by-step pending actions
  let explodedActions = explodeWorkflows(parsedFinal.pending_actions);

  // Drop actions whose entity IDs the LLM hallucinated. Runs before the
  // read-only/confirmable split so disambiguation actions (select_plan,
  // select_destination) and read-only fetches that take entity refs are
  // covered too — not just confirmable mutations.
  explodedActions = await verifyPendingActionEntityIds(explodedActions);

  // --- Step 5b: Auto-execute read-only actions ---
  // Read-only actions (suggest_plan_items, fetch_entity_photos) execute
  // immediately without confirmation and produce structured_content blocks.
  // Registry-owned non-mutating tools (e.g. fetch_destination_tips,
  // fetch_destination_places) are also auto-executed here.
  const registryReadToolsForExec = toolRegistry.getReadToolNames();
  const isReadOnlyAction = (type) =>
    READ_ONLY_ACTION_TYPES.has(type) || registryReadToolsForExec.has(type);
  const readOnlyActions = explodedActions.filter(a => isReadOnlyAction(a.type));
  const confirmableActions = explodedActions.filter(a => !isReadOnlyAction(a.type));
  const READ_ONLY_CONTENT_TYPES = {
    discover_content: 'discovery_result_list',
    fetch_entity_photos: 'photo_gallery',
    fetch_destination_tips: 'tip_suggestion_list',
    list_user_experiences: 'experience_list',
    list_user_followers: 'follower_list',
    list_user_activities: 'activity_feed',
    list_entity_documents: 'document_list'
  };
  const structuredContent = [];

  if (readOnlyActions.length > 0) {
    const { executeAction } = require('../../../utilities/bienbot-action-executor');

    for (const action of readOnlyActions) {
      try {
        const outcome = await executeAction(action, req.user, session);

        // Note: discover_content always returns a non-null result body (even for empty results)
        // so this guard correctly allows through the empty-results case.
        if (outcome.success && outcome.result) {
          const contentBlock = mapReadOnlyResultToStructuredContent(action.type, outcome.result);
          if (contentBlock) {
            structuredContent.push(contentBlock);
          }
        } else {
          logger.warn('[bienbot] Read-only action failed', {
            type: action.type,
            actionId: action.id,
            errors: outcome.errors
          });
        }
      } catch (err) {
        logger.error('[bienbot] Read-only action threw', {
          type: action.type,
          actionId: action.id,
          error: err.message
        });
      }
    }
  }

  // --- Step 5c: Auto-inject discovery results as structured content ---
  // When the LLM lists experiences as text instead of emitting a discover_content
  // action, inject the discovery results as discovery_result_list cards so users
  // can navigate directly to each experience.
  const DISCOVERY_INTENTS_LLM = new Set(['DISCOVER_EXPERIENCES', 'DISCOVER_DESTINATIONS', 'PLAN_EXPERIENCE', 'CREATE_EXPERIENCE']);
  const hasDiscoverAction = readOnlyActions.some(a => a.type === 'discover_content');
  if (DISCOVERY_INTENTS_LLM.has(classification.intent) && !hasDiscoverAction) {
    try {
      const autoDiscoveryFilters = {};
      if (classification.entities?.destination_name) autoDiscoveryFilters.destination_name = classification.entities.destination_name;
      if (session.context?.destination_id) autoDiscoveryFilters.destination_id = session.context.destination_id.toString();
      if (classification.entities?.activity_type) autoDiscoveryFilters.activity_types = [classification.entities.activity_type];
      const autoDiscovery = await buildDiscoveryContext(autoDiscoveryFilters, userId);
      if (autoDiscovery?.results?.length > 0) {
        structuredContent.push({
          type: 'discovery_result_list',
          data: {
            results: autoDiscovery.results,
            query_metadata: autoDiscovery.query_metadata || {}
          }
        });
        logger.debug('[bienbot] Auto-injected discovery_result_list for planning intent', {
          intent: classification.intent,
          resultCount: autoDiscovery.results.length
        });
      }
    } catch (autoDiscErr) {
      logger.warn('[bienbot] Auto-discovery injection failed, continuing without cards', { error: autoDiscErr.message });
    }
  }

  // Annotate registry-defined write tools with tool_metadata so the
  // frontend PendingActionCard can render irreversible styling and
  // interpolate confirmDescription from the manifest.
  for (const action of confirmableActions) {
    const entry = toolRegistry.getTool(action.type);
    if (entry && entry.tool.mutating) {
      action.tool_metadata = {
        irreversible: !!entry.tool.irreversible,
        confirmDescription: entry.tool.confirmDescription || null
      };
    }
  }

  const parsed = {
    message: parsedFinal.message,
    pending_actions: confirmableActions,
    entity_refs: parsedFinal.entity_refs || []
  };

  // --- Verify entity_refs against the database ---
  // The LLM may fabricate MongoDB ObjectIds that pass string-format checks.
  // Drop any ref whose entity isn't in the DB to prevent 404 links from
  // reaching the user. For plan refs, derive experience_id from the DB so
  // the ID is never trusted from the LLM.
  if (parsed.entity_refs.length > 0) {
    loadModels();
    const refsToVerify = { experience: new Set(), destination: new Set(), plan: new Set() };
    for (const ref of parsed.entity_refs) {
      if (refsToVerify[ref.type] && mongoose.Types.ObjectId.isValid(ref._id)) {
        refsToVerify[ref.type].add(ref._id);
      }
    }
    const existingRefs = { experience: new Set(), destination: new Set() };
    const planExpMap = new Map();   // plan _id -> experience _id (string|undefined)
    await Promise.all([
      refsToVerify.experience.size > 0
        ? Experience.find({ _id: { $in: [...refsToVerify.experience] } }).select('_id').lean()
            .then(docs => docs.forEach(d => existingRefs.experience.add(d._id.toString())))
            .catch(err => logger.warn('[bienbot] entity_ref experience batch query failed', { error: err.message }))
        : Promise.resolve(),
      refsToVerify.destination.size > 0
        ? Destination.find({ _id: { $in: [...refsToVerify.destination] } }).select('_id').lean()
            .then(docs => docs.forEach(d => existingRefs.destination.add(d._id.toString())))
            .catch(err => logger.warn('[bienbot] entity_ref destination batch query failed', { error: err.message }))
        : Promise.resolve(),
      refsToVerify.plan.size > 0
        ? Plan.find({ _id: { $in: [...refsToVerify.plan] } }).select('_id experience').lean()
            .then(docs => docs.forEach(d =>
              planExpMap.set(d._id.toString(), d.experience?.toString() || undefined)))
            .catch(err => logger.warn('[bienbot] entity_ref plan batch query failed', { error: err.message }))
        : Promise.resolve()
    ]);
    parsed.entity_refs = parsed.entity_refs.flatMap(ref => {
      if (!mongoose.Types.ObjectId.isValid(ref._id)) {
        logger.warn('[bienbot] entity_ref dropped: invalid ObjectId format', { id: ref._id, type: ref.type });
        return [];
      }
      if (ref.type === 'experience') {
        if (existingRefs.experience.has(ref._id)) return [ref];
        logger.warn('[bienbot] entity_ref experience not found in DB, dropping', { id: ref._id });
        return [];
      }
      if (ref.type === 'destination') {
        if (existingRefs.destination.has(ref._id)) return [ref];
        logger.warn('[bienbot] entity_ref destination not found in DB, dropping', { id: ref._id });
        return [];
      }
      if (ref.type === 'plan') {
        if (planExpMap.has(ref._id)) {
          // Always source experience_id from the DB — never trust the LLM value
          return [{ ...ref, experience_id: planExpMap.get(ref._id) }];
        }
        logger.warn('[bienbot] entity_ref plan not found in DB, dropping', { id: ref._id });
        return [];
      }
      // plan_item and other types pass through — embedded subdocs are
      // expensive to verify independently of their parent (the parent is
      // verified in this same block when present).
      return [ref];
    });
  }

  // Hydrate session context from entity_refs returned by the LLM.
  // This ensures subsequent messages can use entity IDs (e.g. a destination resolved
  // in a prior turn) without the user having to repeat the entity name.
  try {
    const ctxFromRefs = {};
    for (const ref of parsed.entity_refs) {
      if (!ref._id || /<[^>]+>/.test(ref._id)) continue; // skip placeholder IDs
      if (ref.type === 'destination' && !session.context?.destination_id) {
        ctxFromRefs.destination_id = ref._id;
      } else if (ref.type === 'experience' && !session.context?.experience_id) {
        ctxFromRefs.experience_id = ref._id;
      } else if (ref.type === 'plan' && !session.context?.plan_id) {
        ctxFromRefs.plan_id = ref._id;
      }
    }
    if (Object.keys(ctxFromRefs).length > 0) {
      await session.updateContext(ctxFromRefs);
      logger.debug('[bienbot] Session context hydrated from entity_refs', { ctxFromRefs });
    }
  } catch (ctxErr) {
    logger.warn('[bienbot] Failed to hydrate session context from entity_refs', { error: ctxErr.message });
  }

  // --- Step 6: Store in session ---
  try {
    // Add user message (with attachment metadata if present)
    const userMessageOpts = {
      intent: classification.intent,
      sentBy: req.user._id
    };
    if (attachmentData) {
      // Upload to S3 protected bucket now that we have the session ID
      if (pendingLocalFile) {
        try {
          const timestamp = Date.now();
          const originalExt = path.extname(attachmentData.filename);
          const originalBase = path.basename(attachmentData.filename, originalExt);
          const sanitizedBase = String(originalBase).replace(/[^a-zA-Z0-9.-]/g, '_');
          const s3KeyBase = `bienbot/${userId}/${session._id}/${timestamp}-${sanitizedBase}`;

          const { s3Result } = await uploadWithPipeline(pendingLocalFile, attachmentData.filename, s3KeyBase, {
            protected: true,
            deleteLocal: true
          });
          attachmentData.s3Key = s3Result.key;
          attachmentData.s3Bucket = s3Result.bucket;
          attachmentData.isProtected = true;
          pendingLocalFile = null;

          logger.info('[bienbot] Attachment uploaded to S3', {
            s3Key: s3Result.key,
            bucket: s3Result.bucket,
            userId
          });
        } catch (s3Err) {
          logger.error('[bienbot] S3 upload failed, continuing without persistence', {
            error: s3Err.message,
            userId
          });
          // Pipeline handles local cleanup on success; clean up on failure too
          if (pendingLocalFile) {
            try { await fs.promises.unlink(pendingLocalFile); } catch { /* ignore */ }
            pendingLocalFile = null;
          }
        }
      }

      userMessageOpts.attachments = [{
        filename: attachmentData.filename,
        mimeType: attachmentData.mimeType,
        fileSize: attachmentData.fileSize,
        extractedText: attachmentData.extractedText,
        extractionMethod: attachmentData.extractionMethod,
        s3Key: attachmentData.s3Key || null,
        s3Bucket: attachmentData.s3Bucket || null,
        isProtected: attachmentData.isProtected || false
      }];
    }
    await session.addMessage('user', message, userMessageOpts);

    // Add assistant response (with structured_content from read-only actions + entity refs)
    const actionsTaken = [
      ...readOnlyActions.map(a => a.type),
      ...parsed.pending_actions.map(a => a.type)
    ];
    const entityRefBlock = parsed.entity_refs?.length > 0
      ? [{ type: 'entity_ref_list', data: { refs: parsed.entity_refs } }]
      : [];
    await session.addMessage('assistant', parsed.message, {
      actions_taken: actionsTaken,
      structured_content: [...structuredContent, ...entityRefBlock]
    });
  } catch (err) {
    logger.error('[bienbot] Session message persistence failed', { error: err.message, errorType: err.name });
    // Continue — we can still return the response even if message persistence fails
  }

  // Store confirmable pending actions in a separate try/catch so that a message
  // persistence failure above does not prevent the actions from being saved.
  // Without this, the SSE would send actions to the frontend that are not in the DB,
  // causing 400 "Invalid or already executed action IDs" errors on execute.
  if (parsed.pending_actions.length > 0) {
    try {
      await session.setPendingActions(parsed.pending_actions);
      logger.debug('[bienbot] Pending actions saved', {
        sessionId: session._id?.toString(),
        actionIds: parsed.pending_actions.map(a => a.id)
      });
    } catch (err) {
      logger.error('[bienbot] setPendingActions failed — actions will not be executable', {
        error: err.message,
        errorType: err.name,
        sessionId: session._id?.toString(),
        actionIds: parsed.pending_actions.map(a => a.id)
      });
    }
  }

  try {
    // Auto-generate title from first user message
    await session.generateTitle();
  } catch (err) {
    logger.warn('[bienbot] generateTitle failed', { error: err.message });
  }

  // Non-blocking background memory extraction after each chat turn
  setImmediate(async () => {
    try {
      await extractMemoryFromSession({ session, user: req.user });
    } catch (e) {
      logger.debug('[bienbot] Background memory extraction failed', { error: e.message });
    }
  });

  // --- Step 7: SSE-stream the response ---
  // Headers may have already been sent by the tool-use loop above (Step 5a),
  // which opens the stream early so pill events can flow during fetches.
  if (!res.headersSent) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
  }

  // Stream session info (include attachment data for frontend rendering)
  const sessionEvent = {
    sessionId: session._id.toString(),
    title: session.title
  };
  if (attachmentData?.s3Key) {
    sessionEvent.attachment = {
      s3Key: attachmentData.s3Key,
      s3Bucket: attachmentData.s3Bucket,
      isProtected: attachmentData.isProtected || false
    };
  }
  sendSSE(res, 'session', sessionEvent);

  // Emit skeleton sentinels for all read-only content types before token chunks
  // so the frontend can show placeholder cards while the assistant message streams in.
  // Also include a skeleton for auto-injected discovery results (step 5c).
  const skeletonBlocks = readOnlyActions
    .filter(a => READ_ONLY_CONTENT_TYPES[a.type])
    .map(a => ({ type: READ_ONLY_CONTENT_TYPES[a.type], data: null }));
  const hasAutoDiscovery = structuredContent.some(b => b.type === 'discovery_result_list') &&
    !readOnlyActions.some(a => a.type === 'discover_content');
  if (hasAutoDiscovery) {
    skeletonBlocks.push({ type: 'discovery_result_list', data: null });
  }
  if (skeletonBlocks.length > 0) {
    sendSSE(res, 'structured_content', { blocks: skeletonBlocks });
  }

  // Stream the message in adaptive chunks for progressive rendering.
  // Chunks split at word/sentence boundaries (min ~20 chars, max ~200 chars).
  const messageText = parsed.message;
  const tokenChunks = adaptiveChunks(messageText);

  for (const chunk of tokenChunks) {
    sendSSE(res, 'token', { text: chunk });
  }

  // Stream structured content from read-only actions
  if (structuredContent.length > 0) {
    sendSSE(res, 'structured_content', {
      blocks: structuredContent
    });
  }

  // Stream entity refs as structured content (after message tokens, before actions)
  if (parsed.entity_refs?.length > 0) {
    sendSSE(res, 'structured_content', {
      blocks: [{ type: 'entity_ref_list', data: { refs: parsed.entity_refs } }]
    });
  }

  // Always stream pending actions — even when empty — so the frontend replaces
  // any stale actions (e.g. select_plan from a prior turn or resumed session).
  sendSSE(res, 'actions', {
    pending_actions: parsed.pending_actions
  });

  // Signal completion
  sendSSE(res, 'done', {
    usage: llmResult.usage,
    intent: classification.intent,
    confidence: classification.confidence,
    source: classification.source || 'nlp'
  });

  res.end();
};

/**
 * Fetch existing user plans and discovery results for a given destination name,
 * then SSE-stream the combined response.
 *
 * Extracted from exports.chat to avoid recreating a closure on every request
 * and to make the `res` reference explicit rather than captured.
 *
 * @param {string} destName - Destination name to search
 * @param {object} params - Explicit dependencies (no closure capture)
 * @param {string} params.userId
 * @param {object} params.session - BienBot session document
 * @param {string} params.message - Original user message
 * @param {object} params.classification - Intent classification result
 * @param {object} params.req - Express request (for sentBy)
 * @param {object} params.res - Express response (SSE)
 * @returns {Promise<boolean>} true if response was streamed, false to fall through
 */
async function runPlanDiscover(destName, { userId, session, message, classification, req, res }) {
  loadModels();
  const destLower = destName.toLowerCase();

  // Fetch user's existing plans, filtering to those matching the destination
  const allUserPlans = await Plan.find({ user: userId })
    .populate({ path: 'experience', select: 'name destination', populate: { path: 'destination', select: 'name' } })
    .select('experience planned_date plan')
    .lean();

  const destPlans = allUserPlans.filter(p => {
    const pDest = (p.experience?.destination?.name || '').toLowerCase();
    return pDest && (pDest.includes(destLower) || destLower.includes(pDest));
  });

  // Build select_plan actions for existing plans
  const planActions = destPlans.slice(0, 6).map(p => ({
    id: `action_${crypto.randomBytes(4).toString('hex')}`,
    type: 'select_plan',
    payload: {
      plan_id: p._id.toString(),
      experience_name: p.experience?.name || '(unnamed)',
      destination_name: p.experience?.destination?.name || '',
      planned_date: p.planned_date || null,
      item_count: (p.plan || []).length
    },
    description: `${p.experience?.name || 'Plan'}${p.experience?.destination?.name ? ` in ${p.experience.destination.name}` : ''}${p.planned_date ? ` (${new Date(p.planned_date).toISOString().split('T')[0]})` : ''}`
  }));

  // Fetch available experiences via discovery (for new plan creation)
  const discoveryResult = await buildDiscoveryContext({ destination_name: destName }, userId).catch(() => null);

  // Only short-circuit if we have something useful to show
  if (planActions.length === 0 && !(discoveryResult?.results?.length > 0)) {
    return false;
  }

  const hasBoth = planActions.length > 0 && discoveryResult?.results?.length > 0;
  const hasPlansOnly = planActions.length > 0 && !discoveryResult?.results?.length;

  let msg;
  if (hasBoth) {
    msg = `You have ${planActions.length} plan${planActions.length !== 1 ? 's' : ''} in ${destName}. Select one to continue, or choose a new experience to plan below.`;
  } else if (hasPlansOnly) {
    msg = `You have ${planActions.length} plan${planActions.length !== 1 ? 's' : ''} in ${destName}. Select one to continue.`;
  } else {
    msg = `Here are experiences you can plan in ${destName}:`;
  }

  const discoveryBlock = discoveryResult?.results?.length > 0
    ? [{ type: 'discovery_result_list', data: { results: discoveryResult.results, query_metadata: discoveryResult.query_metadata || {} } }]
    : [];

  await session.addMessage('user', message, { intent: classification.intent, sentBy: req.user._id });
  await session.addMessage('assistant', msg, {
    actions_taken: [...planActions.map(() => 'select_plan'), ...(discoveryBlock.length ? ['discover_content'] : [])],
    structured_content: discoveryBlock
  });
  if (planActions.length > 0) {
    await session.setPendingActions(planActions);
  }
  await session.generateTitle();

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  sendSSE(res, 'session', { sessionId: session._id.toString(), title: session.title });

  // Emit discovery skeleton before tokens so cards appear as message streams in
  if (discoveryBlock.length > 0) {
    sendSSE(res, 'structured_content', { blocks: [{ type: 'discovery_result_list', data: null }] });
  }

  const chunks = adaptiveChunks(msg);
  for (const chunk of chunks) {
    sendSSE(res, 'token', { text: chunk });
  }

  if (discoveryBlock.length > 0) {
    sendSSE(res, 'structured_content', { blocks: discoveryBlock });
  }

  if (planActions.length > 0) {
    sendSSE(res, 'actions', { pending_actions: planActions });
  }

  sendSSE(res, 'done', { intent: classification.intent, confidence: classification.confidence, source: 'plan_experience_resolution' });
  res.end();

  logger.info('[bienbot] Plan+discover short-circuit', { userId, destination: destName, plans: planActions.length, experiences: discoveryResult?.results?.length || 0 });
  return true;
}


module.exports = {
  // Parsers (exported for tests)
  repairUnescapedInlineJson,
  parseLLMResponse,
  // Tool-use loop (exported for tests)
  executeToolCallLoop,
  _executeToolCallLoopForTest: exports._executeToolCallLoopForTest,
  // Controller handlers
  chat: exports.chat,
};

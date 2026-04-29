/**
 * BienBot Controller — façade.
 *
 * The implementation has been split into per-concern modules under
 * `controllers/api/bienbot/`. This file re-exports the same surface so
 * routes/api/bienbot.js, tests, and any external import sites continue to
 * work unchanged. (bd #f4ed)
 *
 * Module map:
 *   - bienbot/_shared.js       — common helpers, constants, SSE utils,
 *                                model loader, prompt-injection escape, etc.
 *   - bienbot/system-prompt.js — buildSystemPrompt + buildContextBlocks
 *   - bienbot/chat.js          — POST /chat (SSE) + LLM response parsers +
 *                                tool-use loop + plan-discover branch
 *   - bienbot/actions.js       — pending-action execution / cancel / patch /
 *                                workflow-state, plus ACTION_ENTITY_VERIFY +
 *                                verifyPendingActionEntityIds
 *   - bienbot/sessions.js      — list/get/resume/delete sessions, share &
 *                                unshare, mutual followers, cross-session
 *                                memory, apply-tips
 *   - bienbot/analyze.js       — POST /analyze (proactive entity analysis)
 *   - bienbot/attachments.js   — signed-URL serving for stored attachments
 *
 * @module controllers/api/bienbot
 */

const chat = require('./bienbot/chat');
const actions = require('./bienbot/actions');
const sessions = require('./bienbot/sessions');
const analyze = require('./bienbot/analyze');
const attachments = require('./bienbot/attachments');
const systemPrompt = require('./bienbot/system-prompt');
const shared = require('./bienbot/_shared');

// ---------------------------------------------------------------------------
// Controller endpoints (preserve original `exports.<name>` surface)
// ---------------------------------------------------------------------------

// Chat (POST /chat) and its tool-loop test hook
exports.chat = chat.chat;
exports._executeToolCallLoopForTest = chat._executeToolCallLoopForTest;

// Pending-action management
exports.execute = actions.execute;
exports.deletePendingAction = actions.deletePendingAction;
exports.updatePendingAction = actions.updatePendingAction;
exports.getWorkflowState = actions.getWorkflowState;

// Session lifecycle
exports.resume = sessions.resume;
exports.listSessions = sessions.listSessions;
exports.getSession = sessions.getSession;
exports.deleteSession = sessions.deleteSession;
exports.updateContext = sessions.updateContext;
exports.addSessionCollaborator = sessions.addSessionCollaborator;
exports.removeSessionCollaborator = sessions.removeSessionCollaborator;
exports.getMutualFollowers = sessions.getMutualFollowers;
exports.getMemory = sessions.getMemory;
exports.clearMemory = sessions.clearMemory;
exports.applyTips = sessions.applyTips;

// Proactive analysis
exports.analyze = analyze.analyze;

// Attachments
exports.getAttachmentUrl = attachments.getAttachmentUrl;

// ---------------------------------------------------------------------------
// Test fixtures (also exported on the original surface)
// ---------------------------------------------------------------------------

exports.parseLLMResponse = chat.parseLLMResponse;
exports.verifyPendingActionEntityIds = actions.verifyPendingActionEntityIds;
exports.buildSystemPrompt = systemPrompt.buildSystemPrompt;
exports.escapeUserInputLiteral = shared.escapeUserInputLiteral;
exports._ACTION_ENTITY_VERIFY_FOR_TEST = actions.ACTION_ENTITY_VERIFY;

/**
 * Plan Unplan Queue
 *
 * Server-side deferred deletion for plans that are inside an undo window.
 *
 * Flow:
 *   1. Client calls  POST /api/plans/:id/schedule-delete  → receives { token, expiresAt }
 *   2. Server stores the job in the Map and starts a setTimeout for |delayMs|.
 *   3. Client shows the undo toast for the same duration.
 *   4a. User clicks Undo → client calls DELETE /api/plans/scheduled/:token
 *       → server clears the timer and the plan stays in the database.
 *   4b. Toast expires with no undo → timer fires → server executes the delete.
 *   4c. Server restarts inside the window → timeout is lost → plan stays.
 *       The client saw the optimistic removal, but the next page load will
 *       re-fetch plans and surface the plan again.  This is the correct
 *       safe-fail outcome (data preserved > silent loss).
 *
 * The queue is intentionally in-memory.  The undo window is short (≤10 s);
 * persisting it to the database is unnecessary weight.  A crash inside the
 * window is handled by the safe-fail policy above.
 *
 * @module utilities/plan-unplan-queue
 */

'use strict';

const crypto = require('crypto');
const backendLogger = require('./backend-logger');

// token → { planId, userId, timer, scheduledAt, expiresAt }
const _queue = new Map();

// How long to wait before executing the deletion (ms).
// Must be ≥ the frontend undo toast duration so the client always has a chance
// to cancel before the server fires.
const DEFAULT_DELAY_MS = 8_000;

/**
 * Schedule a plan for deletion after |delayMs| milliseconds.
 * Returns a one-time token the client must present to cancel.
 *
 * If a job for this planId already exists it is replaced so that double-click
 * / re-trigger doesn't stack timers.
 *
 * @param {string} planId  - MongoDB Plan ID
 * @param {string} userId  - ID of the user who owns the job (for ownership checks on cancel)
 * @param {Function} executeDelete - Async function that performs the actual deletion;
 *                                   receives (planId, userId) and should throw on error.
 * @param {number} [delayMs]
 * @returns {{ token: string, expiresAt: string }}
 */
function scheduleDelete(planId, userId, executeDelete, delayMs = DEFAULT_DELAY_MS) {
  // Cancel any existing job for the same plan before creating a new one.
  cancelByPlanId(planId);

  const token = crypto.randomBytes(20).toString('hex');
  const now = Date.now();
  const expiresAt = new Date(now + delayMs).toISOString();

  const timer = setTimeout(async () => {
    _queue.delete(token);
    backendLogger.info('[plan-unplan-queue] Executing deferred plan deletion', { planId, userId });
    try {
      await executeDelete(planId, userId);
    } catch (err) {
      backendLogger.error('[plan-unplan-queue] Deferred plan deletion failed', {
        planId,
        userId,
        error: err.message
      }, err);
      // Safe-fail: plan stays in the database; user can retry manually.
    }
  }, delayMs);

  _queue.set(token, { planId, userId, timer, scheduledAt: now, expiresAt });

  backendLogger.debug('[plan-unplan-queue] Plan deletion scheduled', { planId, token, expiresAt });

  return { token, expiresAt };
}

/**
 * Cancel a scheduled deletion by its token.
 *
 * @param {string} token
 * @param {string} requestingUserId - Must match the userId that scheduled the job.
 * @returns {boolean} true if cancelled, false if not found or wrong owner.
 */
function cancelDelete(token, requestingUserId) {
  const job = _queue.get(token);
  if (!job) {
    backendLogger.debug('[plan-unplan-queue] Cancel requested for unknown token', { token });
    return false;
  }

  if (job.userId.toString() !== requestingUserId.toString()) {
    backendLogger.warn('[plan-unplan-queue] Cancel rejected: wrong owner', {
      token,
      jobUserId: job.userId,
      requestingUserId
    });
    return false;
  }

  clearTimeout(job.timer);
  _queue.delete(token);

  backendLogger.debug('[plan-unplan-queue] Plan deletion cancelled', { planId: job.planId, token });

  return true;
}

/**
 * Cancel any pending deletion for a given planId (regardless of token).
 * Used internally when a new job supersedes an old one for the same plan.
 *
 * @param {string} planId
 */
function cancelByPlanId(planId) {
  for (const [token, job] of _queue.entries()) {
    if (job.planId.toString() === planId.toString()) {
      clearTimeout(job.timer);
      _queue.delete(token);
      backendLogger.debug('[plan-unplan-queue] Replaced existing deletion job', { planId, token });
    }
  }
}

/**
 * Return the number of jobs currently in the queue (useful for health checks / tests).
 */
function queueSize() {
  return _queue.size;
}

module.exports = { scheduleDelete, cancelDelete, cancelByPlanId, queueSize, DEFAULT_DELAY_MS };

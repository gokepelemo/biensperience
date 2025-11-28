/**
 * Vector Clock Implementation for Distributed State Synchronization
 *
 * Vector clocks provide causal ordering of events across distributed systems
 * (browser tabs, WebSocket connections, etc.) without relying on synchronized wall clocks.
 *
 * Key Properties:
 * - If E1 "happens before" E2, then VC(E1) < VC(E2)
 * - If VC(E1) || VC(E2) (concurrent), events happened independently
 * - Merging clocks creates a "happens after" relationship to both
 *
 * Usage:
 * 1. Each session maintains its own vector clock
 * 2. Increment clock on every local event/mutation
 * 3. Include clock in all event payloads
 * 4. Merge received clocks with local clock
 * 5. Use compare() to determine event ordering
 */

import { logger } from './logger';

/**
 * Create a new empty vector clock
 * @returns {Object} Empty vector clock object
 */
export function createVectorClock() {
  return {};
}

/**
 * Increment the clock for a specific session
 * Called before emitting any event
 *
 * @param {Object} clock - Current vector clock
 * @param {string} sessionId - Session ID to increment
 * @returns {Object} New vector clock with incremented session
 */
export function increment(clock, sessionId) {
  if (!sessionId) {
    logger.warn('[VectorClock] increment called without sessionId');
    return { ...clock };
  }

  const newClock = { ...clock };
  newClock[sessionId] = (newClock[sessionId] || 0) + 1;

  logger.debug('[VectorClock] Incremented', {
    sessionId,
    newValue: newClock[sessionId]
  });

  return newClock;
}

/**
 * Merge two vector clocks by taking the max of each component
 * Called when receiving remote events to update local clock
 *
 * @param {Object} clock1 - First vector clock (typically local)
 * @param {Object} clock2 - Second vector clock (typically remote)
 * @returns {Object} Merged vector clock
 */
export function merge(clock1, clock2) {
  if (!clock1 && !clock2) return {};
  if (!clock1) return { ...clock2 };
  if (!clock2) return { ...clock1 };

  const merged = { ...clock1 };

  Object.keys(clock2).forEach(sessionId => {
    merged[sessionId] = Math.max(
      merged[sessionId] || 0,
      clock2[sessionId] || 0
    );
  });

  logger.debug('[VectorClock] Merged clocks', {
    clock1Sessions: Object.keys(clock1).length,
    clock2Sessions: Object.keys(clock2).length,
    mergedSessions: Object.keys(merged).length
  });

  return merged;
}

/**
 * Compare two vector clocks to determine causal ordering
 *
 * @param {Object} clock1 - First vector clock
 * @param {Object} clock2 - Second vector clock
 * @returns {'before' | 'after' | 'concurrent' | 'equal'} Ordering relationship
 *
 * - 'before': clock1 happened before clock2
 * - 'after': clock1 happened after clock2
 * - 'concurrent': Neither dominates (independent events)
 * - 'equal': Clocks are identical
 */
export function compare(clock1, clock2) {
  // Handle null/undefined clocks
  if (!clock1 && !clock2) return 'equal';
  if (!clock1) return 'before';
  if (!clock2) return 'after';

  let hasSmaller = false; // clock1 has at least one smaller component
  let hasLarger = false;  // clock1 has at least one larger component

  // Get all session IDs from both clocks
  const allSessions = new Set([
    ...Object.keys(clock1),
    ...Object.keys(clock2)
  ]);

  allSessions.forEach(sessionId => {
    const v1 = clock1[sessionId] || 0;
    const v2 = clock2[sessionId] || 0;

    if (v1 < v2) hasSmaller = true;
    if (v1 > v2) hasLarger = true;
  });

  // Determine relationship
  if (hasSmaller && hasLarger) return 'concurrent';
  if (hasSmaller) return 'before';
  if (hasLarger) return 'after';
  return 'equal';
}

/**
 * Check if clock1 causally happens before clock2
 *
 * @param {Object} clock1 - First vector clock
 * @param {Object} clock2 - Second vector clock
 * @returns {boolean} True if clock1 happened before clock2
 */
export function happensBefore(clock1, clock2) {
  return compare(clock1, clock2) === 'before';
}

/**
 * Check if clock1 causally happens after clock2
 *
 * @param {Object} clock1 - First vector clock
 * @param {Object} clock2 - Second vector clock
 * @returns {boolean} True if clock1 happened after clock2
 */
export function happensAfter(clock1, clock2) {
  return compare(clock1, clock2) === 'after';
}

/**
 * Check if two clocks represent concurrent events
 * Concurrent events happened independently without knowledge of each other
 *
 * @param {Object} clock1 - First vector clock
 * @param {Object} clock2 - Second vector clock
 * @returns {boolean} True if events are concurrent (neither dominates)
 */
export function isConcurrent(clock1, clock2) {
  return compare(clock1, clock2) === 'concurrent';
}

/**
 * Check if two clocks are equal
 *
 * @param {Object} clock1 - First vector clock
 * @param {Object} clock2 - Second vector clock
 * @returns {boolean} True if clocks are identical
 */
export function isEqual(clock1, clock2) {
  return compare(clock1, clock2) === 'equal';
}

/**
 * Serialize vector clock for transmission (localStorage, WebSocket, etc.)
 *
 * @param {Object} clock - Vector clock to serialize
 * @returns {string} JSON string representation
 */
export function serialize(clock) {
  if (!clock) return '{}';
  return JSON.stringify(clock);
}

/**
 * Deserialize vector clock from transmission
 *
 * @param {string} str - JSON string to deserialize
 * @returns {Object} Parsed vector clock or empty clock on error
 */
export function deserialize(str) {
  if (!str) return {};
  try {
    const parsed = JSON.parse(str);
    // Validate it's a proper clock object
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return {};
    }
    return parsed;
  } catch (error) {
    logger.warn('[VectorClock] Failed to deserialize', { error: error.message });
    return {};
  }
}

/**
 * Get the maximum sequence number across all sessions
 * Useful for debugging and monitoring
 *
 * @param {Object} clock - Vector clock
 * @returns {number} Maximum sequence number
 */
export function getMaxSequence(clock) {
  if (!clock || Object.keys(clock).length === 0) return 0;
  return Math.max(...Object.values(clock));
}

/**
 * Get the total of all sequence numbers (sum)
 * Higher totals indicate more events in the system
 *
 * @param {Object} clock - Vector clock
 * @returns {number} Sum of all sequence numbers
 */
export function getTotalSequence(clock) {
  if (!clock) return 0;
  return Object.values(clock).reduce((sum, val) => sum + val, 0);
}

/**
 * Count the number of sessions that have contributed to this clock
 *
 * @param {Object} clock - Vector clock
 * @returns {number} Number of contributing sessions
 */
export function getSessionCount(clock) {
  if (!clock) return 0;
  return Object.keys(clock).length;
}

/**
 * Create a clock from a single session with initial sequence number
 * Useful for initializing a new clock with known state
 *
 * @param {string} sessionId - Session ID
 * @param {number} sequence - Initial sequence number (default: 1)
 * @returns {Object} New vector clock
 */
export function createFromSession(sessionId, sequence = 1) {
  if (!sessionId) return {};
  return { [sessionId]: sequence };
}

/**
 * Clone a vector clock (deep copy)
 *
 * @param {Object} clock - Vector clock to clone
 * @returns {Object} Cloned vector clock
 */
export function clone(clock) {
  if (!clock) return {};
  return { ...clock };
}

/**
 * Check if a clock is empty (no events recorded)
 *
 * @param {Object} clock - Vector clock to check
 * @returns {boolean} True if clock is empty
 */
export function isEmpty(clock) {
  return !clock || Object.keys(clock).length === 0;
}

/**
 * Prune old sessions from a clock to prevent unbounded growth
 * Removes sessions with sequence numbers below threshold
 *
 * @param {Object} clock - Vector clock
 * @param {number} minSequence - Minimum sequence to keep
 * @returns {Object} Pruned vector clock
 */
export function prune(clock, minSequence = 0) {
  if (!clock) return {};

  const pruned = {};
  Object.entries(clock).forEach(([sessionId, sequence]) => {
    if (sequence > minSequence) {
      pruned[sessionId] = sequence;
    }
  });

  const removed = Object.keys(clock).length - Object.keys(pruned).length;
  if (removed > 0) {
    logger.debug('[VectorClock] Pruned sessions', {
      removed,
      remaining: Object.keys(pruned).length
    });
  }

  return pruned;
}

/**
 * Format clock for human-readable logging
 *
 * @param {Object} clock - Vector clock
 * @returns {string} Human-readable representation
 */
export function format(clock) {
  if (!clock || Object.keys(clock).length === 0) {
    return '{}';
  }

  const entries = Object.entries(clock)
    .map(([sessionId, seq]) => {
      // Abbreviate session IDs for readability
      const shortId = sessionId.length > 12
        ? sessionId.substring(0, 8) + '...'
        : sessionId;
      return `${shortId}:${seq}`;
    })
    .join(', ');

  return `{${entries}}`;
}

// Default export for convenience
const VectorClock = {
  createVectorClock,
  increment,
  merge,
  compare,
  happensBefore,
  happensAfter,
  isConcurrent,
  isEqual,
  serialize,
  deserialize,
  getMaxSequence,
  getTotalSequence,
  getSessionCount,
  createFromSession,
  clone,
  isEmpty,
  prune,
  format
};

export default VectorClock;

/**
 * Conflict Resolution Engine for Concurrent Plan Updates
 *
 * Implements deterministic conflict resolution for when multiple sessions/tabs
 * edit the same plan concurrently. Uses field-specific strategies to ensure
 * all clients converge to the same state regardless of event order.
 *
 * Key Principles:
 * - Deterministic: Same inputs always produce same output
 * - Idempotent: Applying resolution twice has no additional effect
 * - Complete preservation: No user data is lost silently
 *
 * @module conflict-resolver
 */

import * as VectorClock from './vector-clock';
import { logger } from './logger';

/**
 * Resolution strategies for different field types
 */
export const ResolutionStrategy = {
  /** Use timestamp to determine winner (newer wins) */
  LAST_WRITER_WINS: 'last_writer_wins',
  /** Boolean fields: true takes precedence (completion is permanent) */
  TRUE_WINS: 'true_wins',
  /** Arrays: merge keeping all unique items */
  MERGE_ARRAYS: 'merge_arrays',
  /** Numbers: keep the highest value */
  MAX_VALUE: 'max_value',
  /** Numbers: keep the lowest value */
  MIN_VALUE: 'min_value',
  /** Always prefer local value */
  PREFER_LOCAL: 'prefer_local',
  /** Always prefer remote value */
  PREFER_REMOTE: 'prefer_remote'
};

/**
 * Field-specific resolution configuration
 * Maps field names to their resolution strategy
 */
const FIELD_STRATEGIES = {
  // Plan-level fields
  planned_date: ResolutionStrategy.LAST_WRITER_WINS,
  name: ResolutionStrategy.LAST_WRITER_WINS,
  notes: ResolutionStrategy.LAST_WRITER_WINS,

  // Plan item fields
  completed: ResolutionStrategy.TRUE_WINS, // Completion is permanent
  completedAt: ResolutionStrategy.MAX_VALUE, // Keep earliest completion time
  text: ResolutionStrategy.LAST_WRITER_WINS,
  url: ResolutionStrategy.LAST_WRITER_WINS,
  cost: ResolutionStrategy.LAST_WRITER_WINS,
  days: ResolutionStrategy.LAST_WRITER_WINS,
  order: ResolutionStrategy.LAST_WRITER_WINS,
  assignedTo: ResolutionStrategy.LAST_WRITER_WINS,

  // Array fields - merge to preserve all data
  plan: ResolutionStrategy.MERGE_ARRAYS,
  permissions: ResolutionStrategy.MERGE_ARRAYS,
  'details.notes': ResolutionStrategy.MERGE_ARRAYS
};

/**
 * Resolve conflict between local and remote values for a single field
 *
 * @param {string} fieldName - Name of the field being resolved
 * @param {*} localValue - Local value
 * @param {*} remoteValue - Remote value
 * @param {number} localTimestamp - Local modification timestamp
 * @param {number} remoteTimestamp - Remote modification timestamp
 * @returns {*} Resolved value
 */
export function resolveField(fieldName, localValue, remoteValue, localTimestamp = 0, remoteTimestamp = 0) {
  // If values are identical, no conflict
  if (localValue === remoteValue) {
    return localValue;
  }

  // Handle null/undefined cases
  if (localValue == null && remoteValue != null) {
    return remoteValue;
  }
  if (remoteValue == null && localValue != null) {
    return localValue;
  }

  const strategy = FIELD_STRATEGIES[fieldName] || ResolutionStrategy.LAST_WRITER_WINS;

  logger.debug('[ConflictResolver] Resolving field', {
    fieldName,
    strategy,
    hasLocal: localValue != null,
    hasRemote: remoteValue != null
  });

  switch (strategy) {
    case ResolutionStrategy.LAST_WRITER_WINS:
      return remoteTimestamp > localTimestamp ? remoteValue : localValue;

    case ResolutionStrategy.TRUE_WINS:
      // For boolean fields, true always wins (completion is permanent)
      return localValue === true || remoteValue === true;

    case ResolutionStrategy.MERGE_ARRAYS:
      return mergeArrays(localValue, remoteValue, localTimestamp, remoteTimestamp);

    case ResolutionStrategy.MAX_VALUE:
      return Math.max(localValue || 0, remoteValue || 0);

    case ResolutionStrategy.MIN_VALUE: {
      const localNum = localValue ?? Infinity;
      const remoteNum = remoteValue ?? Infinity;
      return Math.min(localNum, remoteNum);
    }

    case ResolutionStrategy.PREFER_LOCAL:
      return localValue;

    case ResolutionStrategy.PREFER_REMOTE:
      return remoteValue;

    default:
      // Default to last writer wins
      return remoteTimestamp > localTimestamp ? remoteValue : localValue;
  }
}

/**
 * Merge two arrays of objects by _id, resolving conflicts in nested fields
 *
 * @param {Array} local - Local array
 * @param {Array} remote - Remote array
 * @param {number} localTimestamp - Local modification timestamp
 * @param {number} remoteTimestamp - Remote modification timestamp
 * @returns {Array} Merged array with conflicts resolved
 */
export function mergeArrays(local = [], remote = [], localTimestamp = 0, remoteTimestamp = 0) {
  // Handle non-array inputs
  if (!Array.isArray(local)) local = [];
  if (!Array.isArray(remote)) remote = [];

  const merged = new Map();
  const itemTimestamps = new Map(); // Track timestamps for each item

  // Add local items
  local.forEach(item => {
    const id = getItemId(item);
    if (id) {
      merged.set(id, { ...item });
      itemTimestamps.set(id, {
        local: item._timestamp || localTimestamp,
        remote: 0
      });
    }
  });

  // Merge remote items
  remote.forEach(item => {
    const id = getItemId(item);
    if (id) {
      const existing = merged.get(id);
      const timestamps = itemTimestamps.get(id) || { local: 0, remote: 0 };
      timestamps.remote = item._timestamp || remoteTimestamp;

      if (existing) {
        // Item exists in both - merge field by field
        const mergedItem = mergeObjects(
          existing,
          item,
          timestamps.local,
          timestamps.remote
        );
        merged.set(id, mergedItem);
      } else {
        // New remote item - add it
        merged.set(id, { ...item });
      }
      itemTimestamps.set(id, timestamps);
    }
  });

  const result = Array.from(merged.values());

  logger.debug('[ConflictResolver] Merged arrays', {
    localCount: local.length,
    remoteCount: remote.length,
    mergedCount: result.length
  });

  return result;
}

/**
 * Get unique identifier for an item
 *
 * @param {Object} item - Item to get ID from
 * @returns {string|null} Item ID or null
 */
function getItemId(item) {
  if (!item) return null;
  return item._id || item.plan_item_id || item.id || null;
}

/**
 * Merge two objects field by field
 *
 * @param {Object} local - Local object
 * @param {Object} remote - Remote object
 * @param {number} localTimestamp - Local modification timestamp
 * @param {number} remoteTimestamp - Remote modification timestamp
 * @returns {Object} Merged object
 */
function mergeObjects(local, remote, localTimestamp, remoteTimestamp) {
  const merged = { ...local };

  // Get all fields from remote that might need merging
  Object.keys(remote).forEach(field => {
    // Skip internal/metadata fields
    if (field.startsWith('_') && field !== '_id') return;

    const localVal = local[field];
    const remoteVal = remote[field];

    // Use field-specific resolution
    merged[field] = resolveField(
      field,
      localVal,
      remoteVal,
      localTimestamp,
      remoteTimestamp
    );
  });

  return merged;
}

/**
 * Resolve full plan state conflict between local and remote versions
 *
 * @param {Object} localPlan - Local plan state
 * @param {Object} remotePlan - Remote plan state
 * @param {Object} localClock - Local vector clock
 * @param {Object} remoteClock - Remote vector clock
 * @returns {{ resolved: Object, source: 'local' | 'remote' | 'merged', conflicts: Array }} Resolution result
 */
export function resolvePlanConflict(localPlan, remotePlan, localClock, remoteClock) {
  // Handle null cases
  if (!localPlan) {
    return { resolved: remotePlan, source: 'remote', conflicts: [] };
  }
  if (!remotePlan) {
    return { resolved: localPlan, source: 'local', conflicts: [] };
  }

  const comparison = VectorClock.compare(localClock, remoteClock);

  logger.debug('[ConflictResolver] Resolving plan conflict', {
    planId: localPlan._id,
    comparison,
    localClock: VectorClock.format(localClock),
    remoteClock: VectorClock.format(remoteClock)
  });

  // If one strictly dominates, use that version
  if (comparison === 'before') {
    return { resolved: remotePlan, source: 'remote', conflicts: [] };
  }

  if (comparison === 'after') {
    return { resolved: localPlan, source: 'local', conflicts: [] };
  }

  if (comparison === 'equal') {
    return { resolved: localPlan, source: 'local', conflicts: [] };
  }

  // Concurrent - need field-by-field merge
  const resolved = { ...localPlan };
  const conflicts = [];

  const localTimestamp = localPlan._timestamp || 0;
  const remoteTimestamp = remotePlan._timestamp || 0;

  // Merge all fields from remote
  Object.keys(remotePlan).forEach(field => {
    // Skip internal fields except _id
    if (field.startsWith('_') && field !== '_id') return;

    const localVal = localPlan[field];
    const remoteVal = remotePlan[field];

    // Skip if identical
    if (JSON.stringify(localVal) === JSON.stringify(remoteVal)) {
      return;
    }

    // Track that this field had a conflict
    conflicts.push({
      field,
      localValue: localVal,
      remoteValue: remoteVal,
      resolution: FIELD_STRATEGIES[field] || ResolutionStrategy.LAST_WRITER_WINS
    });

    // Resolve the field
    resolved[field] = resolveField(
      field,
      localVal,
      remoteVal,
      localTimestamp,
      remoteTimestamp
    );
  });

  // Merge vector clocks
  resolved._vectorClock = VectorClock.merge(localClock, remoteClock);

  logger.info('[ConflictResolver] Plan conflict resolved', {
    planId: localPlan._id,
    conflictCount: conflicts.length,
    mergedFields: conflicts.map(c => c.field)
  });

  return { resolved, source: 'merged', conflicts };
}

/**
 * Resolve conflict for a single plan item
 *
 * @param {Object} localItem - Local item state
 * @param {Object} remoteItem - Remote item state
 * @param {number} localTimestamp - Local modification timestamp
 * @param {number} remoteTimestamp - Remote modification timestamp
 * @returns {{ resolved: Object, conflicts: Array }} Resolution result
 */
export function resolveItemConflict(localItem, remoteItem, localTimestamp = 0, remoteTimestamp = 0) {
  if (!localItem) return { resolved: remoteItem, conflicts: [] };
  if (!remoteItem) return { resolved: localItem, conflicts: [] };

  const resolved = {};
  const conflicts = [];

  // Get all fields from both items
  const allFields = new Set([
    ...Object.keys(localItem),
    ...Object.keys(remoteItem)
  ]);

  allFields.forEach(field => {
    // Skip internal metadata
    if (field.startsWith('_') && !['_id', 'plan_item_id'].includes(field)) return;

    const localVal = localItem[field];
    const remoteVal = remoteItem[field];

    // Skip if identical
    if (JSON.stringify(localVal) === JSON.stringify(remoteVal)) {
      resolved[field] = localVal;
      return;
    }

    // Track conflict
    if (localVal !== undefined && remoteVal !== undefined) {
      conflicts.push({
        field,
        localValue: localVal,
        remoteValue: remoteVal,
        resolution: FIELD_STRATEGIES[field] || ResolutionStrategy.LAST_WRITER_WINS
      });
    }

    // Resolve
    resolved[field] = resolveField(
      field,
      localVal,
      remoteVal,
      localTimestamp,
      remoteTimestamp
    );
  });

  return { resolved, conflicts };
}

/**
 * Check if there's a conflict that needs resolution
 * Concurrent vector clocks indicate independent changes
 *
 * @param {Object} localClock - Local vector clock
 * @param {Object} remoteClock - Remote vector clock
 * @returns {boolean} True if conflict exists
 */
export function hasConflict(localClock, remoteClock) {
  return VectorClock.isConcurrent(localClock, remoteClock);
}

/**
 * Determine if remote changes should be applied
 * Returns true if remote is newer or equal (no local changes since)
 *
 * @param {Object} localClock - Local vector clock
 * @param {Object} remoteClock - Remote vector clock
 * @returns {boolean} True if remote should be applied
 */
export function shouldApplyRemote(localClock, remoteClock) {
  const comparison = VectorClock.compare(localClock, remoteClock);
  return comparison === 'before' || comparison === 'equal';
}

/**
 * Get the resolution strategy for a field
 *
 * @param {string} fieldName - Field name
 * @returns {string} Resolution strategy
 */
export function getFieldStrategy(fieldName) {
  return FIELD_STRATEGIES[fieldName] || ResolutionStrategy.LAST_WRITER_WINS;
}

/**
 * Register a custom resolution strategy for a field
 * Useful for application-specific fields
 *
 * @param {string} fieldName - Field name
 * @param {string} strategy - Resolution strategy from ResolutionStrategy
 */
export function registerFieldStrategy(fieldName, strategy) {
  if (!Object.values(ResolutionStrategy).includes(strategy)) {
    logger.warn('[ConflictResolver] Invalid strategy', { fieldName, strategy });
    return;
  }
  FIELD_STRATEGIES[fieldName] = strategy;
  logger.debug('[ConflictResolver] Registered field strategy', { fieldName, strategy });
}

// Default export
const ConflictResolver = {
  ResolutionStrategy,
  resolveField,
  mergeArrays,
  resolvePlanConflict,
  resolveItemConflict,
  hasConflict,
  shouldApplyRemote,
  getFieldStrategy,
  registerFieldStrategy
};

export default ConflictResolver;

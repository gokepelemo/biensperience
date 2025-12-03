/**
 * Mention Resolver - Fetches entity names from API for mention display
 * Converts {entity/id} to @Name or #Name by fetching entity data
 *
 * @module mention-resolver
 */

import { parseMentions } from './mentions';
import { logger } from './logger';
import { sendRequest } from './send-request';

/**
 * Cache for resolved entities to avoid repeated API calls
 * Format: { 'user/123abc': { name: 'John Doe', type: 'user' }, ... }
 */
const entityCache = new Map();

/**
 * Maximum cache age in milliseconds (5 minutes)
 */
const CACHE_MAX_AGE = 5 * 60 * 1000;

/**
 * Cache entries with timestamp
 */
const cacheTimestamps = new Map();

/**
 * Fetch entity data from backend API
 * @param {string} entityType - Type of entity (user, plan-item, destination, experience)
 * @param {string} entityId - Entity ID
 * @returns {Promise<Object|null>} Entity data or null if not found
 */
async function fetchEntityFromAPI(entityType, entityId) {
  try {
    let endpoint;

    switch (entityType) {
      case 'user':
        endpoint = `/api/users/${entityId}`;
        break;
      case 'plan-item':
        // Plan items require experience context - we'll handle this specially
        // For now, return the ID as fallback
        logger.warn('Plan item mention resolution requires additional context', { entityId });
        return null;
      case 'destination':
        endpoint = `/api/destinations/${entityId}`;
        break;
      case 'experience':
        endpoint = `/api/experiences/${entityId}`;
        break;
      default:
        logger.warn('Unknown entity type for mention', { entityType, entityId });
        return null;
    }

    // Use sendRequest which handles authentication headers
    const data = await sendRequest(endpoint, 'GET');
    return data;
  } catch (error) {
    logger.error('Error fetching entity for mention', { entityType, entityId }, error);
    return null;
  }
}

/**
 * Resolve a single entity (with caching)
 * @param {string} entityType - Type of entity
 * @param {string} entityId - Entity ID
 * @returns {Promise<Object|null>} Entity data
 */
async function resolveEntity(entityType, entityId) {
  const cacheKey = `${entityType}/${entityId}`;

  // Check cache
  const cached = entityCache.get(cacheKey);
  const cacheTime = cacheTimestamps.get(cacheKey);

  if (cached && cacheTime && (Date.now() - cacheTime < CACHE_MAX_AGE)) {
    logger.trace('Using cached entity data', { entityType, entityId });
    return cached;
  }

  // Fetch from API
  logger.debug('Fetching entity data from API', { entityType, entityId });
  const entity = await fetchEntityFromAPI(entityType, entityId);

  if (entity) {
    // Cache the result
    entityCache.set(cacheKey, entity);
    cacheTimestamps.set(cacheKey, Date.now());
  }

  return entity;
}

/**
 * Get display name for an entity
 * @param {string} entityType - Type of entity
 * @param {Object} entity - Entity data from API
 * @returns {string} Display name
 */
function getEntityDisplayName(entityType, entity) {
  if (!entity) return 'Unknown';

  switch (entityType) {
    case 'user':
      return entity.name || entity.username || 'Unknown User';
    case 'plan-item':
      return entity.name || entity.experience_name || 'Unknown Item';
    case 'destination':
      return entity.name || 'Unknown Destination';
    case 'experience':
      return entity.name || 'Unknown Experience';
    default:
      return 'Unknown';
  }
}

/**
 * Resolve all mentions in text and convert to display format
 * Fetches entity data from API and converts {entity/id} to @Name or #Name
 *
 * @param {string} text - Text containing {entity/id} mentions
 * @param {Object} planItemsMap - Optional map of plan item IDs to names (to avoid API calls)
 * @returns {Promise<string>} Text with @Name or #Name format
 */
export async function resolveMentionsToDisplayText(text, planItemsMap = {}) {
  if (!text) return '';

  const segments = parseMentions(text);
  const resolvedSegments = [];

  for (const segment of segments) {
    if (segment.type === 'text') {
      resolvedSegments.push(segment.content);
    } else if (segment.type === 'mention') {
      const { entityType, entityId } = segment;
      const prefix = entityType === 'plan-item' ? '#' : '@';

      // For plan items, use the provided map if available
      if (entityType === 'plan-item' && planItemsMap[entityId]) {
        const name = planItemsMap[entityId].name ||
                     planItemsMap[entityId].experience_name ||
                     'Unknown Item';
        resolvedSegments.push(`${prefix}${name}`);
        continue;
      }

      // Fetch entity data from API
      const entity = await resolveEntity(entityType, entityId);
      const displayName = getEntityDisplayName(entityType, entity);

      resolvedSegments.push(`${prefix}${displayName}`);
    }
  }

  return resolvedSegments.join('');
}

/**
 * Bulk resolve multiple entities at once (more efficient than individual calls)
 * @param {Array} mentions - Array of mention objects from parseMentions()
 * @param {Object} planItemsMap - Optional map of plan item IDs to names
 * @returns {Promise<Object>} Map of entityId -> entity data
 */
export async function bulkResolveEntities(mentions, planItemsMap = {}) {
  const entityMap = {};

  // Group by entity type for potential batch API calls in the future
  const byType = {};
  mentions.forEach(mention => {
    if (mention.type !== 'mention') return;

    const { entityType, entityId } = mention;

    // Use plan items map if available
    if (entityType === 'plan-item' && planItemsMap[entityId]) {
      entityMap[entityId] = planItemsMap[entityId];
      return;
    }

    if (!byType[entityType]) {
      byType[entityType] = [];
    }
    byType[entityType].push(entityId);
  });

  // Resolve each entity (currently one-by-one, but can be optimized with batch endpoints)
  for (const [entityType, ids] of Object.entries(byType)) {
    for (const entityId of ids) {
      const entity = await resolveEntity(entityType, entityId);
      if (entity) {
        entityMap[entityId] = entity;
      }
    }
  }

  return entityMap;
}

/**
 * Clear the entity cache (useful when entities are updated)
 * @param {string} entityType - Optional: clear only specific type
 * @param {string} entityId - Optional: clear only specific entity
 */
export function clearEntityCache(entityType = null, entityId = null) {
  if (entityType && entityId) {
    const cacheKey = `${entityType}/${entityId}`;
    entityCache.delete(cacheKey);
    cacheTimestamps.delete(cacheKey);
    logger.debug('Cleared entity cache for specific entity', { entityType, entityId });
  } else if (entityType) {
    // Clear all entities of a specific type
    for (const key of entityCache.keys()) {
      if (key.startsWith(`${entityType}/`)) {
        entityCache.delete(key);
        cacheTimestamps.delete(key);
      }
    }
    logger.debug('Cleared entity cache for type', { entityType });
  } else {
    // Clear entire cache
    entityCache.clear();
    cacheTimestamps.clear();
    logger.debug('Cleared entire entity cache');
  }
}

/**
 * Preload entities into cache (useful when you already have the data)
 * @param {Array} entities - Array of entity objects with _id and type
 */
export function preloadEntityCache(entities) {
  entities.forEach(entity => {
    if (!entity._id || !entity.type) return;

    const cacheKey = `${entity.type}/${entity._id}`;
    entityCache.set(cacheKey, entity);
    cacheTimestamps.set(cacheKey, Date.now());
  });

  logger.debug('Preloaded entities into cache', { count: entities.length });
}

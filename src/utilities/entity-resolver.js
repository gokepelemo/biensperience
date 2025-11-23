/**
 * Entity Resolver Utility
 * Fetches entity data from API for mentions that reference entities not in local context
 * Includes caching to avoid redundant API calls
 */

import { showDestination } from './destinations-api';
import { showExperience } from './experiences-api';
import { getUserData } from './users-api';
import { logger } from './logger';

// Cache for resolved entities (keeps them for the session)
const entityCache = new Map();

/**
 * Resolve an entity by type and ID
 * @param {string} entityType - Type of entity (user, destination, experience)
 * @param {string} entityId - Entity ID
 * @returns {Promise<Object|null>} Entity data or null if not found
 */
export async function resolveEntity(entityType, entityId) {
  // Check cache first
  const cacheKey = `${entityType}:${entityId}`;
  if (entityCache.has(cacheKey)) {
    logger.debug('[EntityResolver] Cache hit', { entityType, entityId });
    return entityCache.get(cacheKey);
  }

  try {
    let entity = null;

    switch (entityType) {
      case 'destination':
        entity = await showDestination(entityId);
        if (entity) {
          entity = {
            _id: entity._id,
            name: entity.name,
            city: entity.city,
            country: entity.country,
            description: entity.description
          };
        }
        break;

      case 'experience':
        entity = await showExperience(entityId);
        if (entity) {
          entity = {
            _id: entity._id,
            name: entity.name,
            description: entity.description,
            destination: entity.destination
          };
        }
        break;

      case 'user':
        entity = await getUserData(entityId);
        if (entity) {
          entity = {
            _id: entity._id,
            name: entity.name,
            username: entity.username,
            bio: entity.bio
          };
        }
        break;

      default:
        logger.warn('[EntityResolver] Unknown entity type', { entityType, entityId });
        return null;
    }

    // Cache the result (even if null, to avoid repeated failed lookups)
    entityCache.set(cacheKey, entity);

    logger.debug('[EntityResolver] Entity resolved', {
      entityType,
      entityId,
      found: !!entity,
      name: entity?.name
    });

    return entity;
  } catch (error) {
    logger.error('[EntityResolver] Failed to resolve entity', { entityType, entityId }, error);
    // Cache the failure to avoid repeated API calls
    entityCache.set(cacheKey, null);
    return null;
  }
}

/**
 * Clear the entity cache
 * Call this when navigating to a new page or when data changes
 */
export function clearEntityCache() {
  entityCache.clear();
  logger.debug('[EntityResolver] Cache cleared');
}

/**
 * Preload entities into cache
 * @param {Array<{type: string, id: string, data: Object}>} entities
 */
export function preloadEntities(entities) {
  entities.forEach(({ type, id, data }) => {
    const cacheKey = `${type}:${id}`;
    entityCache.set(cacheKey, data);
  });
  logger.debug('[EntityResolver] Preloaded entities', { count: entities.length });
}

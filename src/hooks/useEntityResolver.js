/**
 * useEntityResolver Hook
 * Resolves missing entities asynchronously and merges them with local entityData
 */

import { useState, useEffect } from 'react';
import { resolveEntity } from '../utilities/entity-resolver';
import { extractMentions } from '../utilities/mentions';
import { logger } from '../utilities/logger';

/**
 * Hook to resolve missing entities from text with mentions
 * @param {string} text - Text containing mentions
 * @param {Object} localEntityData - Local entity data map
 * @returns {Object} Merged entity data (local + resolved)
 */
export default function useEntityResolver(text, localEntityData = {}) {
  const [resolvedEntities, setResolvedEntities] = useState({});
  const [isResolving, setIsResolving] = useState(false);

  useEffect(() => {
    if (!text) return;

    const resolveMissingEntities = async () => {
      // Extract all mentions from text
      const mentions = extractMentions(text);

      // Find mentions that aren't in local entity data
      const missingMentions = mentions.filter(
        mention => !localEntityData[mention.entityId]
      );

      if (missingMentions.length === 0) {
        // No missing entities, clear resolved state
        setResolvedEntities({});
        return;
      }

      logger.debug('[useEntityResolver] Resolving missing entities', {
        total: mentions.length,
        missing: missingMentions.length
      });

      setIsResolving(true);

      // Resolve all missing entities in parallel
      const results = await Promise.all(
        missingMentions.map(async (mention) => {
          const entity = await resolveEntity(mention.entityType, mention.entityId);
          return { id: mention.entityId, entity };
        })
      );

      // Build map of resolved entities
      const resolved = {};
      results.forEach(({ id, entity }) => {
        if (entity) {
          resolved[id] = entity;
        }
      });

      setResolvedEntities(resolved);
      setIsResolving(false);

      logger.debug('[useEntityResolver] Resolution complete', {
        resolved: Object.keys(resolved).length
      });
    };

    resolveMissingEntities();
  }, [text, localEntityData]);

  // Merge local and resolved entity data
  const mergedEntityData = {
    ...localEntityData,
    ...resolvedEntities
  };

  return {
    entityData: mergedEntityData,
    isResolving,
    hasResolvedEntities: Object.keys(resolvedEntities).length > 0
  };
}

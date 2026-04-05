import { useState, useCallback } from 'react';
import { useFeatureFlag } from './useFeatureFlag';
import { openWithAnalysis } from './useBienBot';

/**
 * Entity types that support the "Analyze" mode (proactive suggestions).
 * All others use the "Discuss" mode (chat without pre-flight analysis).
 */
const ANALYZE_ENTITIES = new Set(['destination', 'experience', 'plan', 'plan_item']);

/**
 * useBienBotEntityAction
 *
 * Provides a BienBot trigger action for an entity detail view.
 * Returns:
 *   - label: 'Analyze' for entities with analyze support, 'Discuss' for others (e.g. user)
 *   - loading: true while the analyze API call is in flight
 *   - hasAccess: whether the user has the ai_features flag
 *   - handleOpen: async handler — calls openWithAnalysis for analyze entities,
 *                 or openWithAnalysis with entity='user' for greeting context
 *
 * @param {string} entity - 'destination'|'experience'|'plan'|'plan_item'|'user'
 * @param {string} entityId - MongoDB ObjectId string
 * @param {string} entityLabel - Human-readable name for the message header
 * @returns {{ label: string, loading: boolean, hasAccess: boolean, handleOpen: Function }}
 */
export function useBienBotEntityAction(entity, entityId, entityLabel) {
  const { enabled: hasAccess } = useFeatureFlag('ai_features');
  const [loading, setLoading] = useState(false);

  const label = ANALYZE_ENTITIES.has(entity) ? 'Analyze' : 'Discuss';

  const handleOpen = useCallback(async () => {
    if (!hasAccess || !entityId) return;
    setLoading(true);
    try {
      await openWithAnalysis(entity, entityId, entityLabel || entity);
    } finally {
      setLoading(false);
    }
  }, [hasAccess, entity, entityId, entityLabel]);

  return { label, loading, hasAccess, handleOpen };
}

export default useBienBotEntityAction;

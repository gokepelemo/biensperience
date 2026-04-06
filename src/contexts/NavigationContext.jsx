/**
 * NavigationContext
 *
 * Single source of truth for the user's current navigation breadcrumb:
 * Destination → Experience → Plan → Plan Item.
 *
 * Page-level components call setNavigatedEntity(type, data, extra?) as entity
 * data loads.  When BienBot opens, the accumulated schema is sent with the first
 * message so the backend can immediately:
 *
 *   • Seed session.context with all ancestor IDs (no first-turn round trip)
 *   • Fire all relevant context builders in parallel from message 1
 *   • Skip the DB lookup for parent plan ID when invoked from a plan_item
 *
 * The builders still query MongoDB — this context only carries IDs and labels.
 *
 * Rules:
 *   - When a higher ancestor changes _id, all descendants are auto-cleared.
 *   - Re-setting the same _id refreshes data without clearing descendants.
 *   - Pages are responsible for calling setNavigatedEntity when data loads;
 *     the schema is not cleared on route changes so BienBot always sees the
 *     most recent context the user was looking at.
 *
 * @module contexts/NavigationContext
 */

import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import {
  buildDestinationLayer,
  buildExperienceLayer,
  buildPlanLayer,
  buildPlanItemLayer,
  composeNavigationSchema,
  isDescendant,
  NAVIGATION_LAYERS,
} from '../utilities/navigation-context-schema';
import { logger } from '../utilities/logger';

// Preserve context reference across HMR to prevent "must be used within Provider" errors
const _hmrHot = import.meta.hot;
const NavigationContext = (_hmrHot?.data?.NavigationContext) || createContext(null);
if (_hmrHot) {
  _hmrHot.data.NavigationContext = NavigationContext;
}

export function NavigationProvider({ children }) {
  const [layers, setLayers] = useState({
    destination: null,
    experience:  null,
    plan:        null,
    plan_item:   null,
  });

  /**
   * Register a navigation entity.
   *
   * @param {'destination'|'experience'|'plan'|'plan_item'} type
   * @param {Object} data - Raw entity document (from DataContext or API)
   * @param {Object} [extra] - Extra hints: { parentPlanId } required for plan_item
   */
  const setNavigatedEntity = useCallback((type, data, extra = {}) => {
    if (!NAVIGATION_LAYERS.includes(type)) {
      logger.warn('[NavigationContext] Unknown entity type', { type });
      return;
    }

    let layer;
    switch (type) {
      case 'destination': layer = buildDestinationLayer(data); break;
      case 'experience':  layer = buildExperienceLayer(data);  break;
      case 'plan':        layer = buildPlanLayer(data);        break;
      case 'plan_item':   layer = buildPlanItemLayer(data, extra.parentPlanId); break;
      default: return;
    }
    if (!layer) return;

    setLayers(prev => {
      const isNewId = !prev[type] || prev[type]._id !== layer._id;
      const next = { ...prev, [type]: layer };
      // Clear stale descendants when the ancestor entity changed
      if (isNewId) {
        for (const l of NAVIGATION_LAYERS) {
          if (isDescendant(type, l)) next[l] = null;
        }
      }
      logger.debug('[NavigationContext] setNavigatedEntity', { type, id: layer._id, clearedDescendants: isNewId });
      return next;
    });
  }, []);

  /**
   * Explicitly clear a layer and all its descendants.
   * Accepts a single type string or an array.
   *
   * @param {string|string[]} typeOrTypes
   */
  const clearNavigationFrom = useCallback((typeOrTypes) => {
    const types = Array.isArray(typeOrTypes) ? typeOrTypes : [typeOrTypes];
    setLayers(prev => {
      const next = { ...prev };
      for (const type of types) {
        if (!NAVIGATION_LAYERS.includes(type)) continue;
        next[type] = null;
        for (const l of NAVIGATION_LAYERS) {
          if (isDescendant(type, l)) next[l] = null;
        }
      }
      return next;
    });
  }, []);

  // Recompose only when a layer reference actually changes
  const navigationSchema = useMemo(() => composeNavigationSchema(layers), [layers]);

  const value = useMemo(() => ({
    navigationSchema,
    setNavigatedEntity,
    clearNavigationFrom,
  }), [navigationSchema, setNavigatedEntity, clearNavigationFrom]);

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
}

/**
 * @returns {{ navigationSchema: Object, setNavigatedEntity: Function, clearNavigationFrom: Function }}
 */
export function useNavigationContext() {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error('[useNavigationContext] must be used within a NavigationProvider');
  return ctx;
}

export default NavigationContext;

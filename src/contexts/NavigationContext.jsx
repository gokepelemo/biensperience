/**
 * NavigationContext — Tracks the current navigation breadcrumb (destination → experience → plan → plan_item).
 *
 * Views call `setNavigatedEntity(type, entity)` when they load an entity.
 * BienBotTrigger reads `navigationSchema` to seed the LLM with the full ancestor chain
 * on the very first message, before the LLM has had a chance to discover entity context.
 *
 * The schema is a lean map keyed by entity type with only the IDs needed for context seeding.
 *
 * Hierarchy levels (used by clearNavigationLevel):
 *   destination = 0, experience = 1, plan = 2, plan_item = 3
 *
 * When a parent entity is registered, all descendant entries are cleared so BienBot
 * never has stale plan_id / plan_item_id from a previously visited sub-page.
 */

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';

const NavigationContext = createContext(null);

/** Ordered array establishes parent→child clearing direction */
const ENTITY_LEVELS = ['destination', 'experience', 'plan', 'plan_item'];

/**
 * Build a navigation schema entry for a given entity type.
 * Returns only the fields the backend's extractContextIds() needs.
 */
function buildSchemaEntry(type, entity) {
  if (!entity?._id) return null;
  const id = typeof entity._id === 'object' ? entity._id.toString() : String(entity._id);

  switch (type) {
    case 'destination':
      return { _id: id, name: entity.name || null };

    case 'experience':
      return {
        _id: id,
        name: entity.name || null,
        destination: entity.destination?._id
          ? String(entity.destination._id)
          : (entity.destination ? String(entity.destination) : null),
      };

    case 'plan':
      return {
        _id: id,
        experience: entity.experience?._id
          ? String(entity.experience._id)
          : (entity.experience ? String(entity.experience) : null),
      };

    case 'plan_item':
      return {
        _id: id,
        plan_id: entity.plan_id ? String(entity.plan_id) : null,
      };

    default:
      return { _id: id };
  }
}

export function NavigationProvider({ children }) {
  const [schema, setSchema] = useState({});

  // Keep a ref so callbacks don't cause unnecessary re-renders on every entity load
  const schemaRef = useRef(schema);

  const setNavigatedEntity = useCallback((type, entity) => {
    if (!type || !entity?._id) return;
    const entry = buildSchemaEntry(type, entity);
    if (!entry) return;

    setSchema((prev) => {
      // Clear all descendant levels so stale IDs from a previous sub-page don't linger.
      const typeLevel = ENTITY_LEVELS.indexOf(type);
      const next = { ...prev };
      if (typeLevel >= 0) {
        for (let lvl = typeLevel + 1; lvl < ENTITY_LEVELS.length; lvl++) {
          delete next[ENTITY_LEVELS[lvl]];
        }
      }
      next[type] = entry;
      schemaRef.current = next;
      return next;
    });
  }, []);

  /**
   * Clear all navigation entries at or below the given level index.
   * Level 0 = destination, 1 = experience, 2 = plan, 3 = plan_item.
   * Called by component cleanup effects when the view unmounts.
   *
   * @param {number} minLevel - Entries at levels >= minLevel are removed.
   */
  const clearNavigationLevel = useCallback((minLevel) => {
    if (typeof minLevel !== 'number') return;
    setSchema((prev) => {
      const next = { ...prev };
      for (let lvl = minLevel; lvl < ENTITY_LEVELS.length; lvl++) {
        delete next[ENTITY_LEVELS[lvl]];
      }
      schemaRef.current = next;
      return next;
    });
  }, []);

  const navigationSchema = useMemo(() => {
    return Object.keys(schema).length > 0 ? schema : null;
  }, [schema]);

  const value = useMemo(() => ({
    navigationSchema,
    setNavigatedEntity,
    clearNavigationLevel,
  }), [navigationSchema, setNavigatedEntity, clearNavigationLevel]);

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
}

NavigationProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export function useNavigationContext() {
  const ctx = useContext(NavigationContext);
  if (!ctx) {
    // Return a no-op fallback so consumers outside the provider don't crash
    return { navigationSchema: null, setNavigatedEntity: () => {}, clearNavigationLevel: () => {} };
  }
  return ctx;
}

export default NavigationContext;

/**
 * NavigationContext — Tracks the current navigation breadcrumb (destination → experience → plan → plan_item).
 *
 * Views call `setNavigatedEntity(type, entity)` when they load an entity.
 * BienBotTrigger reads `navigationSchema` to seed the LLM with the full ancestor chain
 * on the very first message, before the LLM has had a chance to discover entity context.
 *
 * The schema is a lean map keyed by entity type with only the IDs needed for context seeding.
 */

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';

const NavigationContext = createContext(null);

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
      const next = { ...prev, [type]: entry };
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
  }), [navigationSchema, setNavigatedEntity]);

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
    return { navigationSchema: null, setNavigatedEntity: () => {} };
  }
  return ctx;
}

export default NavigationContext;

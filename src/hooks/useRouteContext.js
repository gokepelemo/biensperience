/**
 * useRouteContext — Derives BienBot invoke context from the current route.
 *
 * Parses `location.pathname` to detect entity type and ID, then resolves
 * the entity label from DataContext / UserContext so BienBotTrigger can
 * render globally without per-view props.
 *
 * @module hooks/useRouteContext
 */

import { useMemo } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { useUser } from '../contexts/UserContext';

/**
 * Route patterns → entity type mapping.
 * Order matters — first match wins.
 */
const ROUTE_PATTERNS = [
  { pattern: /^\/experiences\/([a-f0-9]{24})(\/|$)/i, entity: 'experience', paramIndex: 1 },
  { pattern: /^\/destinations\/([a-f0-9]{24})(\/|$)/i, entity: 'destination', paramIndex: 1 },
  { pattern: /^\/profile\/([a-f0-9]{24})(\/|$)/i, entity: 'user', paramIndex: 1 },
  { pattern: /^\/profile\/?$/i, entity: 'user', paramIndex: null },
];

/**
 * View type detection for non-entity pages.
 * Used for placeholder text and suggested action chips.
 */
const VIEW_PATTERNS = [
  { pattern: /^\/experiences\/?$/i, view: 'experiences' },
  { pattern: /^\/destinations\/?$/i, view: 'destinations' },
  { pattern: /^\/experience-types\//i, view: 'experience-types' },
  { pattern: /^\/countries\//i, view: 'countries' },
  { pattern: /^\/dashboard\/?$/i, view: 'dashboard' },
  { pattern: /^\/?$/i, view: 'home' },
  { pattern: /^\/profile\/update/i, view: 'settings' },
  { pattern: /^\/invites/i, view: 'invites' },
  { pattern: /^\/admin/i, view: 'admin' },
];

/**
 * Derive BienBot context from the current route.
 *
 * @returns {{
 *   invokeContext: { entity: string, id: string, label: string, contextDescription?: string } | null,
 *   currentView: string | null,
 *   isEntityView: boolean
 * }}
 */
export default function useRouteContext() {
  const location = useLocation();
  const { user } = useUser();
  const { getDestination, getExperience } = useData();

  const result = useMemo(() => {
    const { pathname } = location;

    // Try entity routes first
    for (const { pattern, entity, paramIndex } of ROUTE_PATTERNS) {
      const match = pathname.match(pattern);
      if (match) {
        const entityId = paramIndex !== null ? match[paramIndex] : user?._id?.toString();
        if (!entityId) continue;

        let label = null;
        if (entity === 'experience') {
          const exp = getExperience(entityId);
          label = exp?.name || null;
        } else if (entity === 'destination') {
          const dest = getDestination(entityId);
          label = dest?.name || null;
        } else if (entity === 'user') {
          // Own profile
          if (entityId === user?._id?.toString()) {
            label = user?.name || null;
          }
        }

        return {
          invokeContext: label ? { entity, id: entityId, label } : null,
          currentView: entity,
          isEntityView: true,
        };
      }
    }

    // Try view routes
    for (const { pattern, view } of VIEW_PATTERNS) {
      if (pattern.test(pathname)) {
        return { invokeContext: null, currentView: view, isEntityView: false };
      }
    }

    return { invokeContext: null, currentView: null, isEntityView: false };
  }, [location.pathname, user?._id, user?.name, getDestination, getExperience]);

  return result;
}

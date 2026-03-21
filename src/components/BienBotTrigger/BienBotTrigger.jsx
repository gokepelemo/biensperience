/**
 * BienBotTrigger — Floating action button that opens BienBotPanel.
 *
 * Renders globally for authenticated users with the `ai_features` flag.
 * Derives entity context from the current route via useRouteContext, and
 * accepts optional override props for sub-entity contexts (e.g. plan items).
 *
 * @module components/BienBotTrigger
 */

import React, { useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';
import { useUser } from '../../contexts/UserContext';
import useRouteContext from '../../hooks/useRouteContext';
import { logger } from '../../utilities/logger';
import styles from './BienBotTrigger.module.css';

/**
 * BienBotTrigger FAB component.
 *
 * When rendered without props (global placement), it auto-detects context
 * from the current route. Props can override the detected context for
 * sub-entity views (e.g. plan item modals).
 *
 * @param {Object} [props]
 * @param {string} [props.entity] - Override entity type
 * @param {string} [props.entityId] - Override entity ID
 * @param {string} [props.entityLabel] - Override display label
 * @param {string} [props.contextDescription] - Override context description
 */
export default function BienBotTrigger({ entity, entityId, entityLabel, contextDescription } = {}) {
  const { user } = useUser();
  const { enabled } = useFeatureFlag('ai_features');
  const [panelOpen, setPanelOpen] = useState(false);

  // Route-based context detection
  const { invokeContext: routeContext, currentView, isEntityView } = useRouteContext();

  // Merge: explicit props override route detection
  const invokeContext = useMemo(() => {
    if (entity && entityId && entityLabel) {
      return {
        entity,
        id: entityId,
        label: entityLabel,
        ...(contextDescription && { contextDescription }),
      };
    }
    return routeContext;
  }, [entity, entityId, entityLabel, contextDescription, routeContext]);

  const handleOpen = useCallback(() => {
    const ctx = invokeContext || {};
    logger.debug('[BienBotTrigger] Opening panel', { entity: ctx.entity, entityId: ctx.id, currentView });
    setPanelOpen(true);
  }, [invokeContext, currentView]);

  const handleClose = useCallback(() => {
    setPanelOpen(false);
  }, []);

  // Do not render if user is not authenticated or flag is disabled
  if (!user || !enabled) {
    return null;
  }

  const ariaLabel = invokeContext?.label
    ? `Open BienBot assistant for ${invokeContext.label}`
    : 'Open BienBot assistant';

  // Render FAB and Panel via portal to document.body so they always sit above
  // any intervening stacking context (e.g. fullscreen modals with z-index 1050).
  return createPortal(
    <>
      {!panelOpen && (
        <button
          type="button"
          className={styles.fab}
          onClick={handleOpen}
          aria-label={ariaLabel}
        >
          <span className={styles.fabIcon} aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="currentColor" />
              <path d="M9 9.5a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5zM15 9.5a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5z" fill="currentColor" />
              <path d="M12 17.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" fill="currentColor" />
            </svg>
          </span>
        </button>
      )}

      {panelOpen && (
        <BienBotPanelLazy
          open={panelOpen}
          onClose={handleClose}
          invokeContext={invokeContext}
          currentView={currentView}
          isEntityView={isEntityView}
        />
      )}
    </>,
    document.body
  );
}

BienBotTrigger.propTypes = {
  entity: PropTypes.oneOf(['destination', 'experience', 'plan', 'plan_item', 'user']),
  entityId: PropTypes.string,
  entityLabel: PropTypes.string,
  contextDescription: PropTypes.string
};

/**
 * Lazy wrapper for BienBotPanel — avoids loading the panel (and its
 * heavy useBienBot hook + SSE machinery) until the user actually opens it.
 */
function BienBotPanelLazy({ open, onClose, invokeContext, currentView, isEntityView }) {
  const [Panel, setPanel] = useState(null);
  const [loadError, setLoadError] = useState(false);

  React.useEffect(() => {
    let cancelled = false;
    import('../BienBotPanel/BienBotPanel')
      .then(mod => {
        if (!cancelled) setPanel(() => mod.default);
      })
      .catch(err => {
        logger.error('[BienBotTrigger] Failed to load BienBotPanel', { error: err.message });
        if (!cancelled) setLoadError(true);
      });
    return () => { cancelled = true; };
  }, []);

  if (loadError || !Panel) {
    return null;
  }

  return (
    <Panel
      open={open}
      onClose={onClose}
      invokeContext={invokeContext}
      currentView={currentView}
      isEntityView={isEntityView}
    />
  );
}

BienBotPanelLazy.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  invokeContext: PropTypes.shape({
    entity: PropTypes.string.isRequired,
    id: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    contextDescription: PropTypes.string
  }),
  currentView: PropTypes.string,
  isEntityView: PropTypes.bool
};

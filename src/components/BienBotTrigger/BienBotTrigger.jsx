/**
 * BienBotTrigger — Floating action button that opens BienBotPanel.
 *
 * Renders a fixed-position circular button (bottom-right) on entity pages.
 * Only visible to authenticated users with the `ai_features` feature flag.
 *
 * @module components/BienBotTrigger
 */

import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';
import { useUser } from '../../contexts/UserContext';
import { logger } from '../../utilities/logger';
import styles from './BienBotTrigger.module.css';

/**
 * BienBotTrigger FAB component.
 *
 * @param {Object} props
 * @param {string} props.entity - Entity type (destination|experience|plan|plan_item|user)
 * @param {string} props.entityId - Entity ID
 * @param {string} props.entityLabel - Display label for the entity (shown in panel header)
 */
export default function BienBotTrigger({ entity, entityId, entityLabel }) {
  const { user } = useUser();
  const { enabled } = useFeatureFlag('ai_features');
  const [panelOpen, setPanelOpen] = useState(false);

  const handleOpen = useCallback(() => {
    logger.debug('[BienBotTrigger] Opening panel', { entity, entityId });
    setPanelOpen(true);
  }, [entity, entityId]);

  const handleClose = useCallback(() => {
    setPanelOpen(false);
  }, []);

  // Do not render if user is not authenticated, flag is disabled, or required props are missing
  if (!user || !enabled || !entity || !entityId || !entityLabel) {
    return null;
  }

  const invokeContext = { entity, id: entityId, label: entityLabel };

  return (
    <>
      {!panelOpen && (
        <button
          type="button"
          className={styles.fab}
          onClick={handleOpen}
          aria-label={`Open BienBot assistant for ${entityLabel}`}
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
        />
      )}
    </>
  );
}

BienBotTrigger.propTypes = {
  entity: PropTypes.oneOf(['destination', 'experience', 'plan', 'plan_item', 'user']).isRequired,
  entityId: PropTypes.string.isRequired,
  entityLabel: PropTypes.string.isRequired
};

/**
 * Lazy wrapper for BienBotPanel — avoids loading the panel (and its
 * heavy useBienBot hook + SSE machinery) until the user actually opens it.
 */
function BienBotPanelLazy({ open, onClose, invokeContext }) {
  // BienBotPanel is a sibling task (88a3.12); lazy-import so the trigger
  // can ship independently. When the panel module doesn't exist yet,
  // the dynamic import will fail gracefully.
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

  if (loadError) {
    return null;
  }

  if (!Panel) {
    return null;
  }

  return <Panel open={open} onClose={onClose} invokeContext={invokeContext} />;
}

BienBotPanelLazy.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  invokeContext: PropTypes.shape({
    entity: PropTypes.string.isRequired,
    id: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired
  }).isRequired
};

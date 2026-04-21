/**
 * BienBotTrigger — Floating action button that opens BienBotPanel.
 *
 * Renders globally for authenticated users. Users with the `ai_features`
 * flag see the full chat experience (smiley icon); users without it see
 * a notification-only bell icon.
 *
 * When notifications exist, a badge appears on the FAB in both modes.
 *
 * @module components/BienBotTrigger
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { FaBell } from 'react-icons/fa';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';
import { useUser } from '../../contexts/UserContext';
import { useData } from '../../contexts/DataContext';
import { isSuperAdmin } from '../../utilities/permissions';
import useRouteContext from '../../hooks/useRouteContext';
import { useNavigationContext } from '../../contexts/NavigationContext';
import { subscribeToEvent } from '../../utilities/event-bus';
import { openWithAnalysis } from '../../hooks/useBienBot';
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
 * @param {Array} [props.notifications] - Notification activities
 * @param {Array} [props.unseenNotificationIds] - IDs of unseen notifications
 * @param {Function} [props.onMarkNotificationsSeen] - Callback to mark notification IDs as seen
 */
export default function BienBotTrigger({
  entity,
  entityId,
  entityLabel,
  contextDescription,
  notifications = [],
  unseenNotificationIds = [],
  onMarkNotificationsSeen
} = {}) {
  const { user } = useUser();
  const { getExperience, getPlan, getDestination } = useData();
  const { enabled: hasAI } = useFeatureFlag('ai_features');
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelMounted, setPanelMounted] = useState(false);
  const [panelLoading, setPanelLoading] = useState(false);
  const [initialMessage, setInitialMessage] = useState(null);
  const [initialSessionId, setInitialSessionId] = useState(null);
  const [analysisSuggestions, setAnalysisSuggestions] = useState(null);
  const [invokeContextOverride, setInvokeContextOverride] = useState(null);
  const [greetingLoading, setGreetingLoading] = useState(false);

  const isAdmin = user && isSuperAdmin(user);
  const hasChatAccess = hasAI || isAdmin;
  const unseenCount = unseenNotificationIds.length;

  // Route-based context detection
  const { invokeContext: routeContext, currentView, isEntityView } = useRouteContext();

  // Navigation schema — lean breadcrumb of entity IDs for BienBot context seeding
  const { navigationSchema } = useNavigationContext();

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

  // Subscribe to bienbot:context_updated — emitted when a disambiguation action
  // (select_plan, select_destination) auto-executes and focuses a new entity.
  // Only react to events flagged fromDisambiguation=true to avoid reacting to
  // reconciliation-sourced updates that would cause a spurious ContextSwitchPrompt.
  useEffect(() => {
    if (!hasChatAccess) return;
    const unsub = subscribeToEvent('bienbot:context_updated', (event) => {
      if (!event.fromDisambiguation) return;
      const { entity: updatedEntity, entityId: updatedEntityId, experienceId } = event;
      if (!updatedEntity || !updatedEntityId) return;

      let label = null;
      if (updatedEntity === 'plan') {
        // Derive a human-readable label from DataContext if possible
        const plan = getPlan(updatedEntityId);
        const expId = experienceId || plan?.experience?._id?.toString() || plan?.experience;
        const exp = expId ? getExperience(typeof expId === 'string' ? expId : expId.toString()) : null;
        label = exp?.name ? `your plan for ${exp.name}` : 'your selected plan';
      } else if (updatedEntity === 'destination') {
        const dest = getDestination(updatedEntityId);
        label = dest?.name || 'the selected destination';
      }

      if (label) {
        logger.debug('[BienBotTrigger] Context updated by disambiguation action', { entity: updatedEntity, entityId: updatedEntityId, label });
        setInvokeContextOverride({ entity: updatedEntity, id: updatedEntityId, label });
      }
    });
    return unsub;
  }, [hasChatAccess, getExperience, getPlan, getDestination]);

  // Subscribe to bienbot:open events (e.g. from post-plan toasts)
  useEffect(() => {
    if (!hasChatAccess) return;
    const unsub = subscribeToEvent('bienbot:open', (event) => {
      const msg = event.initialMessage || null;
      const sid = event.bienbotSessionId || null;
      const suggestions = event.analysisSuggestions || null;
      logger.debug('[BienBotTrigger] Received bienbot:open event', { hasMessage: !!msg, hasSessionId: !!sid, hasSuggestions: !!suggestions });
      setInitialMessage(msg);
      setInitialSessionId(sid);
      setAnalysisSuggestions(suggestions);
      // When the analysis was run for a specific entity (e.g. plan_item), override
      // the route-based invokeContext so the backend session is scoped to that entity.
      if (suggestions?.entityId && suggestions?.entity) {
        setInvokeContextOverride({
          entity: suggestions.entity,
          id: suggestions.entityId,
          label: suggestions.entityLabel || suggestions.entity,
        });
      } else {
        setInvokeContextOverride(null);
      }
      setPanelMounted(true);
      setPanelLoading(true);
      setPanelOpen(true);
    });
    return unsub;
  }, [hasChatAccess]);

  const handleOpen = useCallback(async () => {
    const ctx = invokeContext || {};
    logger.debug('[BienBotTrigger] Opening panel', { entity: ctx.entity, entityId: ctx.id, currentView, hasChatAccess });
    if (!isEntityView && hasChatAccess && user?._id) {
      // Non-entity view: trigger greeting analysis so BienBot opens with context
      setGreetingLoading(true);
      try {
        await openWithAnalysis('user', user._id.toString(), 'Your Travel Plans');
      } catch (err) {
        logger.error('[BienBotTrigger] Greeting analysis failed', { error: err.message });
        // Fall back to plain open on error
        setPanelMounted(true);
        setPanelLoading(true);
        setPanelOpen(true);
      } finally {
        setGreetingLoading(false);
      }
      return;
    }
    setPanelMounted(true);
    setPanelLoading(true);
    setPanelOpen(true);
  }, [invokeContext, currentView, hasChatAccess, isEntityView, user?._id]);

  const handleClose = useCallback(() => {
    setPanelOpen(false);
    setInitialMessage(null);
    setInitialSessionId(null);
    setAnalysisSuggestions(null);
    setInvokeContextOverride(null);
  }, []);

  const clearAnalysisSuggestions = useCallback(() => {
    setAnalysisSuggestions(null);
  }, []);

  // Do not render if user is not authenticated
  if (!user) {
    return null;
  }

  const ariaLabel = hasChatAccess
    ? (invokeContext?.label
      ? `Open BienBot assistant for ${invokeContext.label}`
      : 'Open BienBot assistant')
    : (unseenCount > 0
      ? `${unseenCount} new notification${unseenCount !== 1 ? 's' : ''}`
      : 'Notifications');

  // Render FAB and Panel via portal to document.body so they always sit above
  // any intervening stacking context (e.g. fullscreen modals with z-index 1050).
  //
  // The aria-live="off" attribute on the wrapper div exempts this portal from
  // @zag-js/aria-hidden's inertOthers() call, which Chakra UI Dialog uses when
  // trapFocus=true. Without it, Chakra sets `inert` on all document.body siblings
  // of the dialog portal — including BienBot — making it unclickable. The
  // aria-live check in @zag-js/aria-hidden's isIgnoredNode() skips these nodes.
  // aria-live="off" is semantically neutral (it's the browser default for all
  // elements) so this causes no accessibility regressions.
  return createPortal(
    <div aria-live="off">
      {(!panelOpen || panelLoading) && (
        <button
          type="button"
          className={`${styles.fab} ${!hasChatAccess ? styles.fabNotification : ''}`}
          onClick={handleOpen}
          disabled={greetingLoading || panelLoading}
          aria-busy={greetingLoading || panelLoading}
          aria-label={greetingLoading || panelLoading ? 'Loading BienBot…' : ariaLabel}
        >
          <span className={styles.fabIcon} aria-hidden="true">
            {greetingLoading || panelLoading ? (
              <span className={styles.spinner} />
            ) : hasChatAccess ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="currentColor" />
                <path d="M9 9.5a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5zM15 9.5a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5z" fill="currentColor" />
                <path d="M12 17.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" fill="currentColor" />
              </svg>
            ) : (
              <FaBell size={20} />
            )}
          </span>

          {/* Notification badge */}
          {unseenCount > 0 && !greetingLoading && !panelLoading && (
            <span className={styles.badge} aria-hidden="true">
              {unseenCount > 99 ? '99+' : unseenCount}
            </span>
          )}
        </button>
      )}

      {panelMounted && (
        <BienBotPanelLazy
          open={panelOpen}
          onClose={handleClose}
          onLoaded={() => setPanelLoading(false)}
          invokeContext={invokeContextOverride || invokeContext}
          baseInvokeContext={invokeContext}
          navigationSchema={navigationSchema}
          currentView={currentView}
          isEntityView={isEntityView}
          notificationOnly={!hasChatAccess}
          notifications={notifications}
          unseenNotificationIds={unseenNotificationIds}
          onMarkNotificationsSeen={onMarkNotificationsSeen}
          initialMessage={initialMessage}
          initialSessionId={initialSessionId}
          analysisSuggestions={analysisSuggestions}
          clearAnalysisSuggestions={clearAnalysisSuggestions}
        />
      )}
    </div>,
    document.body
  );
}

BienBotTrigger.propTypes = {
  entity: PropTypes.oneOf(['destination', 'experience', 'plan', 'plan_item', 'user']),
  entityId: PropTypes.string,
  entityLabel: PropTypes.string,
  contextDescription: PropTypes.string,
  notifications: PropTypes.array,
  unseenNotificationIds: PropTypes.array,
  onMarkNotificationsSeen: PropTypes.func
};

/**
 * Lazy wrapper for BienBotPanel — avoids loading the panel (and its
 * heavy useBienBot hook + SSE machinery) until the user actually opens it.
 */
function BienBotPanelLazy({
  open,
  onClose,
  onLoaded,
  invokeContext,
  navigationSchema,
  currentView,
  isEntityView,
  notificationOnly,
  notifications,
  unseenNotificationIds,
  onMarkNotificationsSeen,
  initialMessage,
  initialSessionId,
  analysisSuggestions,
  clearAnalysisSuggestions
}) {
  const [Panel, setPanel] = useState(null);
  const [loadError, setLoadError] = useState(false);

  React.useEffect(() => {
    let cancelled = false;
    import('../BienBotPanel/BienBotPanel')
      .then(mod => {
        if (!cancelled) {
          setPanel(() => mod.default);
          onLoaded?.();
        }
      })
      .catch(err => {
        logger.error('[BienBotTrigger] Failed to load BienBotPanel', { error: err.message });
        if (!cancelled) {
          setLoadError(true);
          onLoaded?.();
        }
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
      navigationSchema={navigationSchema}
      currentView={currentView}
      isEntityView={isEntityView}
      notificationOnly={notificationOnly}
      notifications={notifications}
      unseenNotificationIds={unseenNotificationIds}
      onMarkNotificationsSeen={onMarkNotificationsSeen}
      initialMessage={initialMessage}
      initialSessionId={initialSessionId}
      analysisSuggestions={analysisSuggestions}
      clearAnalysisSuggestions={clearAnalysisSuggestions}
    />
  );
}

BienBotPanelLazy.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onLoaded: PropTypes.func,
  invokeContext: PropTypes.shape({
    entity: PropTypes.string.isRequired,
    id: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    contextDescription: PropTypes.string
  }),
  currentView: PropTypes.string,
  isEntityView: PropTypes.bool,
  notificationOnly: PropTypes.bool,
  notifications: PropTypes.array,
  unseenNotificationIds: PropTypes.array,
  onMarkNotificationsSeen: PropTypes.func,
  initialMessage: PropTypes.string,
  analysisSuggestions: PropTypes.shape({
    entity: PropTypes.string,
    entityLabel: PropTypes.string,
    suggestions: PropTypes.arrayOf(PropTypes.shape({
      type: PropTypes.string,
      message: PropTypes.string,
    })),
  }),
  clearAnalysisSuggestions: PropTypes.func,
};

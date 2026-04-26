import { useState, useRef, useCallback } from 'react';
import { broadcastEvent } from '../../utilities/event-bus';
import { getNavigationUrlForResult } from '../../utilities/bienbot-suggestions';
import { logger } from '../../utilities/logger';

/**
 * useExecuteAction — coordinates BienBot pending-action execution.
 *
 * Responsibilities:
 *  - Lookup the action by id and route navigate_to_entity client-side without server call
 *  - Cancel sibling select_plan / select_destination actions when one is picked
 *  - Fire optimistic events via broadcastOptimistic before the server call
 *  - Call executeActions and surface the result as a feedback message
 *  - Auto-navigate to newly created entities
 *  - Re-emit entity events on the next tick so the destination route's freshly-mounted
 *    components catch them
 *  - Append structured-content enrichment and any follow-up assistant message
 *
 * @param {Object} deps
 * @param {Array}    deps.pendingActions
 * @param {Function} deps.executeActions       - executeActions([actionId]) → Promise<result>
 * @param {Function} deps.cancelAction         - cancelAction(actionId) → Promise<void>
 * @param {Function} deps.navigate             - react-router-dom navigate
 * @param {Function} deps.onClose              - parent onClose callback (for navigate_to_entity)
 * @param {Function} deps.broadcastOptimistic  - (action, userId) => void
 * @param {Function} deps.appendStructuredContent
 * @param {Function} deps.appendMessage
 * @param {string}   [deps.userId]
 * @returns {{ handleExecuteAction: (actionId: string) => Promise<void>, executingActionId: string | null }}
 */
export function useExecuteAction({
  pendingActions,
  executeActions,
  cancelAction,
  navigate,
  onClose,
  broadcastOptimistic,
  appendStructuredContent,
  appendMessage,
  userId,
}) {
  const [executingActionId, setExecutingActionId] = useState(null);
  const executingActionRef = useRef(null);

  const handleExecuteAction = useCallback(
    async (actionId) => {
      logger.debug('[BienBotPanel] Executing action', { actionId });

      // Guard against rapid double-clicks: state updates are async so we
      // use a ref to prevent re-entry before the disabled prop propagates.
      if (executingActionRef.current === actionId) return;
      executingActionRef.current = actionId;

      // Check if it's a navigate action (client-only, no server call)
      const action = pendingActions.find(a => (a._id || a.id) === actionId);
      if (action && action.type === 'navigate_to_entity') {
        const url = action.payload?.url;
        // Validate URL contains real IDs, not LLM placeholders like <unknown> or <experienceId>
        if (url && !/<[^>]+>/.test(url)) {
          navigate(url);
          cancelAction(actionId);
          onClose();
          executingActionRef.current = null;
          return;
        }
        // Bad URL — cancel without navigating
        cancelAction(actionId);
        executingActionRef.current = null;
        return;
      }

      // For select_plan, cancel all other select_plan actions (user picked one)
      if (action && action.type === 'select_plan') {
        const otherSelectPlans = pendingActions.filter(
          a => a.type === 'select_plan' && (a._id || a.id) !== actionId
        );
        for (const other of otherSelectPlans) {
          cancelAction(other._id || other.id);
        }
      }

      // For select_destination, cancel all other select_destination actions (user picked one)
      if (action && action.type === 'select_destination') {
        const otherSelectDestinations = pendingActions.filter(
          a => a.type === 'select_destination' && (a._id || a.id) !== actionId
        );
        for (const other of otherSelectDestinations) {
          cancelAction(other._id || other.id);
        }
      }

      // Show executing state on the action card
      setExecutingActionId(actionId);

      // ─── Optimistic UI updates ──────────────────────────────────────────────
      // Fire BEFORE the API call so DOM elements already on screen reflect the
      // change instantly — same pattern as the manual UI interactions.
      // All events are flagged _optimistic:true. There is no rollback: if the
      // server call fails the stale optimistic state persists until the next
      // data refresh (acceptable for the BienBot confirmed-action flow).
      //
      // Strategy by action category:
      //  • Plan item changes  → plan:operation (UPDATE_ITEM / DELETE_ITEM via
      //    usePlanManagement's CRDT handler) + plan:item:updated for the open modal
      //  • Plan-level deletes → plan:deleted (direct state removal)
      //  • Plan-level updates → plan:operation UPDATE_PLAN / REORDER_ITEMS
      //  • Completion toggles → plan:item:completed / plan:item:uncompleted
      //    (dedicated direct-patch handler in usePlanManagement)
      //  • Social follows     → follow:created / follow:deleted / follow:request:accepted
      //  • Actions that need the full server response to construct a meaningful
      //    optimistic state (create_*, sync_plan, costs, notes/details) are skipped.
      broadcastOptimistic(action, userId);

      const result = await executeActions([actionId]);

      setExecutingActionId(null);
      // On success the action is removed from pendingActions and the card
      // disappears on the next render — leave the ref set so any click that
      // snuck in while the fetch was in-flight (already queued as a macrotask)
      // is still blocked. On failure the card stays visible and the user must
      // be able to retry, so we clear the ref only then.
      if (!result) {
        executingActionRef.current = null;
      }

      // Build a feedback message summarizing what happened
      if (result?.results) {
        const feedbackLines = [];
        for (const actionResult of result.results) {
          if (actionResult.success) {
            if (actionResult.type === 'create_plan') {
              const expName = actionResult.result?.experience?.name || '';
              const itemCount = actionResult.result?.plan?.length || 0;
              feedbackLines.push(
                `✅ Plan created${expName ? ` for ${expName}` : ''}${itemCount > 0 ? ` with ${itemCount} item${itemCount !== 1 ? 's' : ''}` : ''}. Taking you there now…`
              );
            } else if (actionResult.type === 'update_plan_item') {
              // For plan item updates, summarize what changed
              const payload = action?.payload || {};
              const changes = [];
              if (payload.scheduled_date) changes.push('scheduled date');
              if (payload.scheduled_time) changes.push('scheduled time');
              if (payload.text) changes.push('description');
              if (payload.cost !== undefined) changes.push('cost');
              if (payload.activity_type) changes.push('activity type');
              if (payload.complete !== undefined) changes.push(payload.complete ? 'marked complete' : 'marked incomplete');
              if (payload.location) changes.push('location');
              const summary = changes.length > 0 ? changes.join(', ') : 'details';
              feedbackLines.push(`✅ Plan item updated: ${summary}`);
            } else if (actionResult.type === 'mark_plan_item_complete' || actionResult.type === 'mark_plan_item_incomplete') {
              const isComplete = actionResult.type === 'mark_plan_item_complete';
              const itemPayload = action?.payload || {};
              const itemIdStr = itemPayload.item_id?.toString ? itemPayload.item_id.toString() : itemPayload.item_id;
              const planItems = Array.isArray(actionResult.result?.plan) ? actionResult.result.plan : [];
              const matchedItem = planItems.find(i => (i._id?.toString ? i._id.toString() : i._id) === itemIdStr);
              const itemName = matchedItem?.text || action?.description || '';
              feedbackLines.push(isComplete
                ? `✅ ${itemName ? `"${itemName}" marked complete` : 'Plan item marked complete'}`
                : `✅ ${itemName ? `"${itemName}" marked incomplete` : 'Plan item marked incomplete'}`
              );
            } else {
              const entityName = actionResult.result?.name || actionResult.result?.title || actionResult.result?.content || '';
              const rawLabel = (actionResult.type || '').replace(/_/g, ' ');
              const typeLabel = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1);
              feedbackLines.push(`✅ ${typeLabel}${entityName ? `: ${entityName}` : ''}`);
            }
          } else {
            const rawLabel = (actionResult.type || '').replace(/_/g, ' ');
            const typeLabel = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1);
            feedbackLines.push(`❌ ${typeLabel}: ${actionResult.error || 'failed'}`);
          }
        }
        if (feedbackLines.length > 0) {
          appendMessage({
            _id: `exec-result-${Date.now()}`,
            role: 'assistant',
            content: feedbackLines.join('\n'),
            createdAt: new Date().toISOString(),
            isActionResult: true
          });
        }

        // Auto-navigate to newly created entities (panel stays open)
        let navigated = false;
        for (const actionResult of result.results) {
          const navUrl = getNavigationUrlForResult(actionResult);
          if (navUrl) {
            navigate(navUrl);
            navigated = true;
            break; // Only navigate once
          }
        }

        // Re-emit entity events after navigation so that page components
        // that mount on the new route can pick them up (they may have missed
        // the initial broadcast fired before navigate() was called).
        if (navigated && result.results) {
          setTimeout(() => {
            try {
              for (const actionResult of result.results) {
                if (!actionResult.success) continue;
                const entity = actionResult.result || actionResult.entity || actionResult.data;
                if (!entity) continue;
                switch (actionResult.type) {
                  case 'create_plan':
                    broadcastEvent('plan:created', {
                      plan: entity,
                      planId: entity._id,
                      experienceId: entity.experience?._id || entity.experience,
                      version: Date.now()
                    });
                    break;
                  case 'update_plan':
                  case 'add_plan_items':
                  case 'sync_plan':
                    broadcastEvent('plan:updated', {
                      plan: entity,
                      planId: entity._id || actionResult.planId,
                      version: Date.now()
                    });
                    break;
                  case 'create_experience':
                    broadcastEvent('experience:created', { experience: entity, experienceId: entity._id });
                    break;
                  case 'update_experience':
                    broadcastEvent('experience:updated', { experience: entity, experienceId: entity._id });
                    break;
                  case 'create_destination':
                    broadcastEvent('destination:created', { destination: entity, destinationId: entity._id });
                    break;
                  case 'update_destination':
                    broadcastEvent('destination:updated', { destination: entity, destinationId: entity._id });
                    break;
                  default:
                    break;
                }
              }
            } catch (e) { /* silently ignore */ }
          }, 0);
        }
      }

      // Contextual enrichment: suggestions/tips/photos after entity creation
      if (result?.enrichment) {
        appendStructuredContent(result.enrichment);
      }

      // Post-execution follow-up: LLM "what's next?" message with plan items context
      if (result?.followUpMessage) {
        appendMessage({
          _id: `exec-followup-${Date.now()}`,
          role: 'assistant',
          content: result.followUpMessage,
          createdAt: new Date().toISOString()
        });
      }
    },
    [
      executeActions,
      pendingActions,
      cancelAction,
      navigate,
      appendStructuredContent,
      appendMessage,
      onClose,
      broadcastOptimistic,
      userId,
    ]
  );

  return { handleExecuteAction, executingActionId };
}

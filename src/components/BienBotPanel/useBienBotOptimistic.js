import { useCallback } from 'react';
import { broadcastEvent } from '../../utilities/event-bus';
import { OperationType } from '../../utilities/plan-operations';

/**
 * Returns a `broadcastOptimistic(action, userId)` function that emits the
 * optimistic events for a BienBot action *before* the server call returns.
 * Each action type maps to one or more events compatible with usePlanManagement
 * and the related modals.
 *
 * @returns {(action: Object, userId: string|undefined) => void}
 */
export function useBienBotOptimistic() {
  return useCallback((action, userId) => {
    if (!action) return;
    const p = action.payload || {};
    const sid = (v) => (v?.toString ? v.toString() : v) ?? null;
    const now = Date.now();
    // Build a minimal operation object compatible with usePlanManagement's
    // plan:operation handler (no sessionId needed — dedup uses operation.id).
    const makePlanOp = (type, payload) => ({
      id: `bienbot_op_${now}_${Math.random().toString(36).substring(2, 6)}`,
      type,
      payload,
      vectorClock: {},
      timestamp: now
    });

    switch (action.type) {
      // ── Completion toggle ──────────────────────────────────────────────
      case 'mark_plan_item_complete':
      case 'mark_plan_item_incomplete': {
        const isComplete = action.type === 'mark_plan_item_complete';
        const planIdStr = sid(p.plan_id);
        const itemIdStr = sid(p.item_id);
        if (planIdStr && itemIdStr) {
          broadcastEvent(isComplete ? 'plan:item:completed' : 'plan:item:uncompleted', {
            planId: planIdStr,
            itemId: itemIdStr,
            planItemId: itemIdStr,
            action: isComplete ? 'item_completed' : 'item_uncompleted',
            _optimistic: true,
            version: now
          });
        }
        break;
      }

      // ── Plan item field update ─────────────────────────────────────────
      case 'update_plan_item': {
        const planIdStr = sid(p.plan_id);
        const itemIdStr = sid(p.item_id);
        if (planIdStr && itemIdStr) {
          const changes = {};
          if (p.text !== undefined) changes.text = p.text;
          if (p.complete !== undefined) changes.complete = p.complete;
          if (p.scheduled_date !== undefined) changes.scheduled_date = p.scheduled_date;
          if (p.scheduled_time !== undefined) changes.scheduled_time = p.scheduled_time;
          if (p.cost !== undefined) changes.cost_estimate = p.cost;
          if (p.cost_estimate !== undefined) changes.cost_estimate = p.cost_estimate;
          if (p.activity_type !== undefined) changes.activity_type = p.activity_type;
          if (p.location !== undefined) changes.location = p.location;
          if (p.url !== undefined) changes.url = p.url;
          if (Object.keys(changes).length > 0) {
            // Patch the plan items list immediately via CRDT operation
            broadcastEvent('plan:operation', {
              planId: planIdStr,
              operation: makePlanOp(OperationType.UPDATE_ITEM, { itemId: itemIdStr, changes })
            });
            // Also update the open modal's selected item
            broadcastEvent('plan:item:updated', {
              planId: planIdStr,
              itemId: itemIdStr,
              planItemId: itemIdStr,
              planItem: { _id: itemIdStr, ...changes },
              _optimistic: true,
              version: now
            });
            // Mirror completion state to the dedicated completion events so
            // the checkbox and progress bar update via the direct-patch handler
            if (changes.complete !== undefined) {
              broadcastEvent(changes.complete ? 'plan:item:completed' : 'plan:item:uncompleted', {
                planId: planIdStr,
                itemId: itemIdStr,
                planItemId: itemIdStr,
                action: changes.complete ? 'item_completed' : 'item_uncompleted',
                _optimistic: true,
                version: now
              });
            }
          }
        }
        break;
      }

      // ── Plan item deletion ─────────────────────────────────────────────
      case 'delete_plan_item': {
        const planIdStr = sid(p.plan_id);
        const itemIdStr = sid(p.item_id);
        if (planIdStr && itemIdStr) {
          broadcastEvent('plan:operation', {
            planId: planIdStr,
            operation: makePlanOp(OperationType.DELETE_ITEM, { itemId: itemIdStr })
          });
        }
        break;
      }

      // ── Plan deletion ──────────────────────────────────────────────────
      case 'delete_plan': {
        const planIdStr = sid(p.plan_id);
        if (planIdStr) {
          broadcastEvent('plan:deleted', {
            planId: planIdStr,
            _optimistic: true,
            version: now
          });
        }
        break;
      }

      // ── Plan metadata update (date, title, notes) ──────────────────────
      case 'update_plan': {
        const planIdStr = sid(p.plan_id);
        if (planIdStr) {
          const changes = {};
          if (p.planned_date !== undefined) changes.planned_date = p.planned_date;
          if (p.title !== undefined) changes.title = p.title;
          if (p.notes !== undefined) changes.notes = p.notes;
          if (Object.keys(changes).length > 0) {
            broadcastEvent('plan:operation', {
              planId: planIdStr,
              operation: makePlanOp(OperationType.UPDATE_PLAN, { changes })
            });
          }
        }
        break;
      }

      // ── Pin / unpin plan item ──────────────────────────────────────────
      case 'pin_plan_item':
      case 'unpin_plan_item': {
        const planIdStr = sid(p.plan_id);
        const itemIdStr = sid(p.item_id);
        if (planIdStr && itemIdStr) {
          const changes = { pinned: action.type === 'pin_plan_item' };
          broadcastEvent('plan:operation', {
            planId: planIdStr,
            operation: makePlanOp(OperationType.UPDATE_ITEM, { itemId: itemIdStr, changes })
          });
          broadcastEvent('plan:item:updated', {
            planId: planIdStr,
            itemId: itemIdStr,
            planItemId: itemIdStr,
            planItem: { _id: itemIdStr, ...changes },
            _optimistic: true,
            version: now
          });
        }
        break;
      }

      // ── Unassign plan item (null assignee is safe without user details) ─
      case 'unassign_plan_item': {
        const planIdStr = sid(p.plan_id);
        const itemIdStr = sid(p.item_id);
        if (planIdStr && itemIdStr) {
          const changes = { assignee: null };
          broadcastEvent('plan:operation', {
            planId: planIdStr,
            operation: makePlanOp(OperationType.UPDATE_ITEM, { itemId: itemIdStr, changes })
          });
          broadcastEvent('plan:item:updated', {
            planId: planIdStr,
            itemId: itemIdStr,
            planItemId: itemIdStr,
            planItem: { _id: itemIdStr, ...changes },
            _optimistic: true,
            version: now
          });
        }
        break;
      }

      // ── Reorder plan items ─────────────────────────────────────────────
      case 'reorder_plan_items': {
        const planIdStr = sid(p.plan_id);
        const itemIds = p.item_ids || [];
        if (planIdStr && itemIds.length > 0) {
          broadcastEvent('plan:operation', {
            planId: planIdStr,
            operation: makePlanOp(OperationType.REORDER_ITEMS, { itemIds })
          });
        }
        break;
      }

      // ── Follow user ────────────────────────────────────────────────────
      case 'follow_user': {
        const followingIdStr = sid(p.user_id);
        const followerIdStr = sid(userId);
        if (followingIdStr && followerIdStr) {
          broadcastEvent('follow:created', {
            followingId: followingIdStr,
            followerId: followerIdStr,
            userId: followerIdStr,
            _optimistic: true,
            version: now
          });
        }
        break;
      }

      // ── Unfollow user ──────────────────────────────────────────────────
      case 'unfollow_user': {
        const followingIdStr = sid(p.user_id);
        const followerIdStr = sid(userId);
        if (followingIdStr && followerIdStr) {
          broadcastEvent('follow:deleted', {
            followingId: followingIdStr,
            followerId: followerIdStr,
            userId: followerIdStr,
            _optimistic: true,
            version: now
          });
        }
        break;
      }

      // ── Accept follow request ──────────────────────────────────────────
      case 'accept_follow_request': {
        const followerIdStr = sid(p.follower_id);
        const followingIdStr = sid(userId);
        if (followerIdStr && followingIdStr) {
          broadcastEvent('follow:request:accepted', {
            followerId: followerIdStr,
            followingId: followingIdStr,
            _optimistic: true,
            version: now
          });
        }
        break;
      }

      // Actions that require the full server response to construct a
      // meaningful state update (create_*, sync_plan, notes/details,
      // costs, collaborator adds) are handled post-execution by
      // bienbot-api.js and need no pre-API optimistic event.
      default:
        break;
    }
  }, []);
}

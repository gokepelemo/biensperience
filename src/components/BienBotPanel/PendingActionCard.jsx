/**
 * PendingActionCard — Rich type-aware card for BienBot pending actions.
 *
 * Renders a preview of the action payload with Approve/Update buttons.
 * The Update button pre-fills the chat input with a correction prompt.
 *
 * @module components/BienBotPanel/PendingActionCard
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Button, Text } from '../design-system';
import styles from './BienBotPanel.module.css';

// ─── Action type display config ──────────────────────────────────────────────

const ACTION_CONFIG = {
  create_destination: { label: 'Create Destination', icon: '📍' },
  create_experience: { label: 'Create Experience', icon: '✨' },
  create_plan: { label: 'Create Plan', icon: '📋' },
  add_plan_items: { label: 'Add Plan Items', icon: '➕' },
  add_experience_plan_item: { label: 'Add Experience Item', icon: '➕' },
  update_plan_item: { label: 'Update Plan Item', icon: '✏️' },
  update_experience_plan_item: { label: 'Update Experience Item', icon: '✏️' },
  delete_plan_item: { label: 'Delete Plan Item', icon: '🗑️' },
  delete_experience_plan_item: { label: 'Delete Experience Item', icon: '🗑️' },
  update_experience: { label: 'Update Experience', icon: '✏️' },
  update_destination: { label: 'Update Destination', icon: '✏️' },
  update_plan: { label: 'Update Plan', icon: '✏️' },
  delete_plan: { label: 'Delete Plan', icon: '🗑️' },
  invite_collaborator: { label: 'Invite Collaborator', icon: '👤' },
  remove_collaborator: { label: 'Remove Collaborator', icon: '👤' },
  sync_plan: { label: 'Sync Plan', icon: '🔄' },
  add_plan_cost: { label: 'Add Cost', icon: '💰' },
  update_plan_cost: { label: 'Update Cost', icon: '💰' },
  delete_plan_cost: { label: 'Delete Cost', icon: '🗑️' },
  add_plan_item_note: { label: 'Add Note', icon: '📝' },
  add_plan_item_detail: { label: 'Add Detail', icon: '📎' },
  navigate_to_entity: { label: 'Navigate', icon: '🔗' },
  toggle_favorite_destination: { label: 'Toggle Favorite', icon: '❤️' },
  set_member_location: { label: 'Set Location', icon: '📍' },
  remove_member_location: { label: 'Remove Location', icon: '📍' },
  discover_content: { label: 'Discover Content', icon: '🔍' },
  workflow: { label: 'Workflow', icon: '⚡' }
};

// ─── Type-specific body renderers ────────────────────────────────────────────

function renderCreateDestination(payload) {
  return (
    <div className={styles.cardFields}>
      {payload.name && <div className={styles.cardFieldPrimary}>{payload.name}</div>}
      {payload.country && <Text size="sm" className={styles.cardFieldSecondary}>{payload.country}{payload.state ? `, ${payload.state}` : ''}</Text>}
    </div>
  );
}

function renderCreateExperience(payload) {
  return (
    <div className={styles.cardFields}>
      {payload.name && <div className={styles.cardFieldPrimary}>{payload.name}</div>}
      {payload.destination_name && <Text size="sm" className={styles.cardFieldSecondary}>{payload.destination_name}</Text>}
    </div>
  );
}

function renderCreatePlan(payload) {
  const date = payload.planned_date ? new Date(payload.planned_date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : null;
  return (
    <div className={styles.cardFields}>
      {payload.experience_name && <div className={styles.cardFieldPrimary}>{payload.experience_name}</div>}
      {date && <Text size="sm" className={styles.cardFieldSecondary}>Date: {date}</Text>}
      {payload.currency && <Text size="sm" className={styles.cardFieldSecondary}>Currency: {payload.currency}</Text>}
    </div>
  );
}

function renderAddItems(payload) {
  const items = payload.items || [];
  return (
    <div className={styles.cardFields}>
      {items.length > 0 && (
        <ul className={styles.cardItemList}>
          {items.slice(0, 5).map((item, i) => (
            <li key={i}><Text size="sm">{item.text || item.content || JSON.stringify(item)}</Text></li>
          ))}
          {items.length > 5 && <li><Text size="sm">...and {items.length - 5} more</Text></li>}
        </ul>
      )}
    </div>
  );
}

function renderUpdateItem(payload) {
  const changed = Object.entries(payload)
    .filter(([k]) => !['plan_id', 'item_id', 'plan_item_id', 'experience_id'].includes(k) && payload[k] != null)
    .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`);
  return (
    <div className={styles.cardFields}>
      {changed.length > 0 && changed.map((field, i) => (
        <Text key={i} size="sm" className={styles.cardFieldSecondary}>{field}</Text>
      ))}
    </div>
  );
}

function renderInviteCollaborator(payload) {
  return (
    <div className={styles.cardFields}>
      {(payload.user_email || payload.user_name || payload.user_id) && (
        <div className={styles.cardFieldPrimary}>{payload.user_email || payload.user_name || payload.user_id}</div>
      )}
      {payload.type && <Text size="sm" className={styles.cardFieldSecondary}>Role: {payload.type}</Text>}
    </div>
  );
}

function renderWorkflow(payload) {
  const steps = payload.steps || [];
  return (
    <div className={styles.cardFields}>
      <Text size="sm" className={styles.cardFieldSecondary}>{steps.length} step{steps.length !== 1 ? 's' : ''}</Text>
      {steps.slice(0, 4).map((step, i) => (
        <Text key={i} size="sm" className={styles.cardFieldSecondary}>
          {step.step || i + 1}. {step.description || step.type}
        </Text>
      ))}
      {steps.length > 4 && <Text size="sm" className={styles.cardFieldSecondary}>...and {steps.length - 4} more</Text>}
    </div>
  );
}

function renderDiscoverContent(payload) {
  const types = payload.activity_types || [];
  return (
    <div className={styles.cardFields}>
      {payload.destination_name && <div className={styles.cardFieldPrimary}>{payload.destination_name}</div>}
      {types.length > 0 && <Text size="sm" className={styles.cardFieldSecondary}>{types.join(', ')}</Text>}
    </div>
  );
}

function renderBody(type, payload) {
  switch (type) {
    case 'create_destination': return renderCreateDestination(payload);
    case 'create_experience': return renderCreateExperience(payload);
    case 'create_plan': return renderCreatePlan(payload);
    case 'add_plan_items':
    case 'add_experience_plan_item': return renderAddItems(payload);
    case 'update_plan_item':
    case 'update_experience_plan_item': return renderUpdateItem(payload);
    case 'invite_collaborator': return renderInviteCollaborator(payload);
    case 'discover_content': return renderDiscoverContent(payload);
    case 'workflow': return renderWorkflow(payload);
    default: return null;
  }
}

// ─── PendingActionCard ──────────────────────────────────────────────────────

export default function PendingActionCard({ action, onExecute, onUpdate, onCancel, disabled, executing }) {
  const actionId = action._id || action.id;
  const actionType = action.type || action.action_type || 'Action';
  const description = action.description || action.summary || actionType;
  const config = ACTION_CONFIG[actionType] || { label: actionType.replace(/_/g, ' '), icon: '⚡' };
  const isExecuting = executing === actionId;
  const payload = action.payload || {};
  const body = renderBody(actionType, payload);

  return (
    <div className={`${styles.pendingActionCard} ${isExecuting ? styles.actionCardExecuting : ''}`}>
      {/* Header */}
      <div className={styles.pendingCardHeader}>
        <span className={styles.pendingCardIcon} aria-hidden="true">{config.icon}</span>
        <span className={styles.pendingCardLabel}>{config.label}</span>
      </div>

      {/* Body — type-specific preview or fallback description */}
      <div className={styles.pendingCardBody}>
        {body || <Text size="sm">{description}</Text>}
      </div>

      {/* Footer — buttons */}
      <div className={styles.pendingCardFooter}>
        {isExecuting ? (
          <div className={styles.executingSpinner} aria-label="Executing action">
            <span /><span /><span />
          </div>
        ) : (
          <>
            <Button
              variant="gradient"
              size="sm"
              onClick={() => onExecute(actionId)}
              disabled={disabled}
            >
              Approve
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onUpdate(actionId, description)}
              disabled={disabled}
            >
              Update
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onCancel(actionId)}
              disabled={disabled}
            >
              Cancel
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

PendingActionCard.propTypes = {
  action: PropTypes.shape({
    _id: PropTypes.string,
    id: PropTypes.string,
    type: PropTypes.string,
    action_type: PropTypes.string,
    description: PropTypes.string,
    summary: PropTypes.string,
    payload: PropTypes.object
  }).isRequired,
  onExecute: PropTypes.func.isRequired,
  onUpdate: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  executing: PropTypes.string
};

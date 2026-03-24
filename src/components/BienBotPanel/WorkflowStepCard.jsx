/**
 * WorkflowStepCard — Step-by-step workflow confirmation UI.
 *
 * Replaces the old all-or-nothing ActionCard for workflow-type pending actions.
 * Users approve, skip, edit, or retry each step individually.
 *
 * @module components/BienBotPanel/WorkflowStepCard
 */

import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Button } from '../design-system';
import styles from './WorkflowStepCard.module.css';

/** Keys to hide from the payload display (internal / reference fields). */
const HIDDEN_PAYLOAD_KEYS = new Set(['steps']);

/** Returns true if a value looks like a $step_N reference. */
function isStepRef(val) {
  return typeof val === 'string' && /^\$step_\d+\./.test(val);
}

/**
 * Render a payload value as a human-readable string.
 */
function formatPayloadValue(val) {
  if (val == null) return '—';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (Array.isArray(val)) {
    if (val.length === 0) return '(none)';
    // For arrays of objects show count; for primitives join
    if (typeof val[0] === 'object') return `${val.length} item${val.length !== 1 ? 's' : ''}`;
    return val.join(', ');
  }
  if (typeof val === 'object') return JSON.stringify(val);
  const str = String(val);
  return str.length > 120 ? str.slice(0, 117) + '…' : str;
}

/**
 * Format a payload key into a human-readable label.
 */
function formatPayloadKey(key) {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Get visible payload entries — filters out hidden keys and step refs.
 */
function getVisiblePayload(payload) {
  if (!payload || typeof payload !== 'object') return [];
  return Object.entries(payload).filter(
    ([key, val]) => !HIDDEN_PAYLOAD_KEYS.has(key) && !isStepRef(val)
  );
}

/**
 * Status badge variant for a step.
 */
function badgeClass(status, isCurrent) {
  if (isCurrent && status === 'pending') return styles.stepBadgeCurrent;
  switch (status) {
    case 'completed':
      return styles.stepBadgeCompleted;
    case 'skipped':
      return styles.stepBadgeSkipped;
    case 'failed':
      return styles.stepBadgeFailed;
    case 'executing':
      return styles.stepBadgeCurrent;
    default:
      return styles.stepBadgePending;
  }
}

/**
 * Determine the "current" step index — the first pending step.
 */
function findCurrentIndex(steps) {
  return steps.findIndex(s => s.status === 'pending' || s.status === 'executing');
}

/**
 * Inline payload editor for a single step.
 */
function PayloadEditor({ payload, onSave, onCancel, disabled }) {
  const entries = getVisiblePayload(payload);
  const [draft, setDraft] = useState(() => {
    const obj = {};
    for (const [key, val] of entries) {
      obj[key] = typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val ?? '');
    }
    return obj;
  });

  const handleChange = useCallback((key, value) => {
    setDraft(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = useCallback(() => {
    // Reconstruct payload: merge draft edits back into original
    const edited = { ...payload };
    for (const [key] of entries) {
      const raw = draft[key];
      // Try to parse JSON for object/array fields
      try {
        const parsed = JSON.parse(raw);
        edited[key] = parsed;
      } catch {
        edited[key] = raw;
      }
    }
    onSave(edited);
  }, [draft, entries, payload, onSave]);

  if (entries.length === 0) return null;

  return (
    <div className={styles.payloadEditor}>
      {entries.map(([key]) => {
        const value = draft[key] ?? '';
        const isMultiline = value.length > 60 || value.includes('\n');
        return (
          <div key={key} className={styles.payloadEditorField}>
            <label className={styles.payloadEditorLabel}>{formatPayloadKey(key)}</label>
            {isMultiline ? (
              <textarea
                className={styles.payloadEditorInput}
                value={value}
                onChange={e => handleChange(key, e.target.value)}
                rows={3}
                disabled={disabled}
              />
            ) : (
              <input
                className={styles.payloadEditorInput}
                type="text"
                value={value}
                onChange={e => handleChange(key, e.target.value)}
                disabled={disabled}
              />
            )}
          </div>
        );
      })}
      <div className={styles.payloadEditorActions}>
        <Button variant="gradient" size="sm" onClick={handleSave} disabled={disabled}>
          Save &amp; Approve
        </Button>
        <Button variant="outline-secondary" size="sm" onClick={onCancel} disabled={disabled}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

PayloadEditor.propTypes = {
  payload: PropTypes.object,
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  disabled: PropTypes.bool
};

/**
 * WorkflowStepCard renders each exploded workflow step with approve / skip / edit
 * controls, payload details, and a progress bar.
 */
export default function WorkflowStepCard({
  workflowId,
  steps,
  onApprove,
  onSkip,
  onEdit,
  onCancelWorkflow,
  disabled
}) {
  const [editingStepId, setEditingStepId] = useState(null);

  const sortedSteps = [...steps].sort(
    (a, b) => (a.workflow_step ?? 0) - (b.workflow_step ?? 0)
  );

  const total = sortedSteps.length;
  const completedCount = sortedSteps.filter(
    s => s.status === 'completed' || s.status === 'skipped' || s.status === 'failed'
  ).length;
  const currentIdx = findCurrentIndex(sortedSteps);
  const progressPct = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  const allDone = completedCount === total;

  const handleEditSave = useCallback(
    (actionId, editedPayload) => {
      setEditingStepId(null);
      if (onEdit) onEdit(actionId, editedPayload);
    },
    [onEdit]
  );

  return (
    <div className={styles.workflowContainer}>
      {/* Header */}
      <div className={styles.workflowHeader}>
        <span className={styles.workflowTitle}>
          Workflow ({total} steps)
        </span>
        <span className={styles.workflowProgress}>
          {allDone ? 'Done' : `Step ${currentIdx >= 0 ? currentIdx + 1 : total} of ${total}`}
        </span>
      </div>

      {/* Progress bar */}
      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
      </div>

      {/* Steps */}
      <div className={styles.stepsList}>
        {sortedSteps.map((action, idx) => {
          const id = action._id || action.id;
          const status = action.status || 'pending';
          const isCurrent = idx === currentIdx;
          const stepNum = (action.workflow_step ?? idx) + 1;
          const isEditing = editingStepId === id;
          const visiblePayload = getVisiblePayload(action.payload);
          const showPayload = visiblePayload.length > 0 && status !== 'skipped';

          return (
            <div
              key={id}
              className={`${styles.step} ${isCurrent ? styles.stepCurrent : ''}`}
            >
              {/* Badge */}
              <span className={`${styles.stepBadge} ${badgeClass(status, isCurrent)}`}>
                {status === 'completed' ? '✓' : status === 'failed' ? '!' : stepNum}
              </span>

              {/* Body */}
              <div className={styles.stepBody}>
                <div className={styles.stepType}>{action.type}</div>
                <div className={styles.stepDescription}>
                  {action.description || action.type}
                </div>

                {/* Payload details */}
                {showPayload && !isEditing && (
                  <div className={styles.payloadSummary}>
                    {visiblePayload.map(([key, val]) => (
                      <div key={key} className={styles.payloadRow}>
                        <span className={styles.payloadKey}>{formatPayloadKey(key)}</span>
                        <span className={styles.payloadValue}>{formatPayloadValue(val)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Inline editor */}
                {isEditing && (
                  <PayloadEditor
                    payload={action.payload}
                    onSave={editedPayload => handleEditSave(id, editedPayload)}
                    onCancel={() => setEditingStepId(null)}
                    disabled={disabled}
                  />
                )}

                {/* Status labels */}
                {status === 'failed' && action.error_message && (
                  <div className={styles.stepError}>{action.error_message}</div>
                )}
                {status === 'skipped' && (
                  <div className={styles.stepStatusLabel}>Skipped</div>
                )}
                {status === 'completed' && (
                  <div className={styles.stepStatusLabel}>Completed</div>
                )}
                {status === 'executing' && (
                  <div className={styles.stepStatusLabel}>Executing…</div>
                )}
              </div>

              {/* Actions — approve / skip / edit for current pending step */}
              {isCurrent && status === 'pending' && !isEditing && (
                <div className={styles.stepActions}>
                  <Button
                    variant="success"
                    size="sm"
                    onClick={() => onApprove(id)}
                    disabled={disabled}
                  >
                    Approve
                  </Button>
                  {onEdit && visiblePayload.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingStepId(id)}
                      disabled={disabled}
                    >
                      Edit
                    </Button>
                  )}
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={() => onSkip(id)}
                    disabled={disabled}
                  >
                    Skip
                  </Button>
                </div>
              )}

              {/* Retry button for failed steps */}
              {status === 'failed' && (
                <div className={styles.stepActions}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onApprove(id)}
                    disabled={disabled}
                  >
                    Retry
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer — cancel entire workflow */}
      {!allDone && (
        <div className={styles.workflowFooter}>
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => onCancelWorkflow(workflowId)}
            disabled={disabled}
          >
            Cancel Workflow
          </Button>
        </div>
      )}
    </div>
  );
}

WorkflowStepCard.propTypes = {
  workflowId: PropTypes.string.isRequired,
  steps: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.string,
      id: PropTypes.string,
      type: PropTypes.string,
      description: PropTypes.string,
      status: PropTypes.string,
      payload: PropTypes.object,
      workflow_step: PropTypes.number,
      workflow_total: PropTypes.number,
      error_message: PropTypes.string
    })
  ).isRequired,
  onApprove: PropTypes.func.isRequired,
  onSkip: PropTypes.func.isRequired,
  onEdit: PropTypes.func,
  onCancelWorkflow: PropTypes.func.isRequired,
  disabled: PropTypes.bool
};

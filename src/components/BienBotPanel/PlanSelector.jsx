import { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import styles from './PlanSelector.module.css';

/**
 * Groups select_plan actions by destination and lets the user
 * pick one plan before confirming. Replaces the old per-card
 * execute-on-click PlanCard pattern.
 */
function PlanSelector({ actions, onExecute, onCancel, disabled }) {
  const [selectedId, setSelectedId] = useState(() => {
    // If only one action, preselect it
    return actions.length === 1 ? (actions[0]._id || actions[0].id) : null;
  });
  // Auto-execute if only one action
  useEffect(() => {
    if (actions.length === 1 && selectedId && !disabled) {
      onExecute(selectedId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions.length, selectedId, disabled]);

  // Group plans by destination_name (empty string → "Other")
  const groups = useMemo(() => {
    const map = new Map();
    for (const action of actions) {
      const dest = action.payload?.destination_name || 'Other';
      if (!map.has(dest)) map.set(dest, []);
      map.get(dest).push(action);
    }
    return [...map.entries()];
  }, [actions]);

  const handleConfirm = () => {
    if (selectedId) onExecute(selectedId);
  };

  const handleCancel = () => {
    if (actions.length > 0) {
      // Cancel all select_plan actions
      for (const action of actions) {
        onCancel(action._id || action.id);
      }
    }
  };

  // If only one plan, don't render the selector UI
  if (actions.length === 1) {
    // Optionally, could show a spinner or message, but just return null for now
    return null;
  }

  return (
    <div className={styles.selector}>
      <div className={styles.header}>Select a plan</div>

      {groups.map(([destination, plans]) => (
        <div key={destination} className={styles.group}>
          {groups.length > 1 && (
            <div className={styles.groupLabel}>
              {destination}
              <span className={styles.groupCount}>
                {plans.length} plan{plans.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}

          {plans.map((action) => {
            const actionId = action._id || action.id;
            const { experience_name, destination_name, planned_date, item_count } = action.payload || {};
            const dateStr = planned_date
              ? new Date(planned_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
              : null;
            const isSelected = selectedId === actionId;

            return (
              <button
                key={actionId}
                type="button"
                className={`${styles.card} ${isSelected ? styles.cardSelected : ''}`}
                onClick={() => setSelectedId(actionId)}
                disabled={disabled}
                aria-pressed={isSelected}
                aria-label={`Select plan: ${experience_name || 'Unnamed plan'}`}
              >
                <span className={styles.radio}>
                  {isSelected && <span className={styles.radioDot} />}
                </span>

                <div className={styles.cardInfo}>
                  <div className={styles.cardName}>{experience_name || 'Unnamed plan'}</div>
                  <div className={styles.cardMeta}>
                    {destination_name && groups.length <= 1 && <span>{destination_name}</span>}
                    {dateStr && <span>{dateStr}</span>}
                    {typeof item_count === 'number' && (
                      <span>{item_count} item{item_count !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ))}

      <div className={styles.footer}>
        <button
          type="button"
          className={styles.cancelBtn}
          onClick={handleCancel}
          disabled={disabled}
        >
          Cancel
        </button>
        <button
          type="button"
          className={styles.confirmBtn}
          onClick={handleConfirm}
          disabled={disabled || !selectedId}
        >
          Confirm
        </button>
      </div>
    </div>
  );
}

PlanSelector.propTypes = {
  actions: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.string,
      id: PropTypes.string,
      type: PropTypes.string,
      payload: PropTypes.shape({
        plan_id: PropTypes.string,
        experience_name: PropTypes.string,
        destination_name: PropTypes.string,
        planned_date: PropTypes.string,
        item_count: PropTypes.number
      })
    })
  ).isRequired,
  onExecute: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  disabled: PropTypes.bool
};

export default PlanSelector;

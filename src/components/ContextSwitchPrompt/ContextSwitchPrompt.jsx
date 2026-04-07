/**
 * ContextSwitchPrompt — Banner shown above the BienBot input when the user navigates
 * to a different entity while the panel is open. Gives them an explicit choice:
 *   • "Continue about [prev]" — dismiss the prompt, keep current session context
 *   • "Switch to [new]"       — call switchContext so BienBot refocuses
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Button } from '../design-system';
import styles from './ContextSwitchPrompt.module.css';

export default function ContextSwitchPrompt({
  prevEntityLabel,
  newEntityLabel,
  newEntityType,
  onSwitch,
  onStay,
}) {
  return (
    <div className={styles.banner} role="region" aria-label="Context switch prompt">
      <p className={styles.message}>
        You moved to <strong>{newEntityLabel}</strong>. Switch BienBot&apos;s focus?
      </p>
      <div className={styles.actions}>
        <Button
          variant="outline"
          size="sm"
          onClick={onStay}
          aria-label={`Continue about ${prevEntityLabel}`}
        >
          Continue about {prevEntityLabel}
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => onSwitch(newEntityType)}
          aria-label={`Switch BienBot to ${newEntityLabel}`}
        >
          Switch to {newEntityLabel}
        </Button>
      </div>
    </div>
  );
}

ContextSwitchPrompt.propTypes = {
  /** Label of the entity BienBot is currently focused on (previous entity) */
  prevEntityLabel: PropTypes.string.isRequired,
  /** Label of the newly navigated-to entity */
  newEntityLabel: PropTypes.string.isRequired,
  /** Entity type of the new entity (e.g. 'plan_item', 'experience') */
  newEntityType: PropTypes.string.isRequired,
  /** Called when the user clicks "Switch to [new]" */
  onSwitch: PropTypes.func.isRequired,
  /** Called when the user clicks "Continue about [prev]" */
  onStay: PropTypes.func.isRequired,
};

/**
 * Alert component to notify users about saved form data
 * Allows users to restore or discard previously saved form data
 */

import { useState, useEffect } from 'react';
import Alert from '../Alert/Alert';
import { getFormDataAge } from '../../utilities/form-persistence';
import { logger } from '../../utilities/logger';

/**
 * Format time duration in human-readable format
 * @param {number} ms - Milliseconds
 * @returns {string} Formatted duration
 */
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  } else if (hours > 0) {
    return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  } else {
    return 'just now';
  }
}

export default function RestoreFormDataAlert({ formId, userId = null, onRestore, onDiscard, show = true }) {
  const [age, setAge] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!formId || !show) {
      setAge(null);
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      const formAge = await getFormDataAge(formId, userId);
      if (!cancelled) {
        setAge(formAge);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [formId, show, userId]);

  if (!show || dismissed || age === null) {
    return null;
  }

  const handleRestore = () => {
    logger.info('User chose to restore form data', { formId });
    setDismissed(true);
    if (onRestore) {
      onRestore();
    }
  };

  const handleDiscard = () => {
    logger.info('User chose to discard form data', { formId });
    setDismissed(true);
    if (onDiscard) {
      onDiscard();
    }
  };

  return (
    <Alert
      type="info"
      dismissible={false}
      className="mb-3"
      actions={
        <>
          <button
            className="btn btn-sm btn-primary"
            onClick={handleRestore}
            aria-label="Restore saved form data"
          >
            Restore
          </button>
          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={handleDiscard}
            aria-label="Discard saved form data"
          >
            Discard
          </button>
        </>
      }
    >
      <div>
        <strong>Unsaved changes found</strong>
        <p className="mb-0">
          You have unsaved form data from {formatDuration(age)}. Would you like to restore it?
        </p>
      </div>
    </Alert>
  );
}

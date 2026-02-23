import { useState, useEffect } from 'react';
import { useUser } from '../../contexts/UserContext';
import { Button } from '../design-system';
import { getPlanPreview } from '../../utilities/plans-api';
import { logger } from '../../utilities/logger';
import { lang } from '../../lang.constants';
import styles from './PlanAccessDenied.module.scss';

/**
 * PlanAccessDenied — Shown when a user navigates to a plan they cannot access.
 *
 * - Authenticated users see plan preview info + "Request Access" button
 * - Unauthenticated users see plan preview info + "Sign in to Request Access" button
 *
 * @param {Object} props
 * @param {string} props.planId - The plan ID the user tried to access
 * @param {Function} props.onRequestAccess - Called with planId when user clicks request access
 * @param {Function} props.onSignIn - Called when unauthenticated user clicks sign in
 * @param {boolean} [props.requestSent] - Whether a request has already been submitted
 */
export default function PlanAccessDenied({ planId, onRequestAccess, onSignIn, requestSent = false }) {
  const { user } = useUser();
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!planId) return;
    setLoading(true);
    getPlanPreview(planId)
      .then(data => setPreview(data))
      .catch(err => {
        logger.warn('[PlanAccessDenied] Failed to load preview', { planId, error: err?.message });
        setPreview(null);
      })
      .finally(() => setLoading(false));
  }, [planId]);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.skeleton} />
      </div>
    );
  }

  const strings = lang.current.planAccess;

  const description = preview
    ? strings.descriptionWithPreview
        .replace('{ownerName}', preview.ownerFirstName)
        .replace('{experienceName}', preview.experienceName)
    : strings.descriptionGeneric;

  return (
    <div className={styles.container}>
      <div className={styles.iconContainer}>
        <span className={styles.icon} role="img" aria-label={strings.title}>
          🔒
        </span>
      </div>

      <h2 className={styles.title}>{strings.title}</h2>
      <p className={styles.description}>{description}</p>

      {requestSent ? (
        <p className={styles.requestSentMessage}>{strings.requestSent}</p>
      ) : (
        <div className={styles.actions}>
          {user ? (
            <Button
              variant="gradient"
              size="md"
              rounded
              onClick={() => onRequestAccess(planId)}
              className={styles.primaryButton}
            >
              {strings.requestAccessButton}
            </Button>
          ) : (
            <Button
              variant="gradient"
              size="md"
              rounded
              onClick={onSignIn}
              className={styles.primaryButton}
            >
              {strings.signInButton}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

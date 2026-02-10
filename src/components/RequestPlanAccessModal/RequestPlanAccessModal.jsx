import { useCallback, useEffect, useId, useState } from 'react';

import { Modal, FormGroup, FormLabel, FormControl, Alert } from '../design-system';

/**
 * Request plan access modal
 *
 * Migrated to Chakra UI via design-system abstraction (biensperience-51b3).
 * Uses design-system Modal which supports both Bootstrap and Chakra UI
 * via feature flag.
 *
 * @param {Object} props
 * @param {boolean} props.show
 * @param {Function} props.onClose
 * @param {string|null} props.planId
 * @param {Function} props.onSubmitRequest - async ({ planId, message }) => void
 */
export default function RequestPlanAccessModal({ show, onClose, planId, onSubmitRequest }) {
  const id = useId();
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!show) return;
    setError('');
    setSuccess(false);
    setMessage('');
  }, [show]);

  const handleSubmit = useCallback(async () => {
    if (success) {
      onClose();
      return;
    }
    if (!planId) return;

    try {
      setLoading(true);
      setError('');
      await onSubmitRequest({ planId, message });
      setSuccess(true);
    } catch (e) {
      setError(e?.message || 'Failed to submit access request.');
    } finally {
      setLoading(false);
    }
  }, [success, onClose, planId, onSubmitRequest, message]);

  const errorId = `${id}-error`;
  const descriptionId = `${id}-description`;
  const textareaId = `${id}-message`;

  return (
    <Modal
      show={show}
      onClose={onClose}
      onSubmit={handleSubmit}
      title="Request Access"
      submitText={success ? 'Close' : 'Send Request'}
      cancelText="Cancel"
      showCancelButton={!success}
      showSubmitButton
      disableSubmit={!planId || loading}
      loading={loading}
      submitVariant="primary"
      aria-describedby={!success ? descriptionId : undefined}
      submitButtonProps={{
        'aria-busy': loading,
      }}
    >
      <div aria-live="assertive" aria-atomic="true">
        {error && <Alert type="danger" message={error} id={errorId} role="alert" />}
      </div>
      {success && (
        <div role="status" aria-live="polite">
          <Alert
            type="success"
            message="Request sent. The plan owner will be notified."
          />
        </div>
      )}

      {!success && (
        <>
          <p id={descriptionId} style={{ marginBottom: 'var(--space-4)' }}>
            Add an optional message to help the plan owner understand why you need access.
          </p>

          <FormGroup>
            <FormLabel htmlFor={textareaId}>Message (optional)</FormLabel>
            <FormControl
              as="textarea"
              id={textareaId}
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={1000}
              placeholder="Example: I'm traveling with you and want to help update the plan."
              aria-describedby={error ? errorId : undefined}
              autoComplete="off"
            />
          </FormGroup>
        </>
      )}
    </Modal>
  );
}

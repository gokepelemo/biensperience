import { useEffect, useState } from 'react';

import Modal from '../Modal/Modal';
import Alert from '../Alert/Alert';
import { FormGroup, FormLabel, FormControl } from '../design-system';

/**
 * Request plan access modal
 *
 * @param {Object} props
 * @param {boolean} props.show
 * @param {Function} props.onClose
 * @param {string|null} props.planId
 * @param {Function} props.onSubmitRequest - async ({ planId, message }) => void
 */
export default function RequestPlanAccessModal({ show, onClose, planId, onSubmitRequest }) {
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

  const handleSubmit = async () => {
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
  };

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
    >
      {error && <Alert type="danger" message={error} />}
      {success && (
        <Alert
          type="success"
          message="Request sent. The plan owner will be notified."
        />
      )}

      {!success && (
        <>
          <p style={{ marginBottom: 'var(--space-4)' }}>
            Add an optional message to help the plan owner understand why you need access.
          </p>

          <FormGroup>
            <FormLabel htmlFor="requestAccessMessage">Message (optional)</FormLabel>
            <FormControl
              as="textarea"
              id="requestAccessMessage"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={1000}
              placeholder="Example: I'm traveling with you and want to help update the plan."
            />
          </FormGroup>
        </>
      )}
    </Modal>
  );
}

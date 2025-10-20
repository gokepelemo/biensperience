import { useState } from 'react';
import Modal from '../Modal/Modal';
import FormField from '../FormField/FormField';
import Alert from '../Alert/Alert';
import { requestPasswordReset } from '../../utilities/users-api';
import { handleError } from '../../utilities/error-handler';
import { lang } from '../../lang.constants';

export default function ForgotPasswordModal({ show, onClose }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await requestPasswordReset(email);
      setSuccess(true);
      setEmail('');
      // Auto-close after showing success message
      setTimeout(() => {
        onClose();
        setSuccess(false);
      }, 3000);
    } catch (err) {
      const errorMsg = handleError(err, { context: 'Request password reset' });
      setError(errorMsg || 'Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setError('');
    setSuccess(false);
    onClose();
  };

  return (
    <Modal
      show={show}
      onClose={handleClose}
      title="Reset Password"
      size="md"
    >
      {success ? (
        <Alert type="success" className="mb-0">
          <strong>Email Sent!</strong>
          <p className="mb-0 mt-2">
            If an account exists with this email address, you will receive a password reset link shortly.
            Please check your inbox (and spam folder).
          </p>
        </Alert>
      ) : (
        <form onSubmit={handleSubmit}>
          {error && (
            <Alert type="danger" message={error} className="mb-3" />
          )}

          <p className="text-muted mb-4">
            Enter your email address and we'll send you a link to reset your password.
          </p>

          <FormField
            name="email"
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your.email@example.com"
            required
            autoComplete="email"
            autoFocus
          />

          <div className="d-flex justify-content-end gap-2 mt-4">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleClose}
              disabled={loading}
            >
              {lang.en.button.cancel}
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !email}
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

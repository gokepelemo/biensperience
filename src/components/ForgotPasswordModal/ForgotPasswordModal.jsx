import { useState } from 'react';
import { Box, Text } from '@chakra-ui/react';
import { Modal, Alert } from '../design-system';
import FormField from '../FormField/FormField';
import { requestPasswordReset } from '../../utilities/users-api';
import { handleError } from '../../utilities/error-handler';
import { lang } from '../../lang.constants';

export default function ForgotPasswordModal({ show, onClose }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
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
      onSubmit={success ? undefined : handleSubmit}
      title={lang.current.modal.resetPassword}
      submitText="Send Reset Link"
      cancelText={lang.current.button.cancel}
      showCancelButton={!success}
      showSubmitButton={!success}
      disableSubmit={!email}
      loading={loading}
    >
      {success ? (
        <Box mb={0}>
          <Alert type="success">
            <Text as="strong">Email Sent!</Text>
            <Text as="p" mb={0} mt={2}>
              If an account exists with this email address, you will receive a password reset link shortly.
              Please check your inbox (and spam folder).
            </Text>
          </Alert>
        </Box>
      ) : (
        <Box
          as="form"
          display="block"
          css={{
            gridTemplateColumns: "unset !important",
            gap: "0 !important",
          }}
        >
          {error && (
            <Box mb={3}>
              <Alert type="danger" message={error} />
            </Box>
          )}

          <Text color="fg.muted" mb={4}>
            Enter your email address and we&apos;ll send you a link to reset your password.
          </Text>

          <FormField
            name="email"
            label={lang.current.aria.emailAddress}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={lang.current.placeholder.forgotPasswordEmail}
            required
            autoComplete="email"
            autoFocus
          />
        </Box>
      )}
    </Modal>
  );
}

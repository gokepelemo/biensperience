import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import Modal from '../Modal/Modal';
import { FaShieldAlt, FaRedo } from 'react-icons/fa';
import { Button } from 'react-bootstrap';
import Alert from '../Alert/Alert';
import styles from './TwoFactorAuthModal.module.scss';

/**
 * Two-Factor Authentication Modal Component
 *
 * Displays a 6-digit code input for two-factor authentication.
 * Includes auto-focus navigation between digits and resend functionality.
 *
 * @param {Object} props - Component props
 * @param {boolean} props.show - Whether the modal is visible
 * @param {Function} props.onClose - Function to close the modal
 * @param {Function} props.onVerify - Function called with the 6-digit code when verified
 * @param {Function} [props.onResend] - Optional function to resend the verification code
 * @param {string} [props.email] - User's email for display purposes
 * @param {boolean} [props.loading=false] - Whether verification is in progress
 * @param {string} [props.error] - Error message to display
 */
export default function TwoFactorAuthModal({
  show,
  onClose,
  onVerify,
  onResend,
  email,
  loading = false,
  error
}) {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef([]);

  // Reset code when modal opens
  useEffect(() => {
    if (show) {
      setCode(['', '', '', '', '', '']);
      // Focus first input after a short delay
      setTimeout(() => {
        if (inputRefs.current[0]) {
          inputRefs.current[0].focus();
        }
      }, 100);
    }
  }, [show]);

  // Handle resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleCodeChange = (index, value) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    // Handle backspace - move to previous input
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }

    // Handle paste
    if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      navigator.clipboard.readText().then((text) => {
        const digits = text.replace(/\D/g, '').slice(0, 6).split('');
        const newCode = [...code];
        digits.forEach((digit, i) => {
          if (i < 6) newCode[i] = digit;
        });
        setCode(newCode);
        // Focus last filled input or last input
        const lastFilledIndex = Math.min(digits.length - 1, 5);
        inputRefs.current[lastFilledIndex]?.focus();
      });
    }
  };

  const handleVerify = () => {
    const fullCode = code.join('');
    if (fullCode.length === 6 && onVerify) {
      onVerify(fullCode);
    }
  };

  const handleResend = () => {
    if (onResend && resendCooldown === 0) {
      onResend();
      setResendCooldown(60); // 60 second cooldown
    }
  };

  const isCodeComplete = code.every(digit => digit !== '');

  const customFooter = (
    <div className={styles.footerContent}>
      <Button
        variant="outline-secondary"
        onClick={handleResend}
        disabled={resendCooldown > 0 || loading}
        className={styles.resendButton}
      >
        <FaRedo className="me-2" />
        {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
      </Button>
      <Button
        variant="primary"
        onClick={handleVerify}
        disabled={!isCodeComplete || loading}
        style={{
          background: 'var(--gradient-primary)',
          border: 'none'
        }}
      >
        {loading ? 'Verifying...' : 'Verify Code'}
      </Button>
    </div>
  );

  return (
    <Modal
      show={show}
      onClose={onClose}
      title="Two-Factor Authentication"
      icon={<FaShieldAlt />}
      footer={customFooter}
    >
      <div className={styles.twoFactorContent}>
        <p className={styles.description}>
          Enter the 6-digit code from your authenticator app
          {email && (
            <span className={styles.emailHint}>
              {' '}or sent to <strong>{email}</strong>
            </span>
          )}
        </p>

        {error && (
          <Alert type="danger" message={error} className="mb-4" />
        )}

        <div className={styles.codeInputContainer}>
          {code.map((digit, index) => (
            <input
              key={index}
              ref={(el) => (inputRefs.current[index] = el)}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleCodeChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              className={styles.codeInput}
              disabled={loading}
              autoComplete="one-time-code"
            />
          ))}
        </div>

        <p className={styles.helpText}>
          Didn't receive a code? Check your spam folder or click "Resend Code" above.
        </p>
      </div>
    </Modal>
  );
}

TwoFactorAuthModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onVerify: PropTypes.func.isRequired,
  onResend: PropTypes.func,
  email: PropTypes.string,
  loading: PropTypes.bool,
  error: PropTypes.string
};

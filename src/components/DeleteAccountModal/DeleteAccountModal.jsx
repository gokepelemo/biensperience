import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Form } from 'react-bootstrap';
import Modal from '../Modal/Modal';
import Alert from '../Alert/Alert';
import Autocomplete from '../Autocomplete/Autocomplete';
import { FaExclamationTriangle, FaTrash, FaExchangeAlt, FaUser } from 'react-icons/fa';
import { deleteAccount, searchUsers } from '../../utilities/users-api';
import { useToast } from '../../contexts/ToastContext';
import { logger } from '../../utilities/logger';
import styles from './DeleteAccountModal.module.scss';

/**
 * DeleteAccountModal Component
 *
 * Allows users to delete their account with two options:
 * 1. Delete all data permanently
 * 2. Transfer all data to another user before deletion
 *
 * Requires password confirmation and typing "DELETE" to proceed.
 *
 * @param {Object} props - Component props
 * @param {boolean} props.show - Whether the modal is visible
 * @param {Function} props.onClose - Function to close the modal
 * @param {Object} props.user - Current user object
 * @param {Function} props.onSuccess - Callback after successful deletion
 */
export default function DeleteAccountModal({
  show,
  onClose,
  user,
  onSuccess
}) {
  const { error: showError } = useToast();

  // Form state
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [transferMode, setTransferMode] = useState(false);
  const [transferUser, setTransferUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1 = choose mode, 2 = confirm

  // Reset form when modal opens/closes
  useEffect(() => {
    if (show) {
      setPassword('');
      setConfirmText('');
      setTransferMode(false);
      setTransferUser(null);
      setSearchQuery('');
      setSearchResults([]);
      setStep(1);
    }
  }, [show]);

  // Search users for transfer
  const handleUserSearch = useCallback(async (query) => {
    setSearchQuery(query);
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      const results = await searchUsers(query);
      // Filter out current user from results
      const filtered = results.filter(u => u._id !== user?._id);
      setSearchResults(filtered);
    } catch (err) {
      logger.error('Error searching users', { error: err.message });
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [user?._id]);

  // Handle user selection for transfer
  const handleSelectUser = (selectedUser) => {
    setTransferUser(selectedUser);
    setSearchQuery(selectedUser?.name || '');
  };

  // Validation
  const isPasswordValid = password.length >= 3;
  const isConfirmValid = confirmText === 'DELETE';
  const isTransferValid = !transferMode || (transferMode && transferUser);
  const canSubmit = isPasswordValid && isConfirmValid && isTransferValid && !loading;

  // Handle form submission
  const handleSubmit = async () => {
    if (!canSubmit) return;

    setLoading(true);
    try {
      const result = await deleteAccount(user._id, {
        password,
        confirmDelete: confirmText,
        transferToUserId: transferMode ? transferUser?._id : undefined
      });

      if (result.success) {
        // Call success callback (typically logout and redirect)
        if (onSuccess) {
          onSuccess(result);
        }
        onClose();
      }
    } catch (err) {
      logger.error('Error deleting account', { error: err.message });
      showError(err.message || 'Failed to delete account. Please check your password and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Choose deletion mode
  const renderStep1 = () => (
    <div className={styles.stepContent}>
      <p className={styles.intro}>
        We're sorry to see you go. Please choose how you'd like to proceed with your account deletion.
      </p>

      <div className={styles.optionCards}>
        {/* Delete permanently option */}
        <button
          type="button"
          className={`${styles.optionCard} ${!transferMode ? styles.selected : ''}`}
          onClick={() => setTransferMode(false)}
        >
          <div className={styles.optionIcon}>
            <FaTrash />
          </div>
          <div className={styles.optionContent}>
            <h4>Delete Everything</h4>
            <p>Permanently delete your account and all associated data including experiences, plans, photos, and documents.</p>
          </div>
        </button>

        {/* Transfer data option */}
        <button
          type="button"
          className={`${styles.optionCard} ${transferMode ? styles.selected : ''}`}
          onClick={() => setTransferMode(true)}
        >
          <div className={styles.optionIcon}>
            <FaExchangeAlt />
          </div>
          <div className={styles.optionContent}>
            <h4>Transfer My Data</h4>
            <p>Transfer all your data to another user before deleting your account. They will become the new owner of your content.</p>
          </div>
        </button>
      </div>

      {/* User search for transfer mode */}
      {transferMode && (
        <div className={styles.transferSection}>
          <label className={styles.label}>
            <FaUser className={styles.labelIcon} />
            Transfer data to:
          </label>
          <Autocomplete
            placeholder="Search for a user by name or email..."
            items={searchResults}
            entityType="user"
            onSelect={handleSelectUser}
            onSearch={handleUserSearch}
            value={searchQuery}
            loading={searchLoading}
            emptyMessage="No users found"
            disableFilter={true}
          />
          {transferUser && (
            <div className={styles.selectedUser}>
              <span>Selected: </span>
              <strong>{transferUser.name}</strong>
              <span className={styles.email}>({transferUser.email})</span>
            </div>
          )}
        </div>
      )}

      <div className={styles.actions}>
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => setStep(2)}
          disabled={!isTransferValid}
        >
          Continue
        </button>
      </div>
    </div>
  );

  // Step 2: Confirm with password
  const renderStep2 = () => (
    <div className={styles.stepContent}>
      <Alert type="danger" className={styles.warningAlert}>
        <FaExclamationTriangle className={styles.alertIcon} />
        <span>This action cannot be undone!</span>
      </Alert>

      {transferMode && transferUser ? (
        <div className={styles.summary}>
          <p>
            Your account will be deleted and all your data will be transferred to{' '}
            <strong>{transferUser.name}</strong> ({transferUser.email}).
          </p>
          <p className={styles.summaryNote}>
            This includes: experiences, plans, photos, documents, destinations, and activity history.
          </p>
        </div>
      ) : (
        <div className={styles.summary}>
          <p>
            Your account and all associated data will be <strong>permanently deleted</strong>.
          </p>
          <p className={styles.summaryNote}>
            This includes: experiences, plans, photos, documents, destinations, activity history, and API tokens.
          </p>
        </div>
      )}

      <Form.Group className={styles.formGroup}>
        <Form.Label>Enter your password to confirm:</Form.Label>
        <Form.Control
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Your current password"
          autoComplete="current-password"
        />
      </Form.Group>

      <Form.Group className={styles.formGroup}>
        <Form.Label>Type <strong>DELETE</strong> to confirm:</Form.Label>
        <Form.Control
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
          placeholder="Type DELETE"
          autoComplete="off"
          className={confirmText && !isConfirmValid ? styles.invalid : ''}
        />
      </Form.Group>

      <div className={styles.actions}>
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={() => setStep(1)}
          disabled={loading}
        >
          Back
        </button>
        <button
          type="button"
          className="btn btn-danger"
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          {loading ? (
            'Deleting...'
          ) : (
            <>
              <FaTrash className={styles.buttonIcon} />
              {transferMode ? 'Transfer & Delete Account' : 'Delete Account Permanently'}
            </>
          )}
        </button>
      </div>
    </div>
  );

  // Build title
  const titleContent = (
    <span className={styles.title}>
      <FaExclamationTriangle className={styles.titleIcon} />
      Delete Account
    </span>
  );

  return (
    <Modal
      show={show}
      onClose={onClose}
      title={titleContent}
      size="lg"
      centered={true}
      showSubmitButton={false}
    >
      {step === 1 ? renderStep1() : renderStep2()}
    </Modal>
  );
}

DeleteAccountModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  user: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    name: PropTypes.string,
    email: PropTypes.string
  }),
  onSuccess: PropTypes.func
};

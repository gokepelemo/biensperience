import { useState, useEffect, useCallback } from 'react';
import { FaCheck, FaArrowLeft, FaExclamationTriangle, FaArchive, FaUserFriends, FaTrash } from 'react-icons/fa';
import { useUser } from '../../contexts/UserContext';
import { useToast } from '../../contexts/ToastContext';
import { checkExperiencePlans, deleteExperience, transferOwnership, archiveExperience } from '../../utilities/experiences-api';
import { searchUsers } from '../../utilities/search-api';
import { handleError } from '../../utilities/error-handler';
import { lang } from '../../lang.constants';
import { Button, Text } from '../design-system';
import Modal from '../Modal/Modal';
import Autocomplete from '../Autocomplete/Autocomplete';
import Banner from '../Banner/Banner';
import Loading from '../Loading/Loading';
import styles from './TransferOwnershipModal.module.scss';

// Get transfer ownership strings from lang constants
const t = () => lang.current.modal?.transferOwnership || {};

/**
 * Steps in the transfer ownership flow
 */
const STEPS = {
  LOADING: 0,
  CHOOSE_ACTION: 1,
  SELECT_USER: 2,
  CONFIRM: 3,
};

/**
 * Actions available when deleting an experience with plans
 */
const ACTIONS = {
  TRANSFER: 'transfer',
  ARCHIVE: 'archive',
  DELETE: 'delete', // Only available when no plans exist
};

/**
 * TransferOwnershipModal - Multi-step modal for handling experience deletion
 * when other users have created plans for the experience.
 *
 * Flow:
 * 1. Check for existing plans
 * 2. If plans exist:
 *    a. Choose action (transfer to user OR archive)
 *    b. If transfer: select user from collaborators or search
 *    c. Confirm action
 * 3. If no plans: show standard delete confirmation
 */
export default function TransferOwnershipModal({
  show,
  onClose,
  experience,
  onSuccess,
}) {
  const { user } = useUser();
  const { success: showSuccess, error: showError } = useToast();

  // Step management
  const [currentStep, setCurrentStep] = useState(STEPS.LOADING);
  const [selectedAction, setSelectedAction] = useState(null);

  // Plan check data
  const [planCheckData, setPlanCheckData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // User selection
  const [selectedUser, setSelectedUser] = useState(null);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Check for plans - wrapped in useCallback for dependency tracking
  const checkPlans = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Validate experience ID before making the request
      const experienceId = experience?._id;
      if (!experienceId) {
        throw new Error(t().errorMissingExperienceId || 'Experience ID is missing');
      }
      const result = await checkExperiencePlans(experienceId);
      setPlanCheckData(result);

      // If no plans exist, skip to delete confirmation
      if (!result.requiresTransfer && result.canDelete) {
        setSelectedAction(ACTIONS.DELETE);
        setCurrentStep(STEPS.CONFIRM);
      } else {
        setCurrentStep(STEPS.CHOOSE_ACTION);
      }
    } catch (err) {
      const errorMsg = handleError(err, { context: 'Check experience plans', silent: true });
      setError(errorMsg || t().errorCheckFailed || 'Failed to check experience status');
      setCurrentStep(STEPS.CHOOSE_ACTION);
    } finally {
      setLoading(false);
    }
  }, [experience?._id]);

  // Check for plans when modal opens
  useEffect(() => {
    if (show && experience?._id) {
      checkPlans();
    }
  }, [show, experience?._id, checkPlans]);

  // Reset state when modal closes
  useEffect(() => {
    if (!show) {
      setCurrentStep(STEPS.LOADING);
      setSelectedAction(null);
      setPlanCheckData(null);
      setError('');
      setSelectedUser(null);
      setUserSearchTerm('');
      setSearchResults([]);
    }
  }, [show]);

  // Search for users to transfer to
  const handleUserSearch = useCallback(async (query) => {
    setUserSearchTerm(query);
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const results = await searchUsers(query);
      // Filter out current user and format for autocomplete
      const filtered = (results || [])
        .filter(u => u._id !== user?._id)
        .map(u => ({
          id: u._id,
          _id: u._id,
          name: u.name,
          email: u.email,
        }));
      setSearchResults(filtered);
    } catch (err) {
      console.error('User search failed:', err);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [user?._id]);


  // Handle action selection
  const handleActionSelect = (action) => {
    setSelectedAction(action);
    if (action === ACTIONS.TRANSFER) {
      setCurrentStep(STEPS.SELECT_USER);
    } else {
      // Archive goes straight to confirm
      setCurrentStep(STEPS.CONFIRM);
    }
  };

  // Handle user selection
  const handleUserSelect = (selectedUserData) => {
    setSelectedUser(selectedUserData);
    setCurrentStep(STEPS.CONFIRM);
  };

  // Go back to previous step
  const handleBack = () => {
    if (currentStep === STEPS.CONFIRM) {
      if (selectedAction === ACTIONS.TRANSFER) {
        setCurrentStep(STEPS.SELECT_USER);
      } else {
        setCurrentStep(STEPS.CHOOSE_ACTION);
      }
    } else if (currentStep === STEPS.SELECT_USER) {
      setCurrentStep(STEPS.CHOOSE_ACTION);
    }
    setError('');
  };

  // Execute the selected action
  const handleConfirm = async () => {
    setLoading(true);
    setError('');

    try {
      if (selectedAction === ACTIONS.DELETE) {
        await deleteExperience(experience._id);
        showSuccess(t().successDeleted?.replace('{name}', experience.name) || `"${experience.name}" has been deleted.`);
      } else if (selectedAction === ACTIONS.TRANSFER) {
        if (!selectedUser?._id) {
          setError(t().errorMissingUser || 'Please select a user to transfer ownership to.');
          setLoading(false);
          return;
        }
        await transferOwnership(experience._id, selectedUser._id);
        showSuccess(
          t().successTransferred?.replace('{name}', experience.name).replace('{newOwner}', selectedUser.name) ||
          `Ownership of "${experience.name}" has been transferred to ${selectedUser.name}.`
        );
      } else if (selectedAction === ACTIONS.ARCHIVE) {
        await archiveExperience(experience._id);
        showSuccess(t().successArchived?.replace('{name}', experience.name) || `"${experience.name}" has been archived.`);
      }

      onClose();
      if (onSuccess) onSuccess();
    } catch (err) {
      const errorMsg = handleError(err, { context: 'Process experience', silent: true });
      setError(errorMsg || t().errorProcessFailed || 'Failed to process request');
    } finally {
      setLoading(false);
    }
  };

  // Get modal title based on current step
  const getModalTitle = () => {
    if (currentStep === STEPS.LOADING) return t().titleChecking || 'Checking...';
    if (currentStep === STEPS.CHOOSE_ACTION) return t().titleDeleteExperience || 'Delete Experience';
    if (currentStep === STEPS.SELECT_USER) return t().titleTransferOwnership || 'Transfer Ownership';
    if (currentStep === STEPS.CONFIRM) return t().titleConfirmAction || 'Confirm Action';
    return t().titleDeleteExperience || 'Delete Experience';
  };

  // Render step content
  const renderStepContent = () => {
    if (currentStep === STEPS.LOADING) {
      return (
        <div className={styles.loadingState}>
          <Loading size="md" />
          <Text variant="muted" className="mt-3">{t().checkingStatus || 'Checking experience status...'}</Text>
        </div>
      );
    }

    if (currentStep === STEPS.CHOOSE_ACTION) {
      const hasPlans = planCheckData?.totalPlans > 0;
      const count = planCheckData?.otherUserPlansCount || 0;

      return (
        <div className={styles.stepContent}>
          {hasPlans ? (
            <>
              <div className={styles.warningBanner}>
                <FaExclamationTriangle className={styles.warningIcon} />
                <div>
                  <Text weight="semibold">
                    {count === 1
                      ? (t().hasActivePlanSingular || 'This experience has an active plan')
                      : (t().hasActivePlansPlural || 'This experience has active plans')}
                  </Text>
                  <Text size="sm" variant="muted">
                    {count === 1
                      ? (t().otherUserHasPlanSingular?.replace('{count}', count) || `${count} other user has created a plan for this experience.`)
                      : (t().otherUsersHavePlansPlural?.replace('{count}', count) || `${count} other users have created plans for this experience.`)}
                  </Text>
                </div>
              </div>

              <Text className="mb-4">
                {t().cannotDeleteDirectly || "Since other users are planning this experience, you cannot delete it directly. Choose how you'd like to proceed:"}
              </Text>

              <div className={styles.actionCards}>
                <button
                  type="button"
                  className={styles.actionCard}
                  onClick={() => handleActionSelect(ACTIONS.TRANSFER)}
                >
                  <div className={styles.actionIcon}>
                    <FaUserFriends />
                  </div>
                  <div className={styles.actionContent}>
                    <Text weight="semibold">{t().transferOwnershipAction || 'Transfer Ownership'}</Text>
                    <Text size="sm" variant="muted">
                      {t().transferOwnershipDescription || 'Give ownership to another user who can continue managing the experience.'}
                    </Text>
                  </div>
                </button>

                <button
                  type="button"
                  className={styles.actionCard}
                  onClick={() => handleActionSelect(ACTIONS.ARCHIVE)}
                >
                  <div className={styles.actionIcon}>
                    <FaArchive />
                  </div>
                  <div className={styles.actionContent}>
                    <Text weight="semibold">{t().archiveExperienceAction || 'Archive Experience'}</Text>
                    <Text size="sm" variant="muted">
                      {t().archiveExperienceDescription || 'Move to archive. The experience remains accessible to users with plans, but will no longer appear in public listings.'}
                    </Text>
                  </div>
                </button>
              </div>
            </>
          ) : (
            <div className={styles.deleteConfirm}>
              <FaTrash className={styles.deleteIcon} />
              <Text weight="semibold" className="mb-2">{t().titleDeleteExperience || 'Delete Experience'}?</Text>
              <Text variant="muted">
                {t().noPlansExist || 'No users have created plans for this experience. You can safely delete it.'}
              </Text>
            </div>
          )}
        </div>
      );
    }

    if (currentStep === STEPS.SELECT_USER) {
      return (
        <div className={styles.stepContent}>
          <Text className="mb-4">
            {t().searchUserPrompt?.replace('{name}', experience?.name) || `Search for a user to transfer ownership of "${experience?.name}" to:`}
          </Text>

          <div className={styles.searchSection}>
            <Autocomplete
              placeholder={t().searchPlaceholder || 'Search by name or email...'}
              value={userSearchTerm}
              items={searchResults}
              onSelect={handleUserSelect}
              onSearch={handleUserSearch}
              size="md"
              emptyMessage={searching ? (t().searchingUsers || 'Searching...') : (t().typeToSearch || 'Type to search users...')}
              entityType="user"
              disableFilter={true}
            />
          </div>

          {selectedUser && (
            <div className={styles.selectedUserPreview}>
              <Text size="sm" weight="semibold" className="mb-2">
                {t().selectedUser || 'Selected user:'}
              </Text>
              <div className={styles.userCard}>
                <div className={styles.userInfo}>
                  <Text weight="medium">{selectedUser.name}</Text>
                  <Text size="sm" variant="muted">{selectedUser.email}</Text>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    if (currentStep === STEPS.CONFIRM) {
      return (
        <div className={styles.stepContent}>
          <div className={styles.confirmContent}>
            {selectedAction === ACTIONS.DELETE && (
              <>
                <FaTrash className={styles.confirmIcon} style={{ color: 'var(--color-danger)' }} />
                <Text weight="semibold" size="lg" className="mb-2">
                  {t().confirmDelete?.replace('{name}', experience?.name) || `Delete "${experience?.name}"?`}
                </Text>
                <Text variant="muted">
                  {t().confirmDeleteWarning || 'This action cannot be undone. The experience and all its data will be permanently removed.'}
                </Text>
              </>
            )}

            {selectedAction === ACTIONS.TRANSFER && selectedUser && (
              <>
                <FaUserFriends className={styles.confirmIcon} style={{ color: 'var(--color-primary)' }} />
                <Text weight="semibold" size="lg" className="mb-2">
                  {t().confirmTransfer?.replace('{name}', selectedUser.name) || `Transfer to ${selectedUser.name}?`}
                </Text>
                <Text variant="muted">
                  {t().confirmTransferWarning?.replace('{name}', selectedUser.name).replace('{experienceName}', experience?.name) ||
                    `${selectedUser.name} will become the new owner of "${experience?.name}" and will have full control over it. You will lose ownership access.`}
                </Text>
              </>
            )}

            {selectedAction === ACTIONS.ARCHIVE && (
              <>
                <FaArchive className={styles.confirmIcon} style={{ color: 'var(--color-warning)' }} />
                <Text weight="semibold" size="lg" className="mb-2">
                  {t().confirmArchive?.replace('{name}', experience?.name) || `Archive "${experience?.name}"?`}
                </Text>
                <Text variant="muted">
                  {t().confirmArchiveWarning || "The experience will be moved to archive. Users with existing plans can still access it, but it won't appear in public listings or search results."}
                </Text>
              </>
            )}
          </div>
        </div>
      );
    }

    return null;
  };

  // Get button text based on action
  const getConfirmButtonText = () => {
    if (loading) return t().buttonProcessing || 'Processing...';
    if (selectedAction === ACTIONS.DELETE) return t().buttonDeletePermanently || 'Delete Permanently';
    if (selectedAction === ACTIONS.TRANSFER) return t().buttonTransferOwnership || 'Transfer Ownership';
    if (selectedAction === ACTIONS.ARCHIVE) return t().buttonArchiveExperience || 'Archive Experience';
    return lang.current.button?.confirm || 'Confirm';
  };

  // Get button variant based on action
  const getConfirmButtonVariant = () => {
    if (selectedAction === ACTIONS.DELETE) return 'danger';
    return 'gradient';
  };

  // Render custom footer
  const renderFooter = () => (
    <div className={styles.modalFooter}>
      <div className={styles.footerLeft}>
        {(currentStep === STEPS.SELECT_USER || currentStep === STEPS.CONFIRM) && (
          <button
            type="button"
            className={styles.backButton}
            onClick={handleBack}
            disabled={loading}
          >
            <FaArrowLeft size={12} className="me-2" />
            {t().buttonBack || 'Back'}
          </button>
        )}
      </div>
      <div className={styles.footerRight}>
        <button
          type="button"
          className="btn btn-outline-secondary me-2"
          onClick={onClose}
          disabled={loading}
        >
          {t().buttonCancel || lang.current.button?.cancel || 'Cancel'}
        </button>
        {currentStep === STEPS.CONFIRM && (
          <Button
            variant={getConfirmButtonVariant()}
            size="md"
            onClick={handleConfirm}
            disabled={loading || (selectedAction === ACTIONS.TRANSFER && !selectedUser)}
          >
            {getConfirmButtonText()}
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <Modal
      show={show}
      onClose={onClose}
      title={getModalTitle()}
      size="lg"
      scrollable
      centered
      footer={renderFooter()}
      contentClassName={styles.modalContentWrapper}
      loading={loading}
    >
      {/* Step Indicator */}
      {currentStep !== STEPS.LOADING && planCheckData?.requiresTransfer && (
        <div className={styles.stepIndicator}>
          <div className={`${styles.step} ${currentStep >= STEPS.CHOOSE_ACTION ? styles.active : ''} ${currentStep > STEPS.CHOOSE_ACTION ? styles.completed : ''}`}>
            <span className={styles.stepNumber}>
              {currentStep > STEPS.CHOOSE_ACTION ? <FaCheck size={12} /> : '1'}
            </span>
            <span className={styles.stepLabel}>Choose Action</span>
          </div>
          {selectedAction === ACTIONS.TRANSFER && (
            <>
              <div className={`${styles.stepConnector} ${currentStep > STEPS.CHOOSE_ACTION ? styles.active : ''}`} />
              <div className={`${styles.step} ${currentStep >= STEPS.SELECT_USER ? styles.active : ''} ${currentStep > STEPS.SELECT_USER ? styles.completed : ''}`}>
                <span className={styles.stepNumber}>
                  {currentStep > STEPS.SELECT_USER ? <FaCheck size={12} /> : '2'}
                </span>
                <span className={styles.stepLabel}>Select User</span>
              </div>
            </>
          )}
          <div className={`${styles.stepConnector} ${currentStep >= STEPS.CONFIRM ? styles.active : ''}`} />
          <div className={`${styles.step} ${currentStep >= STEPS.CONFIRM ? styles.active : ''}`}>
            <span className={styles.stepNumber}>
              {selectedAction === ACTIONS.TRANSFER ? '3' : '2'}
            </span>
            <span className={styles.stepLabel}>Confirm</span>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <Banner
          type="danger"
          variant="light"
          message={error}
          dismissible
          onDismiss={() => setError('')}
          className="mb-4"
        />
      )}

      {/* Step Content */}
      {renderStepContent()}
    </Modal>
  );
}

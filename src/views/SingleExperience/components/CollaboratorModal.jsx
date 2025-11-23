/**
 * CollaboratorModal Component
 * Modal for managing collaborators on plans or experiences
 * Refactored to use unified Autocomplete component and design tokens
 */

import { useState, useEffect } from 'react';
import { FaTimes, FaUserPlus, FaEnvelope, FaCheck } from 'react-icons/fa';
import Modal from '../../../components/Modal/Modal';
import Autocomplete from '../../../components/Autocomplete/Autocomplete';
import Alert from '../../../components/Alert/Alert';
import FormField from '../../../components/FormField/FormField';
import { Button as DSButton, Pill } from '../../../components/design-system';
import { logger } from '../../../utilities/logger';
import './CollaboratorModal.css';

export default function CollaboratorModal({
  show,
  onHide,
  onSearch,
  onAddCollaborators,
  onRemoveCollaborator,
  onSendEmailInvite,
  context = 'plan',
  searchTerm,
  onSearchTermChange,
  searchResults = [],
  selectedCollaborators = [],
  onToggleCollaborator,
  existingCollaborators = [],
  removedCollaborators = [],
  addSuccess = false,
  addedCollaborators = [],
  actuallyRemovedCollaborators = [],
  experienceName = '',
  destinationName = ''
}) {
  const [mode, setMode] = useState('search'); // 'search' or 'email'
  const [step, setStep] = useState('edit'); // 'edit' or 'confirm'
  const [emailForm, setEmailForm] = useState({ email: '', name: '' });
  const [emailError, setEmailError] = useState('');
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const title = context === 'plan' ? 'Manage Plan Collaborators' : 'Manage Experience Collaborators';

  // Filter out existing collaborators from selected collaborators
  const newlySelectedCollaborators = selectedCollaborators.filter(selected =>
    !existingCollaborators.some(existing => existing._id === (selected._id || selected.id))
  );

  // Check if there are any changes to apply
  const hasChanges = removedCollaborators.length > 0 || newlySelectedCollaborators.length > 0;

  // Reset step when modal opens/closes
  useEffect(() => {
    if (show) {
      setStep('edit');
    }
  }, [show]);

  // Auto-close modal after successful add/remove
  useEffect(() => {
    if (addSuccess || actuallyRemovedCollaborators.length > 0) {
      // Close after 1.5 seconds to show success message
      const timeout = setTimeout(() => {
        onHide();
      }, 1500);
      return () => clearTimeout(timeout);
    }
  }, [addSuccess, actuallyRemovedCollaborators, onHide]);

  const handleEmailChange = (field, value) => {
    setEmailForm(prev => ({ ...prev, [field]: value }));
    setEmailError('');
  };

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSendInvite = async () => {
    // Validation
    if (!emailForm.email.trim()) {
      setEmailError('Email is required');
      return;
    }
    if (!validateEmail(emailForm.email)) {
      setEmailError('Please enter a valid email address');
      return;
    }
    if (!emailForm.name.trim()) {
      setEmailError('Name is required');
      return;
    }

    setIsSendingEmail(true);
    setEmailError('');

    try {
      await onSendEmailInvite(emailForm.email, emailForm.name);
      setEmailSuccess(true);
      setEmailForm({ email: '', name: '' });

      // Clear success message after 5 seconds
      setTimeout(() => setEmailSuccess(false), 5000);
    } catch (error) {
      logger.error('Error sending email invite', { error: error.message });
      setEmailError(error.message || 'Failed to send email invite');
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <Modal
      show={show}
      onClose={onHide}
      title={title}
      size="lg"
      scrollable={true}
    >
      <div 
        className="collaborator-modal-content modal-content-styled"
      >
        {/* Success Messages */}
        {addSuccess && addedCollaborators.length > 0 && (
          <Alert
            type="success"
            dismissible
            onDismiss={() => {}}
          >
            Successfully added {addedCollaborators.length} collaborator{addedCollaborators.length > 1 ? 's' : ''}!
          </Alert>
        )}

        {actuallyRemovedCollaborators.length > 0 && (
          <Alert
            type="info"
            dismissible
            onDismiss={() => {}}
          >
            Successfully removed {actuallyRemovedCollaborators.length} collaborator{actuallyRemovedCollaborators.length > 1 ? 's' : ''}!
          </Alert>
        )}

        {emailSuccess && (
          <Alert
            type="success"
            dismissible
            onDismiss={() => setEmailSuccess(false)}
          >
            Email invite sent successfully! They will receive an invitation to join Biensperience and collaborate on this {context}.
          </Alert>
        )}

        {emailError && (
          <Alert
            type="danger"
            dismissible
            onDismiss={() => setEmailError('')}
          >
            {emailError}
          </Alert>
        )}

        {/* Step: Edit - Show current collaborators and add new ones */}
        {step === 'edit' && (
          <>
            {/* Existing Collaborators */}
            <div className="modal-section">
              <h5 className="text-color_primary" style={{
                marginBottom: 'var(--space-3)',
                fontSize: 'var(--font-size-lg)',
                fontWeight: 'var(--font-weight-semibold)',
              }}>
                Current Collaborators
              </h5>
              {existingCollaborators.length === 0 ? (
                <p className="text-muted font-size-adjust-sm">
                  No collaborators yet. Add some below!
                </p>
              ) : (
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 'var(--space-2)',
                  marginBottom: 'var(--space-3)'
                }}>
                  {existingCollaborators
                    .filter(collab => !removedCollaborators.includes(collab._id))
                    .map(collab => (
                      <Pill
                        key={collab._id}
                        variant="primary"
                        size="md"
                      >
                        {collab.name}
                        <FaTimes
                          onClick={() => onRemoveCollaborator(collab._id)}
                          style={{
                            cursor: 'pointer',
                            marginLeft: 'var(--space-2)',
                          }}
                        />
                      </Pill>
                    ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Step: Edit - Add Collaborators section */}
        {step === 'edit' && (
          <div className="modal-section">
            <h5 className="text-color_primary" style={{
              marginBottom: 'var(--space-3)',
              fontSize: 'var(--font-size-lg)',
              fontWeight: 'var(--font-weight-semibold)',
            }}>
              Add Collaborators
            </h5>

            {/* Mode Toggle */}
            <div className="modal-button-group" style={{ marginBottom: 'var(--space-3)' }}>
              <DSButton
                variant={mode === 'search' ? 'gradient' : 'outline'}
                size="sm"
                onClick={() => setMode('search')}
                style={{ marginRight: 'var(--space-2)' }}
              >
                <FaUserPlus style={{ marginRight: 'var(--space-2)' }} />
                Search Existing Users
              </DSButton>
              <DSButton
                variant={mode === 'email' ? 'gradient' : 'outline'}
                size="sm"
                onClick={() => setMode('email')}
              >
                <FaEnvelope style={{ marginRight: 'var(--space-2)' }} />
                Send Email Invite
              </DSButton>
            </div>

            {/* Search Mode */}
            {mode === 'search' && (
              <>
                <div style={{ marginBottom: 'var(--space-3)' }}>
                  <Autocomplete
                    placeholder="Search by name or email..."
                    entityType="user"
                    items={searchResults}
                    onSelect={(user) => onToggleCollaborator(user)}
                    onSearch={onSearch}
                    value={searchTerm}
                    onChange={(e) => onSearchTermChange(e.target.value)}
                    showAvatar={true}
                    showStatus={true}
                    showMeta={true}
                    size="md"
                    emptyMessage="No users found. Try a different search term."
                  />
                </div>

                {/* Selected NEW Collaborators Only */}
                {newlySelectedCollaborators.length > 0 && (
                  <div className="mt-3">
                    <strong className="d-block mb-2 text-secondary font-size-adjust-sm fw-semibold">
                      Selected ({newlySelectedCollaborators.length}):
                    </strong>
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 'var(--space-2)'
                    }}>
                      {newlySelectedCollaborators.map(user => (
                        <Pill
                          key={user._id || user.id}
                          variant="success"
                          size="md"
                        >
                          {user.name}
                          <FaTimes
                            onClick={() => onToggleCollaborator(user._id || user.id)}
                            style={{
                              cursor: 'pointer',
                              marginLeft: 'var(--space-2)',
                            }}
                          />
                        </Pill>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Email Invite Mode */}
            {mode === 'email' && (
              <>
                <FormField
                  name="email"
                  label="Email Address"
                  type="email"
                  placeholder="collaborator@example.com"
                  value={emailForm.email}
                  onChange={(e) => handleEmailChange('email', e.target.value)}
                  isInvalid={emailError && emailError.includes('email')}
                  invalidFeedback={emailError && emailError.includes('email') ? emailError : undefined}
                  required
                />

                <FormField
                  name="name"
                  label="Name"
                  type="text"
                  placeholder="Collaborator's full name"
                  value={emailForm.name}
                  onChange={(e) => handleEmailChange('name', e.target.value)}
                  isInvalid={emailError && emailError.includes('Name')}
                  invalidFeedback={emailError && emailError.includes('Name') ? emailError : undefined}
                  required
                />

                <div style={{
                  padding: 'var(--space-3)',
                  backgroundColor: 'var(--color-bg-tertiary)',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 'var(--space-3)',
                }}>
                  <small style={{ color: 'var(--color-text-secondary)' }}>
                    <strong>Note:</strong> We'll send an email to <strong>{emailForm.email || 'this address'}</strong> inviting them to join Biensperience and collaborate on <strong>{experienceName || 'this experience'}</strong> in <strong>{destinationName || 'this destination'}</strong>.
                  </small>
                </div>

                <DSButton
                  variant="gradient"
                  size="md"
                  onClick={handleSendInvite}
                  disabled={isSendingEmail || !emailForm.email.trim() || !emailForm.name.trim()}
                  style={{ width: '100%', marginBottom: 'var(--space-3)' }}
                >
                  {isSendingEmail ? 'Sending...' : 'Send Email Invite'}
                </DSButton>
              </>
            )}
          </div>
        )}

        {/* Step: Confirm - Review changes before applying */}
        {step === 'confirm' && (
          <div className="modal-section">
            <h5 className="text-color_primary" style={{
              marginBottom: 'var(--space-3)',
              fontSize: 'var(--font-size-lg)',
              fontWeight: 'var(--font-weight-semibold)',
            }}>
              Review Changes
            </h5>

            {/* Collaborators being added */}
            {newlySelectedCollaborators.length > 0 && (
              <div style={{ marginBottom: 'var(--space-3)' }}>
                <strong className="d-block mb-2 text-success font-size-adjust-sm">
                  Adding {newlySelectedCollaborators.length} collaborator{newlySelectedCollaborators.length > 1 ? 's' : ''}:
                </strong>
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 'var(--space-2)'
                }}>
                  {newlySelectedCollaborators.map(user => (
                    <Pill key={user._id || user.id} variant="success" size="md">
                      {user.name}
                    </Pill>
                  ))}
                </div>
              </div>
            )}

            {/* Collaborators being removed */}
            {removedCollaborators.length > 0 && (
              <div style={{ marginBottom: 'var(--space-3)' }}>
                <strong className="d-block mb-2 text-danger font-size-adjust-sm">
                  Removing {removedCollaborators.length} collaborator{removedCollaborators.length > 1 ? 's' : ''}:
                </strong>
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 'var(--space-2)'
                }}>
                  {existingCollaborators
                    .filter(collab => removedCollaborators.includes(collab._id))
                    .map(collab => (
                      <Pill key={collab._id} variant="danger" size="md">
                        {collab.name}
                      </Pill>
                    ))}
                </div>
              </div>
            )}

            {!hasChanges && (
              <p className="text-muted font-size-adjust-sm">
                No changes to apply.
              </p>
            )}
          </div>
        )}

        {/* Footer Buttons */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 'var(--space-2)',
          paddingTop: 'var(--space-3)',
          borderTop: '1px solid var(--color-border-light)',
        }}>
          {step === 'edit' ? (
            <>
              <DSButton
                variant="outline"
                size="md"
                onClick={onHide}
              >
                Close
              </DSButton>
              <DSButton
                variant="gradient"
                size="md"
                onClick={() => setStep('confirm')}
                disabled={!hasChanges}
              >
                Review Changes
              </DSButton>
            </>
          ) : (
            <>
              <DSButton
                variant="outline"
                size="md"
                onClick={() => setStep('edit')}
              >
                Back
              </DSButton>
              <DSButton
                variant="gradient"
                size="md"
                onClick={onAddCollaborators}
                disabled={!hasChanges}
              >
                <FaCheck style={{ marginRight: 'var(--space-2)' }} />
                Confirm Changes
              </DSButton>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

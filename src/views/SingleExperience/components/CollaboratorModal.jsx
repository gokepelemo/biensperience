/**
 * CollaboratorModal Component
 * Modal for managing collaborators on plans or experiences
 * Refactored to use unified Autocomplete component and design tokens
 */

import { useState } from 'react';
import { Form, ListGroup, Badge, ButtonGroup, Button } from 'react-bootstrap';
import { FaTimes, FaUserPlus, FaEnvelope } from 'react-icons/fa';
import Modal from '../../../components/Modal/Modal';
import Autocomplete from '../../../components/Autocomplete/Autocomplete';
import Alert from '../../../components/Alert/Alert';
import FormField from '../../../components/FormField/FormField';
import { Button as DSButton } from '../../../components/design-system';
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
  const [emailForm, setEmailForm] = useState({ email: '', name: '' });
  const [emailError, setEmailError] = useState('');
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const title = context === 'plan' ? 'Manage Plan Collaborators' : 'Manage Experience Collaborators';

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
            onClose={() => {}}
          >
            Successfully added {addedCollaborators.length} collaborator{addedCollaborators.length > 1 ? 's' : ''}!
          </Alert>
        )}

        {actuallyRemovedCollaborators.length > 0 && (
          <Alert
            type="info"
            dismissible
            onClose={() => {}}
          >
            Successfully removed {actuallyRemovedCollaborators.length} collaborator{actuallyRemovedCollaborators.length > 1 ? 's' : ''}!
          </Alert>
        )}

        {emailSuccess && (
          <Alert
            type="success"
            dismissible
            onClose={() => setEmailSuccess(false)}
          >
            Email invite sent successfully! They will receive an invitation to join Biensperience and collaborate on this {context}.
          </Alert>
        )}

        {emailError && (
          <Alert
            type="danger"
            dismissible
            onClose={() => setEmailError('')}
          >
            {emailError}
          </Alert>
        )}

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
            <ListGroup>
              {existingCollaborators.map(collab => {
                const isRemoved = removedCollaborators.includes(collab._id);
                return (
                  <ListGroup.Item
                    key={collab._id}
                    className="list-item-styled"
                    style={{
                      opacity: isRemoved ? 0.5 : 1,
                      padding: 'var(--space-3)',
                      borderRadius: 'var(--radius-md)',
                      marginBottom: 'var(--space-2)',
                    }}
                  >
                    <div>
                      <strong style={{ color: 'var(--color-text-primary)' }}>
                        {collab.name}
                      </strong>
                      {isRemoved && (
                        <Badge 
                          bg="danger" 
                          style={{ 
                            marginLeft: 'var(--space-2)',
                            backgroundColor: 'var(--color-danger)',
                            color: 'white',
                          }}
                        >
                          Will be removed
                        </Badge>
                      )}
                    </div>
                    <DSButton
                      variant="outline"
                      size="sm"
                      onClick={() => onRemoveCollaborator(collab._id)}
                      disabled={isRemoved}
                      style={{ 
                        borderColor: 'var(--color-danger)',
                        color: 'var(--color-danger)',
                      }}
                    >
                      <FaTimes style={{ marginRight: 'var(--space-1)' }} />
                      Remove
                    </DSButton>
                  </ListGroup.Item>
                );
              })}
            </ListGroup>
          )}
        </div>

        {/* Add Collaborators */}
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

              {/* Selected Collaborators */}
              {selectedCollaborators.length > 0 && (
                <div className="mt-3">
                  <strong className="d-block mb-2 text-secondary font-size-adjust-sm fw-semibold">
                    Selected ({selectedCollaborators.length}):
                  </strong>
                  <div className="flex-wrap-gap">
                    {selectedCollaborators.map(user => (
                      <Badge
                        key={user._id || user.id}
                        bg="primary"
                        style={{
                          padding: 'var(--space-2) var(--space-3)',
                          backgroundColor: 'var(--color-primary)',
                          color: 'white',
                          borderRadius: 'var(--radius-full)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 'var(--space-2)',
                        }}
                      >
                        {user.name}
                        <FaTimes
                          onClick={() => onToggleCollaborator(user._id || user.id)}
                          style={{
                            cursor: 'pointer',
                            marginLeft: 'var(--space-1)',
                          }}
                        />
                      </Badge>
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

        {/* Footer Buttons */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          gap: 'var(--space-2)',
          paddingTop: 'var(--space-3)',
          borderTop: '1px solid var(--color-border-light)',
        }}>
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
            onClick={onAddCollaborators}
            disabled={selectedCollaborators.length === 0}
          >
            <FaUserPlus style={{ marginRight: 'var(--space-2)' }} />
            Add {selectedCollaborators.length > 0 ? `(${selectedCollaborators.length})` : 'Collaborators'}
          </DSButton>
        </div>
      </div>
    </Modal>
  );
}

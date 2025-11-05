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
      onHide={onHide}
      title={title}
      size="lg"
    >
      <div 
        className="collaborator-modal-content"
        style={{
          padding: 'var(--space-4)',
          color: 'var(--color-text-primary)',
        }}
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
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <h5 style={{ 
            color: 'var(--color-text-primary)',
            marginBottom: 'var(--space-3)',
            fontSize: 'var(--font-size-lg)',
            fontWeight: 'var(--font-weight-semibold)',
          }}>
            Current Collaborators
          </h5>
          {existingCollaborators.length === 0 ? (
            <p style={{ 
              color: 'var(--color-text-muted)',
              fontSize: 'var(--font-size-sm)',
            }}>
              No collaborators yet. Add some below!
            </p>
          ) : (
            <ListGroup>
              {existingCollaborators.map(collab => {
                const isRemoved = removedCollaborators.includes(collab._id);
                return (
                  <ListGroup.Item
                    key={collab._id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      backgroundColor: 'var(--color-bg-secondary)',
                      border: '1px solid var(--color-border-light)',
                      color: 'var(--color-text-primary)',
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
                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => onRemoveCollaborator(collab._id)}
                      disabled={isRemoved}
                      style={{
                        borderColor: 'var(--color-danger)',
                        color: 'var(--color-danger)',
                      }}
                    >
                      <FaTimes /> Remove
                    </button>
                  </ListGroup.Item>
                );
              })}
            </ListGroup>
          )}
        </div>

        {/* Add Collaborators */}
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <h5 style={{ 
            color: 'var(--color-text-primary)',
            marginBottom: 'var(--space-3)',
            fontSize: 'var(--font-size-lg)',
            fontWeight: 'var(--font-weight-semibold)',
          }}>
            Add Collaborators
          </h5>

          {/* Mode Toggle */}
          <ButtonGroup style={{ marginBottom: 'var(--space-3)', width: '100%' }}>
            <Button
              variant={mode === 'search' ? 'primary' : 'outline-secondary'}
              onClick={() => setMode('search')}
              style={{
                backgroundColor: mode === 'search' ? 'var(--color-primary)' : 'transparent',
                borderColor: mode === 'search' ? 'var(--color-primary)' : 'var(--color-border-medium)',
                color: mode === 'search' ? 'white' : 'var(--color-text-secondary)',
              }}
            >
              <FaUserPlus style={{ marginRight: 'var(--space-2)' }} />
              Search Existing Users
            </Button>
            <Button
              variant={mode === 'email' ? 'primary' : 'outline-secondary'}
              onClick={() => setMode('email')}
              style={{
                backgroundColor: mode === 'email' ? 'var(--color-primary)' : 'transparent',
                borderColor: mode === 'email' ? 'var(--color-primary)' : 'var(--color-border-medium)',
                color: mode === 'email' ? 'white' : 'var(--color-text-secondary)',
              }}
            >
              <FaEnvelope style={{ marginRight: 'var(--space-2)' }} />
              Send Email Invite
            </Button>
          </ButtonGroup>

          {/* Search Mode */}
          {mode === 'search' && (
            <>
              <div style={{ marginBottom: 'var(--space-3)' }}>
                <Autocomplete
                  placeholder="Search by name or email..."
                  entityType="user"
                  items={searchResults}
                  onSelect={(user) => onToggleCollaborator(user._id || user.id)}
                  showAvatar={true}
                  showStatus={true}
                  showMeta={true}
                  size="md"
                  emptyMessage="No users found. Try a different search term."
                />
              </div>

              {/* Selected Collaborators */}
              {selectedCollaborators.length > 0 && (
                <div style={{ marginTop: 'var(--space-3)' }}>
                  <strong style={{ 
                    display: 'block',
                    marginBottom: 'var(--space-2)',
                    color: 'var(--color-text-secondary)',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 'var(--font-weight-semibold)',
                  }}>
                    Selected ({selectedCollaborators.length}):
                  </strong>
                  <div style={{ 
                    display: 'flex', 
                    flexWrap: 'wrap', 
                    gap: 'var(--space-2)' 
                  }}>
                    {selectedCollaborators.map(userId => {
                      const user = searchResults.find(u => u._id === userId || u.id === userId);
                      return user ? (
                        <Badge 
                          key={userId} 
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
                            onClick={() => onToggleCollaborator(userId)}
                            style={{ 
                              cursor: 'pointer',
                              marginLeft: 'var(--space-1)',
                            }}
                          />
                        </Badge>
                      ) : null;
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Email Invite Mode */}
          {mode === 'email' && (
            <>
              <Form.Group style={{ marginBottom: 'var(--space-3)' }}>
                <Form.Label style={{ 
                  color: 'var(--color-text-primary)',
                  fontWeight: 'var(--font-weight-medium)',
                }}>
                  Email Address
                </Form.Label>
                <Form.Control
                  type="email"
                  placeholder="collaborator@example.com"
                  value={emailForm.email}
                  onChange={(e) => handleEmailChange('email', e.target.value)}
                  isInvalid={emailError && !emailForm.email.trim()}
                  style={{
                    backgroundColor: 'var(--color-bg-secondary)',
                    border: '1px solid var(--color-border-light)',
                    color: 'var(--color-text-primary)',
                    borderRadius: 'var(--radius-md)',
                  }}
                />
              </Form.Group>

              <Form.Group style={{ marginBottom: 'var(--space-3)' }}>
                <Form.Label style={{ 
                  color: 'var(--color-text-primary)',
                  fontWeight: 'var(--font-weight-medium)',
                }}>
                  Name
                </Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Collaborator's full name"
                  value={emailForm.name}
                  onChange={(e) => handleEmailChange('name', e.target.value)}
                  isInvalid={emailError && !emailForm.name.trim()}
                  style={{
                    backgroundColor: 'var(--color-bg-secondary)',
                    border: '1px solid var(--color-border-light)',
                    color: 'var(--color-text-primary)',
                    borderRadius: 'var(--radius-md)',
                  }}
                />
              </Form.Group>

              <div style={{
                padding: 'var(--space-3)',
                backgroundColor: 'var(--color-info-bg)',
                border: '1px solid var(--color-info-border)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 'var(--space-3)',
              }}>
                <small style={{ color: 'var(--color-info-text)' }}>
                  <strong>Note:</strong> We'll send an email to <strong>{emailForm.email || 'this address'}</strong> inviting them to join Biensperience and collaborate on <strong>{experienceName || 'this experience'}</strong> in <strong>{destinationName || 'this destination'}</strong>.
                </small>
              </div>

              <button
                className="btn btn-primary w-100 mb-3"
                onClick={handleSendInvite}
                disabled={isSendingEmail || !emailForm.email.trim() || !emailForm.name.trim()}
                style={{
                  backgroundColor: 'var(--color-primary)',
                  border: 'none',
                  color: 'white',
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  width: '100%',
                  marginBottom: 'var(--space-3)',
                }}
              >
                {isSendingEmail ? 'Sending...' : 'Send Email Invite'}
              </button>
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
          <button
            className="btn btn-secondary"
            onClick={onHide}
            style={{
              backgroundColor: 'transparent',
              border: '1px solid var(--color-border-medium)',
              color: 'var(--color-text-secondary)',
              padding: 'var(--space-2) var(--space-4)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            Close
          </button>
          <button
            className="btn btn-primary"
            onClick={onAddCollaborators}
            disabled={selectedCollaborators.length === 0}
            style={{
              backgroundColor: 'var(--color-primary)',
              border: 'none',
              color: 'white',
              padding: 'var(--space-2) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
            }}
          >
            <FaUserPlus />
            Add {selectedCollaborators.length > 0 ? `(${selectedCollaborators.length})` : 'Collaborators'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

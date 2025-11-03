/**
 * CollaboratorModal Component
 * Modal for managing collaborators on plans or experiences
 */

import { useState } from 'react';
import { Form, ListGroup, Badge, ButtonGroup, Button } from 'react-bootstrap';
import { FaTimes, FaUserPlus, FaEnvelope } from 'react-icons/fa';
import Modal from '../../../components/Modal/Modal';
import UsersListDisplay from '../../../components/UsersListDisplay/UsersListDisplay';
import Alert from '../../../components/Alert/Alert';
import { logger } from '../../../utilities/logger';

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
      <div className="collaborator-modal-content">
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
        <div className="mb-4">
          <h5>Current Collaborators</h5>
          {existingCollaborators.length === 0 ? (
            <p className="text-muted">No collaborators yet. Add some below!</p>
          ) : (
            <ListGroup>
              {existingCollaborators.map(collab => {
                const isRemoved = removedCollaborators.includes(collab._id);
                return (
                  <ListGroup.Item
                    key={collab._id}
                    className={`d-flex justify-content-between align-items-center ${isRemoved ? 'opacity-50' : ''}`}
                  >
                    <div>
                      <strong>{collab.name}</strong>
                      {isRemoved && <Badge className="badge badge-danger ms-2">Will be removed</Badge>}
                    </div>
                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => onRemoveCollaborator(collab._id)}
                      disabled={isRemoved}
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
        <div className="mb-3">
          <h5>Add Collaborators</h5>

          {/* Mode Toggle */}
          <ButtonGroup className="mb-3 w-100">
            <Button
              variant={mode === 'search' ? 'primary' : 'outline-secondary'}
              onClick={() => setMode('search')}
            >
              <FaUserPlus className="me-2" />
              Search Existing Users
            </Button>
            <Button
              variant={mode === 'email' ? 'primary' : 'outline-secondary'}
              onClick={() => setMode('email')}
            >
              <FaEnvelope className="me-2" />
              Send Email Invite
            </Button>
          </ButtonGroup>

          {/* Search Mode */}
          {mode === 'search' && (
            <>
              <Form.Group className="mb-3">
                <Form.Control
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={onSearchTermChange}
                />
              </Form.Group>

              <button
                className="btn btn-primary w-100 mb-3"
                onClick={onSearch}
                disabled={!searchTerm.trim()}
              >
                Search Users
              </button>
            </>
          )}

          {/* Email Invite Mode */}
          {mode === 'email' && (
            <>
              <Form.Group className="mb-3">
                <Form.Label>Email Address</Form.Label>
                <Form.Control
                  type="email"
                  placeholder="collaborator@example.com"
                  value={emailForm.email}
                  onChange={(e) => handleEmailChange('email', e.target.value)}
                  isInvalid={emailError && !emailForm.email.trim()}
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Name</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Collaborator's full name"
                  value={emailForm.name}
                  onChange={(e) => handleEmailChange('name', e.target.value)}
                  isInvalid={emailError && !emailForm.name.trim()}
                />
              </Form.Group>

              <div className="alert alert-info mb-3">
                <small>
                  <strong>Note:</strong> We'll send an email to <strong>{emailForm.email || 'this address'}</strong> inviting them to join Biensperience and collaborate on <strong>{experienceName || 'this experience'}</strong> in <strong>{destinationName || 'this destination'}</strong>.
                </small>
              </div>

              <button
                className="btn btn-primary w-100 mb-3"
                onClick={handleSendInvite}
                disabled={isSendingEmail || !emailForm.email.trim() || !emailForm.name.trim()}
              >
                {isSendingEmail ? 'Sending...' : 'Send Email Invite'}
              </button>
            </>
          )}

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mb-3">
              <strong className="d-block mb-2">Search Results:</strong>
              <UsersListDisplay
                users={searchResults}
                selectedUsers={selectedCollaborators}
                onToggleUser={onToggleCollaborator}
                selectable
                excludeIds={existingCollaborators.map(c => c._id)}
              />
            </div>
          )}

          {/* Selected Collaborators */}
          {selectedCollaborators.length > 0 && (
            <div className="mb-3">
              <strong className="d-block mb-2">
                Selected ({selectedCollaborators.length}):
              </strong>
              <div className="d-flex flex-wrap gap-2">
                {selectedCollaborators.map(userId => {
                  const user = searchResults.find(u => u._id === userId);
                  return user ? (
                    <Badge key={userId} bg="primary" className="p-2">
                      {user.name}
                      <FaTimes
                        className="ms-2 cursor-pointer"
                        onClick={() => onToggleCollaborator(userId)}
                      />
                    </Badge>
                  ) : null;
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="d-flex justify-content-between gap-2">
          <button
            className="btn btn-secondary"
            onClick={onHide}
          >
            Close
          </button>
          <button
            className="btn btn-primary"
            onClick={onAddCollaborators}
            disabled={selectedCollaborators.length === 0}
          >
            <FaUserPlus className="me-2" />
            Add {selectedCollaborators.length > 0 ? `(${selectedCollaborators.length})` : 'Collaborators'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

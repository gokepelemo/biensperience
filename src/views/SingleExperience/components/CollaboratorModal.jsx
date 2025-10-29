/**
 * CollaboratorModal Component
 * Modal for managing collaborators on plans or experiences
 */

import { useState } from 'react';
import { Form, ListGroup, Badge } from 'react-bootstrap';
import { FaTimes, FaUserPlus } from 'react-icons/fa';
import Modal from '../../../components/Modal/Modal';
import UsersListDisplay from '../../../components/UsersListDisplay/UsersListDisplay';
import Alert from '../../../components/Alert/Alert';

export default function CollaboratorModal({
  show,
  onHide,
  onSearch,
  onAddCollaborators,
  onRemoveCollaborator,
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
  actuallyRemovedCollaborators = []
}) {
  const title = context === 'plan' ? 'Manage Plan Collaborators' : 'Manage Experience Collaborators';

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
                      {isRemoved && <Badge bg="danger" className="ms-2">Will be removed</Badge>}
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

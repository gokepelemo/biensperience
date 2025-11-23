/**
 * PlanItemDetailsModal Component
 * Modal for viewing and managing all details of a plan item (notes, assignment, etc.)
 */

import { useState, useEffect, useRef } from 'react';
import Modal from '../Modal/Modal';
import PlanItemNotes from '../PlanItemNotes/PlanItemNotes';
import './PlanItemDetailsModal.css';

export default function PlanItemDetailsModal({
  show,
  onClose,
  planItem,
  plan,
  currentUser,
  collaborators = [],
  onAddNote,
  onUpdateNote,
  onDeleteNote,
  onAssign,
  onUnassign,
  canEdit = false,
  // For mentions support
  availableEntities = [],
  entityData = {},
  // Initial tab to display when modal opens
  initialTab = 'notes'
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [isEditingAssignment, setIsEditingAssignment] = useState(false);
  const [assignmentSearch, setAssignmentSearch] = useState('');
  const [filteredCollaborators, setFilteredCollaborators] = useState([]);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const assignmentInputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Reset to specified initial tab when modal opens or plan item changes
  useEffect(() => {
    if (show) {
      setActiveTab(initialTab);
      setIsEditingAssignment(false);
      setAssignmentSearch('');
    }
  }, [show, planItem?._id, initialTab]);

  // Filter collaborators based on search
  useEffect(() => {
    if (assignmentSearch.trim() === '') {
      setFilteredCollaborators(collaborators);
    } else {
      const searchLower = assignmentSearch.toLowerCase();
      const filtered = collaborators.filter(collab => {
        const name = collab.name || collab.user?.name || '';
        return name.toLowerCase().includes(searchLower);
      });
      setFilteredCollaborators(filtered);
    }
    setHighlightedIndex(0);
  }, [assignmentSearch, collaborators]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingAssignment && assignmentInputRef.current) {
      assignmentInputRef.current.focus();
    }
  }, [isEditingAssignment]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        assignmentInputRef.current &&
        !assignmentInputRef.current.contains(event.target)
      ) {
        setIsEditingAssignment(false);
        setAssignmentSearch('');
      }
    };

    if (isEditingAssignment) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isEditingAssignment]);

  if (!planItem) return null;

  const notes = planItem.details?.notes || [];
  const assignedTo = planItem.assignedTo;

  const getAssigneeName = () => {
    if (!assignedTo) return 'Unassigned';

    const assigneeId = assignedTo._id || assignedTo;
    const assignee = collaborators.find(c => {
      const collabId = c._id || c.user?._id;
      return collabId === assigneeId;
    });

    return assignee?.name || assignee?.user?.name || 'Unknown User';
  };

  const handleAssignmentClick = () => {
    if (canEdit) {
      setIsEditingAssignment(true);
      setAssignmentSearch('');
    }
  };

  const handleSelectCollaborator = async (collaborator) => {
    const userId = collaborator._id || collaborator.user?._id;
    setIsEditingAssignment(false);
    setAssignmentSearch('');

    if (userId) {
      await onAssign(userId);
    }
  };

  const handleUnassign = async () => {
    setIsEditingAssignment(false);
    setAssignmentSearch('');
    await onUnassign();
  };

  const handleKeyDown = (e) => {
    if (!filteredCollaborators.length && highlightedIndex !== 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredCollaborators.length ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex === 0) {
          // Unassign option
          handleUnassign();
        } else if (highlightedIndex <= filteredCollaborators.length) {
          handleSelectCollaborator(filteredCollaborators[highlightedIndex - 1]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsEditingAssignment(false);
        setAssignmentSearch('');
        break;
      default:
        break;
    }
  };

  return (
    <Modal
      show={show}
      onClose={onClose}
      title="Plan Item Details"
      size="lg"
    >
      <div className="plan-item-details-modal">
        {/* Plan item header */}
        <div className="plan-item-header">
          <h3 className="plan-item-title">{planItem.text || 'Plan Item'}</h3>
          {planItem.url && (
            <a
              href={planItem.url}
              target="_blank"
              rel="noopener noreferrer"
              className="plan-item-link"
            >
              🔗 View Link
            </a>
          )}
        </div>

        {/* Assignment section */}
        <div className="assignment-section">
          <label className="assignment-label">Assigned To:</label>
          {canEdit ? (
            <div className="assignment-autocomplete-wrapper">
              {!isEditingAssignment ? (
                <button
                  className="assignment-link"
                  onClick={handleAssignmentClick}
                  type="button"
                >
                  {getAssigneeName()}
                </button>
              ) : (
                <div className="assignment-autocomplete">
                  <input
                    ref={assignmentInputRef}
                    type="text"
                    className="assignment-input"
                    placeholder="Search collaborators..."
                    value={assignmentSearch}
                    onChange={(e) => setAssignmentSearch(e.target.value)}
                    onKeyDown={handleKeyDown}
                  />
                  {(isEditingAssignment && (filteredCollaborators.length > 0 || assignmentSearch)) && (
                    <div ref={dropdownRef} className="assignment-dropdown">
                      <div
                        className={`assignment-option ${highlightedIndex === 0 ? 'highlighted' : ''}`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleUnassign();
                        }}
                        onMouseEnter={() => setHighlightedIndex(0)}
                      >
                        <span className="assignment-option-text">-- Unassigned --</span>
                      </div>
                      {filteredCollaborators.map((collab, index) => {
                        const userId = collab._id || collab.user?._id;
                        const userName = collab.name || collab.user?.name || 'Unknown User';
                        return (
                          <div
                            key={userId}
                            className={`assignment-option ${highlightedIndex === index + 1 ? 'highlighted' : ''}`}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleSelectCollaborator(collab);
                            }}
                            onMouseEnter={() => setHighlightedIndex(index + 1)}
                          >
                            <span className="assignment-option-text">{userName}</span>
                          </div>
                        );
                      })}
                      {filteredCollaborators.length === 0 && assignmentSearch && (
                        <div className="assignment-option disabled">
                          <span className="assignment-option-text">No collaborators found</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <span className="assignment-value">{getAssigneeName()}</span>
          )}
        </div>

        {/* Tabs for different detail types */}
        <div className="details-tabs">
          <button
            className={`details-tab ${activeTab === 'notes' ? 'active' : ''}`}
            onClick={() => setActiveTab('notes')}
            type="button"
          >
            📝 Notes {notes.length > 0 && `(${notes.length})`}
          </button>
          <button
            className="details-tab disabled"
            disabled
            type="button"
          >
            📍 Location
          </button>
          <button
            className="details-tab disabled"
            disabled
            type="button"
          >
            💬 Chat
          </button>
          <button
            className="details-tab disabled"
            disabled
            type="button"
          >
            📷 Photos
          </button>
          <button
            className="details-tab disabled"
            disabled
            type="button"
          >
            📄 Documents
          </button>
        </div>

        {/* Tab content */}
        <div className="details-content">
          {activeTab === 'notes' && (
            <PlanItemNotes
              notes={notes}
              currentUser={currentUser}
              onAddNote={onAddNote}
              onUpdateNote={onUpdateNote}
              onDeleteNote={onDeleteNote}
              disabled={!canEdit}
              availableEntities={availableEntities}
              entityData={entityData}
            />
          )}

          {activeTab === 'location' && (
            <div className="coming-soon-message">
              Location details will be available soon.
            </div>
          )}

          {activeTab === 'chat' && (
            <div className="coming-soon-message">
              Chat functionality will be available soon.
            </div>
          )}

          {activeTab === 'photos' && (
            <div className="coming-soon-message">
              Photo attachments will be available soon.
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="coming-soon-message">
              Document attachments will be available soon.
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

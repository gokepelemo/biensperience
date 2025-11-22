/**
 * PlanItemDetailsModal Component
 * Modal for viewing and managing all details of a plan item (notes, assignment, etc.)
 */

import { useState, useEffect } from 'react';
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
  entityData = {}
}) {
  const [activeTab, setActiveTab] = useState('notes');

  // Reset to notes tab when modal opens or plan item changes
  useEffect(() => {
    if (show) {
      setActiveTab('notes');
    }
  }, [show, planItem?._id]);

  if (!planItem) return null;

  const notes = planItem.details?.notes || [];
  const assignedTo = planItem.assignedTo;

  const handleAssignChange = async (e) => {
    const userId = e.target.value;
    if (!userId) {
      await onUnassign();
    } else {
      await onAssign(userId);
    }
  };

  const getAssigneeName = () => {
    if (!assignedTo) return 'Unassigned';

    const assigneeId = assignedTo._id || assignedTo;
    const assignee = collaborators.find(c => {
      const collabId = c._id || c.user?._id;
      return collabId === assigneeId;
    });

    return assignee?.name || assignee?.user?.name || 'Unknown User';
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
            <select
              className="assignment-select"
              value={assignedTo?._id || assignedTo || ''}
              onChange={handleAssignChange}
            >
              <option value="">-- Unassigned --</option>
              {collaborators.map((collab) => {
                const userId = collab._id || collab.user?._id;
                const userName = collab.name || collab.user?.name || 'Unknown User';
                return (
                  <option key={userId} value={userId}>
                    {userName}
                  </option>
                );
              })}
            </select>
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

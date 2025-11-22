/**
 * AssignPlanItemModal Component
 * Modal for assigning plan items to collaborators
 */

import { useState } from 'react';
import Modal from '../Modal/Modal';
import './AssignPlanItemModal.css';

export default function AssignPlanItemModal({
  show,
  onClose,
  planItem,
  collaborators = [],
  currentAssignee,
  onAssign,
  onUnassign
}) {
  const [selectedUserId, setSelectedUserId] = useState(currentAssignee?._id || currentAssignee || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAssign = async () => {
    if (!selectedUserId) return;

    setIsSubmitting(true);
    try {
      await onAssign(selectedUserId);
      onClose();
    } catch (error) {
      console.error('[AssignPlanItemModal] Failed to assign:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnassign = async () => {
    setIsSubmitting(true);
    try {
      await onUnassign();
      setSelectedUserId('');
      onClose();
    } catch (error) {
      console.error('[AssignPlanItemModal] Failed to unassign:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      show={show}
      onClose={onClose}
      title="Assign Plan Item"
      size="md"
    >
      <div className="assign-plan-item-modal">
        <div className="modal-description">
          <p>Assign <strong>{planItem?.text || 'this item'}</strong> to a collaborator.</p>
        </div>

        <div className="collaborators-list">
          <label className="form-label">Select Assignee</label>
          <select
            className="form-control"
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            disabled={isSubmitting}
          >
            <option value="">-- Select a collaborator --</option>
            {collaborators.map((collab) => {
              const userId = collab._id || collab.user?._id;
              const userName = collab.name || collab.user?.name || 'Unknown User';
              const isCurrentAssignee = userId === (currentAssignee?._id || currentAssignee);

              return (
                <option key={userId} value={userId}>
                  {userName} {isCurrentAssignee ? '(Currently Assigned)' : ''}
                </option>
              );
            })}
          </select>
        </div>

        <div className="modal-actions">
          <button
            className="btn-assign"
            onClick={handleAssign}
            disabled={!selectedUserId || isSubmitting}
            type="button"
          >
            {isSubmitting ? 'Assigning...' : 'Assign'}
          </button>

          {currentAssignee && (
            <button
              className="btn-unassign"
              onClick={handleUnassign}
              disabled={isSubmitting}
              type="button"
            >
              {isSubmitting ? 'Unassigning...' : 'Unassign'}
            </button>
          )}

          <button
            className="btn-cancel"
            onClick={onClose}
            disabled={isSubmitting}
            type="button"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}

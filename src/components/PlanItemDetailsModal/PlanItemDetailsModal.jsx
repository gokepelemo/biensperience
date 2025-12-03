/**
 * PlanItemDetailsModal Component
 * Modal for viewing and managing all details of a plan item (notes, assignment, etc.)
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Modal from '../Modal/Modal';
import PlanItemNotes from '../PlanItemNotes/PlanItemNotes';
import styles from './PlanItemDetailsModal.module.scss';
import { createSimpleFilter } from '../../utilities/trie';
import { logger } from '../../utilities/logger';

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
  onUpdateTitle,
  canEdit = false,
  // For mentions support
  availableEntities = [],
  entityData = {},
  // Initial tab to display when modal opens
  initialTab = 'notes',
  // Callback for when a plan item mention is clicked (to close modal and scroll)
  onPlanItemClick
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [isEditingAssignment, setIsEditingAssignment] = useState(false);
  const [assignmentSearch, setAssignmentSearch] = useState('');
  const [filteredCollaborators, setFilteredCollaborators] = useState([]);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleText, setTitleText] = useState('');
  const assignmentInputRef = useRef(null);
  const dropdownRef = useRef(null);
  const titleInputRef = useRef(null);

  // Reset to specified initial tab when modal opens or plan item changes
  useEffect(() => {
    if (show) {
      setActiveTab(initialTab);
      setIsEditingAssignment(false);
      setAssignmentSearch('');
      setIsEditingTitle(false);
      setTitleText(planItem?.text || '');
    }
  }, [show, planItem?._id, initialTab, planItem?.text]);

  // Focus title input when editing starts
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  // Handle title click to start editing
  const handleTitleClick = useCallback(() => {
    if (canEdit && onUpdateTitle) {
      setTitleText(planItem?.text || '');
      setIsEditingTitle(true);
    }
  }, [canEdit, onUpdateTitle, planItem?.text]);

  // Handle title blur to save
  const handleTitleBlur = useCallback(async () => {
    setIsEditingTitle(false);
    const trimmedTitle = titleText.trim();
    // Only save if title changed and is not empty
    if (trimmedTitle && trimmedTitle !== planItem?.text && onUpdateTitle) {
      try {
        await onUpdateTitle(trimmedTitle);
      } catch (error) {
        logger.error('[PlanItemDetailsModal] Failed to update title', { error });
        // Revert to original on error
        setTitleText(planItem?.text || '');
      }
    } else {
      // Revert to original if empty or unchanged
      setTitleText(planItem?.text || '');
    }
  }, [titleText, planItem?.text, onUpdateTitle]);

  // Handle title key events
  const handleTitleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      titleInputRef.current?.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setTitleText(planItem?.text || '');
      setIsEditingTitle(false);
    }
  }, [planItem?.text]);

  // Build trie index for fast collaborator search
  const collaboratorTrieFilter = useMemo(() => {
    if (!collaborators || collaborators.length === 0) return null;
    // Normalize collaborators to have a 'name' field for trie indexing
    const normalizedCollabs = collaborators.map(collab => ({
      ...collab,
      name: collab.name || collab.user?.name || ''
    }));
    return createSimpleFilter(['name']).buildIndex(normalizedCollabs);
  }, [collaborators]);

  // Filter collaborators based on search using trie
  useEffect(() => {
    if (assignmentSearch.trim() === '') {
      setFilteredCollaborators(collaborators);
    } else if (collaboratorTrieFilter) {
      // Use trie for O(m) filtering
      const filtered = collaboratorTrieFilter.filter(assignmentSearch, { rankResults: true });
      setFilteredCollaborators(filtered);
    } else {
      // Fallback to linear search
      const searchLower = assignmentSearch.toLowerCase();
      const filtered = collaborators.filter(collab => {
        const name = collab.name || collab.user?.name || '';
        return name.toLowerCase().includes(searchLower);
      });
      setFilteredCollaborators(filtered);
    }
    setHighlightedIndex(0);
  }, [assignmentSearch, collaborators, collaboratorTrieFilter]);

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

  /**
   * Handle entity click from mentions in notes
   * For plan-item mentions: close modal, update URL hash, and trigger scroll to item
   * For other mentions (destination, experience, user): close modal, let Link handle navigation
   */
  const handleEntityClick = useCallback((entityType, entityId, entity) => {
    logger.debug('[PlanItemDetailsModal] handleEntityClick called', { entityType, entityId, entity, hasOnPlanItemClick: !!onPlanItemClick });

    if (entityType === 'plan-item') {
      // Update URL hash for deep-link (same-page navigation)
      // This ensures the hash reflects the deep-linked plan item
      if (entity && entity.planId) {
        const hash = `#plan-${entity.planId}-item-${entityId}`;
        const newUrl = `${window.location.pathname}${window.location.search || ''}${hash}`;
        logger.debug('[PlanItemDetailsModal] Updating URL hash', { hash, newUrl });
        if (window.location.href !== newUrl) {
          window.history.pushState(null, '', newUrl);
        }
      }

      // Close modal first
      logger.debug('[PlanItemDetailsModal] Closing modal for plan-item');
      onClose();

      // Use requestAnimationFrame to ensure modal is fully closed before scrolling
      // This callback fires after React commits DOM changes and browser paints
      // Double-RAF ensures the modal portal is unmounted from the DOM
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          logger.debug('[PlanItemDetailsModal] RAF callback firing, calling onPlanItemClick', { entityId, entity });
          if (onPlanItemClick) {
            onPlanItemClick(entityId, entity);
          }
        });
      });
    } else {
      // For destination, experience, user mentions: close modal and let Link navigate
      logger.debug('[PlanItemDetailsModal] Closing modal for entity navigation', { entityType, entityId });
      onClose();
    }
  }, [onClose, onPlanItemClick]);

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

  // Editable title component - shows input when editing, clickable text otherwise
  const editableTitle = canEdit && onUpdateTitle ? (
    isEditingTitle ? (
      <input
        ref={titleInputRef}
        type="text"
        className={styles.titleInput}
        value={titleText}
        onChange={(e) => setTitleText(e.target.value)}
        onBlur={handleTitleBlur}
        onKeyDown={handleTitleKeyDown}
        aria-label="Edit plan item title"
      />
    ) : (
      <span
        className={styles.editableTitle}
        onClick={handleTitleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && handleTitleClick()}
        title="Click to edit title"
      >
        {planItem.text || 'Plan Item'}
      </span>
    )
  ) : (
    planItem.text || 'Plan Item'
  );

  return (
    <Modal
      show={show}
      onClose={onClose}
      title={editableTitle}
      size="fullscreen"
    >
      <div className={styles.planItemDetailsModal}>
        {/* Link to external URL if available */}
        {planItem.url && (
          <div className={styles.planItemLinkBar}>
            <a
              href={planItem.url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.planItemLink}
            >
              🔗 View Link
            </a>
          </div>
        )}

        {/* Assignment section */}
        <div className={styles.assignmentSection}>
          <label className={styles.assignmentLabel}>Assigned To:</label>
          {canEdit ? (
            <div className={styles.assignmentAutocompleteWrapper}>
              {!isEditingAssignment ? (
                <button
                  className={styles.assignmentLink}
                  onClick={handleAssignmentClick}
                  type="button"
                >
                  {getAssigneeName()}
                </button>
              ) : (
                <div className={styles.assignmentAutocomplete}>
                  <input
                    ref={assignmentInputRef}
                    type="text"
                    className={styles.assignmentInput}
                    placeholder="Search collaborators..."
                    value={assignmentSearch}
                    onChange={(e) => setAssignmentSearch(e.target.value)}
                    onKeyDown={handleKeyDown}
                  />
                  {(isEditingAssignment && (filteredCollaborators.length > 0 || assignmentSearch)) && (
                    <div ref={dropdownRef} className={styles.assignmentDropdown}>
                      <div
                        className={`${styles.assignmentOption} ${highlightedIndex === 0 ? styles.highlighted : ''}`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleUnassign();
                        }}
                        onMouseEnter={() => setHighlightedIndex(0)}
                      >
                        <span className={styles.assignmentOptionText}>-- Unassigned --</span>
                      </div>
                      {filteredCollaborators.map((collab, index) => {
                        const userId = collab._id || collab.user?._id;
                        const userName = collab.name || collab.user?.name || 'Unknown User';
                        return (
                          <div
                            key={userId}
                            className={`${styles.assignmentOption} ${highlightedIndex === index + 1 ? styles.highlighted : ''}`}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleSelectCollaborator(collab);
                            }}
                            onMouseEnter={() => setHighlightedIndex(index + 1)}
                          >
                            <span className={styles.assignmentOptionText}>{userName}</span>
                          </div>
                        );
                      })}
                      {filteredCollaborators.length === 0 && assignmentSearch && (
                        <div className={`${styles.assignmentOption} ${styles.disabled}`}>
                          <span className={styles.assignmentOptionText}>No collaborators found</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <span className={styles.assignmentValue}>{getAssigneeName()}</span>
          )}
        </div>

        {/* Tabs for different detail types */}
        <div className={styles.detailsTabs}>
          <button
            className={`${styles.detailsTab} ${activeTab === 'notes' ? styles.active : ''}`}
            onClick={() => setActiveTab('notes')}
            type="button"
          >
            📝 Notes {notes.length > 0 && `(${notes.length})`}
          </button>
          <button
            className={`${styles.detailsTab} ${styles.disabled}`}
            disabled
            type="button"
          >
            📍 Location
          </button>
          <button
            className={`${styles.detailsTab} ${styles.disabled}`}
            disabled
            type="button"
          >
            💬 Chat
          </button>
          <button
            className={`${styles.detailsTab} ${styles.disabled}`}
            disabled
            type="button"
          >
            📷 Photos
          </button>
          <button
            className={`${styles.detailsTab} ${styles.disabled}`}
            disabled
            type="button"
          >
            📄 Documents
          </button>
        </div>

        {/* Tab content */}
        <div className={styles.detailsContent}>
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
              onEntityClick={handleEntityClick}
            />
          )}

          {activeTab === 'location' && (
            <div className={styles.comingSoonMessage}>
              Location details will be available soon.
            </div>
          )}

          {activeTab === 'chat' && (
            <div className={styles.comingSoonMessage}>
              Chat functionality will be available soon.
            </div>
          )}

          {activeTab === 'photos' && (
            <div className={styles.comingSoonMessage}>
              Photo attachments will be available soon.
            </div>
          )}

          {activeTab === 'documents' && (
            <div className={styles.comingSoonMessage}>
              Document attachments will be available soon.
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

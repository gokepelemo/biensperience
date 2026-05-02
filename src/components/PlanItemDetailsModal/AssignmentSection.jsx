import { useId } from 'react';
import { createPortal } from 'react-dom';
import useAssignmentEditor from '../../hooks/useAssignmentEditor';
import { lang } from '../../lang.constants';
import { sanitizeUrl } from '../../utilities/sanitize';
import Button from '../Button/Button';
import styles from './PlanItemDetailsModal.module.css';

export default function AssignmentSection({
  planItem,
  canEdit,
  collaborators = [],
  onAssign,
  onUnassign,
  onToggleComplete,
}) {
  const assignmentListboxId = useId();
  const assignedTo = planItem.assignedTo;

  const {
    isEditingAssignment,
    assignmentSearch,
    setAssignmentSearch,
    filteredCollaborators,
    highlightedIndex,
    setHighlightedIndex,
    assignmentInputRef,
    dropdownRef,
    handleAssignmentClick,
    handleSelectCollaborator,
    handleUnassign,
    handleAssignmentKeyDown,
  } = useAssignmentEditor({
    collaborators,
    canEdit,
    onAssign,
    onUnassign,
  });

  const getAssigneeName = () => {
    if (!assignedTo) return lang.current.planItemDetailsModal.unassigned;

    const assigneeId = assignedTo._id || assignedTo;
    const assignee = collaborators.find(c => {
      const collabId = c._id || c.user?._id;
      return collabId === assigneeId;
    });

    return assignee?.name || assignee?.user?.name || lang.current.planItemDetailsModal.unknownUser;
  };

  return (
    <div className={styles.assignmentSection}>
      <label className={styles.assignmentLabel}>{lang.current.planItemDetailsModal.assignedTo}</label>
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
                placeholder={lang.current.planItemDetailsModal.searchCollaborators}
                value={assignmentSearch}
                onChange={(e) => setAssignmentSearch(e.target.value)}
                onKeyDown={handleAssignmentKeyDown}
                role="combobox"
                aria-expanded={isEditingAssignment}
                aria-controls={assignmentListboxId}
                aria-autocomplete="list"
                aria-activedescendant={`${assignmentListboxId}-opt-${highlightedIndex}`}
              />
              {(isEditingAssignment && (filteredCollaborators.length > 0 || assignmentSearch)) && createPortal(
                <div
                  ref={dropdownRef}
                  className={styles.assignmentDropdown}
                  id={assignmentListboxId}
                  role="listbox"
                >
                  <div
                    id={`${assignmentListboxId}-opt-0`}
                    role="option"
                    aria-selected={highlightedIndex === 0}
                    tabIndex={-1}
                    className={`${styles.assignmentOption} ${highlightedIndex === 0 ? styles.highlighted : ''}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleUnassign();
                    }}
                    onMouseEnter={() => setHighlightedIndex(0)}
                  >
                    <span className={styles.assignmentOptionText}>-- {lang.current.planItemDetailsModal.unassigned} --</span>
                  </div>
                  {filteredCollaborators.map((collab, index) => {
                    const userId = collab._id || collab.user?._id;
                    const userName = collab.name || collab.user?.name || lang.current.planItemDetailsModal.unknownUser;
                    const optIndex = index + 1;
                    return (
                      <div
                        key={userId}
                        id={`${assignmentListboxId}-opt-${optIndex}`}
                        role="option"
                        aria-selected={highlightedIndex === optIndex}
                        tabIndex={-1}
                        className={`${styles.assignmentOption} ${highlightedIndex === optIndex ? styles.highlighted : ''}`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleSelectCollaborator(collab);
                        }}
                        onMouseEnter={() => setHighlightedIndex(optIndex)}
                      >
                        <span className={styles.assignmentOptionText}>{userName}</span>
                      </div>
                    );
                  })}
                  {filteredCollaborators.length === 0 && assignmentSearch && (
                    <div className={`${styles.assignmentOption} ${styles.disabled}`} role="presentation">
                      <span className={styles.assignmentOptionText}>{lang.current.planItemDetailsModal.noCollaboratorsFound}</span>
                    </div>
                  )}
                </div>,
                document.body
              )}
            </div>
          )}
        </div>
      ) : (
        <span className={styles.assignmentValue}>{getAssigneeName()}</span>
      )}

      {/* Completion toggle - next to assignment */}
      {onToggleComplete && (
        <div className={styles.completionToggle}>
          <Button
            variant={planItem.complete ? 'success' : 'outline'}
            size="sm"
            onClick={() => onToggleComplete(planItem)}
            disabled={!canEdit}
            aria-pressed={!!planItem.complete}
            title={planItem.complete ? 'Mark as incomplete' : 'Mark as complete'}
            leftIcon={<span>{planItem.complete ? '✓' : '○'}</span>}
            className={styles.completeButton}
          >
            {planItem.complete ? lang.current.planItemDetailsModal.completed : lang.current.planItemDetailsModal.markComplete}
          </Button>
        </div>
      )}

      {/* Link to external URL if available */}
      {planItem.url && (() => {
        const safeUrl = sanitizeUrl(planItem.url);
        return safeUrl ? (
          <div className={styles.completionToggle}>
            <Button
              as="a"
              href={safeUrl}
              target="_blank"
              rel="noopener noreferrer"
              variant="outline"
              size="sm"
              title="Open external link"
              leftIcon={<span>🔗</span>}
            >
              View Link
            </Button>
          </div>
        ) : null;
      })()}
    </div>
  );
}

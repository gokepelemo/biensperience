import { useState, useCallback, useId } from 'react';
import PropTypes from 'prop-types';
import { FaCheckCircle, FaRegCircle } from 'react-icons/fa';
import { Modal, Alert } from '../design-system';
import Checkbox from '../Checkbox/Checkbox';
import { sanitizeText } from '../../utilities/sanitize';
import { logger } from '../../utilities/logger';
import styles from './IncompleteChildrenDialog.module.css';

/**
 * IncompleteChildrenDialog
 *
 * Shown when a user tries to mark a parent plan item as complete
 * but some child items are still incomplete. Displays the incomplete
 * children and lets the user mark them complete in-place.
 *
 * When the last child item is marked complete, a follow-up prompt
 * asks whether the parent should also be marked complete.
 *
 * @param {Object} props
 * @param {boolean} props.show - Whether to show the dialog
 * @param {Function} props.onClose - Called when the dialog is dismissed
 * @param {Object} props.parentItem - The parent plan item the user tried to complete
 * @param {Object[]} props.incompleteChildren - Child items that are not yet complete
 * @param {Function} props.onToggleChildComplete - (childItem) => Promise<void> — marks a child item complete
 * @param {Function} props.onCompleteParent - () => Promise<void> — marks the parent item complete
 * @param {Object} props.lang - Language constants
 */
export default function IncompleteChildrenDialog({
  show,
  onClose,
  parentItem,
  incompleteChildren: initialIncompleteChildren,
  onToggleChildComplete,
  onCompleteParent,
  lang,
}) {
  const dialogId = useId();
  // Track which children have been marked complete inside this dialog
  const [completedInDialog, setCompletedInDialog] = useState(new Set());
  // Whether to show the "complete parent?" prompt
  const [showParentPrompt, setShowParentPrompt] = useState(false);
  // Loading state for individual toggles
  const [togglingId, setTogglingId] = useState(null);
  // Loading state for parent completion
  const [completingParent, setCompletingParent] = useState(false);

  const remainingIncomplete = initialIncompleteChildren.filter(
    (child) => !completedInDialog.has((child._id || child.plan_item_id)?.toString())
  );

  const handleToggleChild = useCallback(
    async (childItem) => {
      const childId = (childItem._id || childItem.plan_item_id)?.toString();
      if (!childId || togglingId) return;

      setTogglingId(childId);
      try {
        await onToggleChildComplete(childItem);

        const nextCompleted = new Set(completedInDialog);
        nextCompleted.add(childId);
        setCompletedInDialog(nextCompleted);

        // Check if this was the last incomplete child
        const stillIncomplete = initialIncompleteChildren.filter(
          (c) => !nextCompleted.has((c._id || c.plan_item_id)?.toString())
        );

        if (stillIncomplete.length === 0) {
          // All children now complete — prompt for parent
          setShowParentPrompt(true);
        }
      } catch (err) {
        logger.error('[IncompleteChildrenDialog] Failed to toggle child', err);
      } finally {
        setTogglingId(null);
      }
    },
    [completedInDialog, initialIncompleteChildren, onToggleChildComplete, togglingId]
  );

  const handleCompleteParent = useCallback(async () => {
    setCompletingParent(true);
    try {
      await onCompleteParent();
      onClose();
    } catch (err) {
      logger.error('[IncompleteChildrenDialog] Failed to complete parent', err);
    } finally {
      setCompletingParent(false);
    }
  }, [onCompleteParent, onClose]);

  const handleClose = useCallback(() => {
    setCompletedInDialog(new Set());
    setShowParentPrompt(false);
    onClose();
  }, [onClose]);

  if (!parentItem) return null;

  // ── Parent-prompt view (all children complete) ──────────────────────
  if (showParentPrompt) {
    const parentPromptFooter = (
      <div className={styles.footerActions}>
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={handleClose}
          disabled={completingParent}
        >
          {lang.current.button?.notNow || 'Not Now'}
        </button>
        <button
          type="button"
          className="btn btn-success"
          onClick={handleCompleteParent}
          disabled={completingParent}
        >
          {completingParent
            ? (lang.current.button?.completing || 'Completing…')
            : (lang.current.button?.markComplete || '👍 Complete')}
        </button>
      </div>
    );

    return (
      <Modal
        show={show}
        onClose={handleClose}
        title={lang.current.dialog?.allChildrenComplete || 'All items complete!'}
        footer={parentPromptFooter}
        centered
        showSubmitButton={false}
        size="sm"
      >
        <div className={styles.parentPrompt}>
          <FaCheckCircle className={styles.parentPromptIcon} />
          <p className={styles.parentPromptText}>
            {lang.current.dialog?.markParentCompleteQuestion
              || 'All child items are now complete. Would you like to mark'}
            {' '}<strong>&ldquo;{sanitizeText(parentItem.text)}&rdquo;</strong>{' '}
            {lang.current.dialog?.asComplete || 'as complete too?'}
          </p>
        </div>
      </Modal>
    );
  }

  // ── Incomplete-children list view ───────────────────────────────────
  const blockerFooter = (
    <div className={styles.footerActions}>
      <button
        type="button"
        className="btn btn-outline-secondary"
        onClick={handleClose}
      >
        {lang.current.button?.close || 'Close'}
      </button>
    </div>
  );

  return (
    <Modal
      show={show}
      onClose={handleClose}
      title={lang.current.dialog?.incompleteChildItems || 'Incomplete Child Items'}
      footer={blockerFooter}
      centered
      showSubmitButton={false}
      size="sm"
      scrollable
    >
      <div className={styles.container}>
        <Alert type="warning" className={styles.alert}>
          {lang.current.dialog?.completeChildrenFirst
            || 'Complete all child items before marking the parent complete.'}
        </Alert>

        <p className={styles.parentLabel}>
          <FaRegCircle className={styles.parentIcon} />
          <strong>{sanitizeText(parentItem.text)}</strong>
        </p>

        <ul className={styles.childList} role="list">
          {initialIncompleteChildren.map((child) => {
            const childId = (child._id || child.plan_item_id)?.toString();
            const justCompleted = completedInDialog.has(childId);
            const isToggling = togglingId === childId;

            return (
              <li
                key={childId}
                className={`${styles.childItem} ${justCompleted ? styles.childItemDone : ''}`}
              >
                <Checkbox
                  id={`${dialogId}-child-${childId}`}
                  checked={justCompleted}
                  onChange={() => handleToggleChild(child)}
                  disabled={justCompleted || isToggling}
                  size="sm"
                  className={styles.childCheckbox}
                />
                <span className={`${styles.childText} ${justCompleted ? styles.childTextDone : ''}`}>
                  {sanitizeText(child.text)}
                </span>
                {isToggling && <span className={styles.spinner} />}
              </li>
            );
          })}
        </ul>

        {remainingIncomplete.length > 0 && (
          <p className={styles.remaining}>
            {remainingIncomplete.length}{' '}
            {remainingIncomplete.length === 1
              ? (lang.current.dialog?.itemRemaining || 'item remaining')
              : (lang.current.dialog?.itemsRemaining || 'items remaining')}
          </p>
        )}
      </div>
    </Modal>
  );
}

IncompleteChildrenDialog.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  parentItem: PropTypes.object,
  incompleteChildren: PropTypes.array.isRequired,
  onToggleChildComplete: PropTypes.func.isRequired,
  onCompleteParent: PropTypes.func.isRequired,
  lang: PropTypes.object.isRequired,
};

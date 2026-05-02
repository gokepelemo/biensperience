import useTitleEditor from '../../hooks/useTitleEditor';
import { lang } from '../../lang.constants';
import styles from './PlanItemDetailsModal.module.css';

export default function EditableTitle({ planItem, canEdit, onUpdateTitle }) {
  const {
    isEditingTitle,
    titleText,
    setTitleText,
    titleInputRef,
    handleTitleClick,
    handleTitleBlur,
    handleTitleKeyDown,
  } = useTitleEditor(planItem, canEdit, onUpdateTitle);

  const titleFallback = planItem?.text || 'Plan Item';

  if (!canEdit || !onUpdateTitle) {
    return titleFallback;
  }

  if (isEditingTitle) {
    return (
      <input
        ref={titleInputRef}
        type="text"
        className={styles.titleInput}
        value={titleText}
        onChange={(e) => setTitleText(e.target.value)}
        onBlur={handleTitleBlur}
        onKeyDown={handleTitleKeyDown}
        aria-label={lang.current.aria.editPlanItemTitle}
      />
    );
  }

  return (
    <span
      className={styles.editableTitle}
      onClick={handleTitleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleTitleClick()}
      title={lang.current.tooltip.clickToEditTitle}
    >
      {titleFallback}
    </span>
  );
}

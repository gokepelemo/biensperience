/**
 * DragHandle Component
 * Presentational drag handle icon for reordering plan items
 * Parent component should provide drag listeners via wrapper div
 * Only visible to owners, collaborators, and super admins
 */

import { lang } from '../../lang.constants';
import styles from './DragHandle.module.scss';

export default function DragHandle({ isDragging = false, disabled = false }) {
  if (disabled) {
    return null; // Don't render handle if user doesn't have permission
  }

  return (
    <div
      className={`${styles.dragHandle} ${isDragging ? styles.dragging : ''}`}
      aria-label={lang.current.dragHandle.dragToReorder}
      title={lang.current.dragHandle.dragInstructions}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Six dots arranged in 2 columns */}
        <circle cx="6" cy="5" r="1.5" fill="currentColor" />
        <circle cx="14" cy="5" r="1.5" fill="currentColor" />
        <circle cx="6" cy="10" r="1.5" fill="currentColor" />
        <circle cx="14" cy="10" r="1.5" fill="currentColor" />
        <circle cx="6" cy="15" r="1.5" fill="currentColor" />
        <circle cx="14" cy="15" r="1.5" fill="currentColor" />
      </svg>
    </div>
  );
}

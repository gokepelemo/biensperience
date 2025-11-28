/**
 * DragHandle Component
 * Presentational drag handle icon for reordering plan items
 * Parent component should provide drag listeners via wrapper div
 * Only visible to owners, collaborators, and super admins
 */

import styles from './DragHandle.module.scss';

export default function DragHandle({ isDragging = false, disabled = false }) {
  if (disabled) {
    return null; // Don't render handle if user doesn't have permission
  }

  return (
    <div
      className={`${styles.dragHandle} ${isDragging ? styles.dragging : ''}`}
      aria-label="Drag to reorder"
      title="Drag left to promote, right to nest, up/down to reorder"
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

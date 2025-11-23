/**
 * DragHandle Component
 * Draggable handle for reordering plan items
 * Only visible to owners, collaborators, and super admins
 */

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import styles from './DragHandle.module.scss';

export default function DragHandle({ id, disabled = false }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  if (disabled) {
    return null; // Don't render handle if user doesn't have permission
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.dragHandle} ${isDragging ? styles.dragging : ''}`}
      {...attributes}
      {...listeners}
      aria-label="Drag to reorder"
      title="Drag to reorder"
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

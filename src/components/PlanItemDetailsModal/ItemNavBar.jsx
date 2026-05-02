import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import styles from './PlanItemDetailsModal.module.css';

export default function ItemNavBar({ onPrev, onNext }) {
  if (!onPrev && !onNext) return null;

  return (
    <div className={styles.itemNavigation}>
      <button
        type="button"
        className={styles.itemNavBtn}
        onClick={onPrev}
        disabled={!onPrev}
        aria-label="Previous plan item"
        title="Previous item (← arrow key)"
      >
        <FaChevronLeft />
      </button>
      <span className={styles.itemNavHint}>Use arrow keys or swipe to navigate</span>
      <button
        type="button"
        className={styles.itemNavBtn}
        onClick={onNext}
        disabled={!onNext}
        aria-label="Next plan item"
        title="Next item (→ arrow key)"
      >
        <FaChevronRight />
      </button>
    </div>
  );
}

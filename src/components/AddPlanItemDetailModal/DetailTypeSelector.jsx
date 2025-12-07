/**
 * DetailTypeSelector Component
 * Step 1 of AddPlanItemDetailModal - Select the type of detail to add
 */

import PropTypes from 'prop-types';
import styles from './AddPlanItemDetailModal.module.scss';
import { DETAIL_TYPES, DETAIL_TYPE_CONFIG } from './constants';

/**
 * Group detail types by category for better organization
 */
const DETAIL_CATEGORIES = {
  expense: {
    label: 'Expenses',
    types: [DETAIL_TYPES.COST]
  },
  transport: {
    label: 'Transportation',
    types: [
      DETAIL_TYPES.FLIGHT,
      DETAIL_TYPES.TRAIN,
      DETAIL_TYPES.CRUISE,
      DETAIL_TYPES.FERRY,
      DETAIL_TYPES.BUS
    ]
  },
  accommodation: {
    label: 'Accommodation',
    types: [DETAIL_TYPES.HOTEL]
  },
  other: {
    label: 'Other',
    types: [DETAIL_TYPES.PARKING, DETAIL_TYPES.DISCOUNT]
  }
};

export default function DetailTypeSelector({ onSelect, selectedType }) {
  return (
    <div className={styles.typeSelector}>
      <p className={styles.typeSelectorHint}>
        Select the type of detail you want to add to this plan item.
      </p>

      {Object.entries(DETAIL_CATEGORIES).map(([categoryKey, category]) => (
        <div key={categoryKey} className={styles.typeCategory}>
          <h4 className={styles.categoryLabel}>{category.label}</h4>
          <div className={styles.typeGrid}>
            {category.types.map((type) => {
              const config = DETAIL_TYPE_CONFIG[type];
              if (!config) return null;

              return (
                <button
                  key={type}
                  type="button"
                  className={`${styles.typeCard} ${selectedType === type ? styles.selected : ''}`}
                  onClick={() => onSelect(type)}
                  aria-pressed={selectedType === type}
                >
                  <span className={styles.typeIcon}>{config.icon}</span>
                  <span className={styles.typeLabel}>{config.label}</span>
                  <span className={styles.typeDescription}>{config.description}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

DetailTypeSelector.propTypes = {
  onSelect: PropTypes.func.isRequired,
  selectedType: PropTypes.string
};

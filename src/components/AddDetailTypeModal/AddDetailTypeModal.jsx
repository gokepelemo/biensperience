/**
 * AddDetailTypeModal Component
 * A responsive modal showing all available detail types to add to a plan item.
 * Each type is displayed as an icon with label. Clicking selects the type and
 * closes this modal to open the appropriate add modal.
 */

import PropTypes from 'prop-types';
import Modal from '../Modal/Modal';
import { DETAIL_TYPES, DETAIL_TYPE_CONFIG } from '../AddPlanItemDetailModal/constants';
import styles from './AddDetailTypeModal.module.scss';
import { lang } from '../../lang.constants';

/**
 * Group detail types by category for better organization
 */
const DETAIL_CATEGORIES = {
  scheduling: {
    label: 'Scheduling',
    types: [DETAIL_TYPES.DATE]
  },
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

export default function AddDetailTypeModal({
  show,
  onClose,
  onSelectType
}) {
  const handleTypeSelect = (type) => {
    onClose();
    if (onSelectType) {
      onSelectType(type);
    }
  };

  return (
    <Modal
      show={show}
      onClose={onClose}
      title={lang.current.modal?.addDetail || 'Add Detail'}
      size="lg"
      centered
    >
      <div className={styles.addDetailTypeModal}>
        <p className={styles.hint}>
          {lang.current.planItemDetailsModal?.selectDetailTypeHint || 'Select the type of detail you want to add'}
        </p>

        {Object.entries(DETAIL_CATEGORIES).map(([categoryKey, category]) => (
          <div key={categoryKey} className={styles.category}>
            <h4 className={styles.categoryLabel}>{category.label}</h4>
            <div className={styles.typeGrid}>
              {category.types.map((type) => {
                const config = DETAIL_TYPE_CONFIG[type];
                if (!config) return null;

                return (
                  <button
                    key={type}
                    type="button"
                    className={styles.typeCard}
                    onClick={() => handleTypeSelect(type)}
                    aria-label={`Add ${config.label}`}
                  >
                    <span className={styles.typeIcon}>{config.icon}</span>
                    <span className={styles.typeLabel}>{config.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

AddDetailTypeModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSelectType: PropTypes.func.isRequired
};

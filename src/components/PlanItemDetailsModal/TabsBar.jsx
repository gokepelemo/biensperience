import { FaChevronDown } from 'react-icons/fa';
import { Dropdown } from '../design-system';
import { lang } from '../../lang.constants';
import styles from './PlanItemDetailsModal.module.css';

const POPPER_CONFIG = {
  strategy: 'fixed',
  modifiers: [
    {
      name: 'preventOverflow',
      options: { boundary: 'viewport' },
    },
  ],
};

export default function TabsBar({
  activeTab,
  onChange,
  totalDetailsCount,
  notesCount,
  hasLocation,
}) {
  const labels = lang.current.planItemDetailsModal;
  const tabOptions = [
    { key: 'details', label: labels.tabDetails, badge: totalDetailsCount > 0 ? `(${totalDetailsCount})` : null },
    { key: 'notes', label: labels.tabNotes, badge: notesCount > 0 ? `(${notesCount})` : null },
    { key: 'location', label: labels.tabLocation, badge: hasLocation ? '✓' : null },
    { key: 'chat', label: labels.tabChat, badge: null },
    { key: 'photos', label: labels.tabPhotos, badge: null },
    { key: 'documents', label: labels.tabDocuments, badge: null },
  ];

  const activeOption = tabOptions.find((opt) => opt.key === activeTab) || tabOptions[0];

  return (
    <>
      {/* Desktop: Traditional tab buttons */}
      <div className={styles.detailsTabs} role="tablist" aria-label="Plan item details tabs">
        {tabOptions.map((opt) => (
          <button
            key={opt.key}
            id={`tab-${opt.key}`}
            role="tab"
            aria-selected={activeTab === opt.key}
            aria-controls={`tabpanel-${opt.key}`}
            className={`${styles.detailsTab} ${activeTab === opt.key ? styles.active : ''}`}
            onClick={() => onChange(opt.key)}
            type="button"
          >
            {opt.label} {opt.badge}
          </button>
        ))}
      </div>

      {/* Mobile/Tablet: Dropdown selector */}
      <div className={styles.tabsDropdownWrapper}>
        <Dropdown onSelect={(key) => onChange(key)} className={styles.tabsDropdown}>
          <Dropdown.Toggle variant="outline-secondary" className={styles.tabsDropdownToggle}>
            <span className={styles.tabsDropdownLabel}>
              {activeOption.label} {activeOption.badge}
            </span>
            <FaChevronDown className={styles.tabsDropdownIcon} />
          </Dropdown.Toggle>
          <Dropdown.Menu
            className={styles.tabsDropdownMenu}
            renderOnMount
            popperConfig={POPPER_CONFIG}
          >
            {tabOptions.map((opt) => (
              <Dropdown.Item
                key={opt.key}
                eventKey={opt.key}
                active={activeTab === opt.key}
                className={styles.tabsDropdownItem}
              >
                {opt.label} {opt.badge}
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </Dropdown>
      </div>
    </>
  );
}

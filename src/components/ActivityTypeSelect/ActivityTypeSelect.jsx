/**
 * ActivityTypeSelect
 *
 * Searchable activity type dropdown used in PlanItemModal.
 * Implemented on top of the shared SearchableSelect component so the menu
 * is correctly anchored and usable inside modals.
 */

import SearchableSelect from '../FormField/SearchableSelect';
import { ACTIVITY_CATEGORIES, ACTIVITY_TYPES } from '../../constants/activity-types';
import styles from './ActivityTypeSelect.module.scss';

export default function ActivityTypeSelect({
  value,
  onChange,
  placeholder = 'Select activity type...',
  disabled = false,
  size = 'md',
  className = '',
  showClear = true,
  id,
  name,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
}) {
  const options = [
    ...(showClear ? [{ value: '', label: 'No activity type' }] : []),
    ...ACTIVITY_TYPES.map((t) => {
      const catLabel = ACTIVITY_CATEGORIES?.[t.category]?.label || t.category;
      return {
        value: t.value,
        label: `${t.icon} ${t.label}`,
        suffix: catLabel,
      };
    }),
  ];

  return (
    <div className={`${styles.activityTypeSelect} ${className}`.trim()}>
      <SearchableSelect
        id={id}
        name={name}
        options={options}
        value={value || ''}
        onChange={(next) => onChange(next ? next : null)}
        placeholder={placeholder}
        searchable
        disabled={disabled}
        size={size}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
      />
    </div>
  );
}

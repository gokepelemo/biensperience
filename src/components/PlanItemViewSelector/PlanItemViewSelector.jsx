/**
 * PlanItemViewSelector
 *
 * A compact dropdown for switching between plan item view modes
 * (card, compact, activity, timeline). Renders a trigger button showing the
 * current option with its icon, and opens a list of options on click.
 * Self-contained — does not depend on SearchableSelect or Chakra Combobox.
 */

import { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { FaChevronDown } from 'react-icons/fa';
import styles from './PlanItemViewSelector.module.css';

export default function PlanItemViewSelector({
  options,
  value,
  onChange,
  size = 'sm',
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const selected = options.find(o => o.value === value) || options[0];
  const sizeClass = styles[`size${size.charAt(0).toUpperCase() + size.slice(1)}`];

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const SelectedIcon = selected?.icon;

  return (
    <div
      ref={containerRef}
      className={[styles.container, sizeClass, className].filter(Boolean).join(' ')}
    >
      <button
        type="button"
        className={[styles.trigger, isOpen && styles.open].filter(Boolean).join(' ')}
        onClick={() => setIsOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="View mode"
      >
        {SelectedIcon && <SelectedIcon className={styles.triggerIcon} aria-hidden="true" />}
        <span className={styles.triggerLabel}>{selected?.label ?? 'View'}</span>
        <FaChevronDown className={[styles.chevron, isOpen && styles.chevronOpen].filter(Boolean).join(' ')} />
      </button>

      {isOpen && (
        <ul className={styles.dropdown} role="listbox" aria-label="View mode">
          {options.map((opt) => {
            const Icon = opt.icon;
            const isSelected = opt.value === value;
            return (
              <li
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                className={[styles.option, isSelected && styles.selected].filter(Boolean).join(' ')}
                onMouseDown={() => { onChange(opt.value); setIsOpen(false); }}
              >
                {Icon && <Icon className={styles.optionIcon} aria-hidden="true" />}
                <span className={styles.optionLabel}>{opt.label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

PlanItemViewSelector.propTypes = {
  options: PropTypes.arrayOf(PropTypes.shape({
    value: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    icon: PropTypes.elementType,
  })).isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  className: PropTypes.string,
};

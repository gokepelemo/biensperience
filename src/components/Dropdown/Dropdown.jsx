import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import styles from './Dropdown.module.scss';

/**
 * Dropdown - accessible select-like component with optional search and left icons
 *
 * Props:
 * - id, label, placeholder
 * - options: [{ value, label, icon, code }] where `icon` can be:
 *     - React node (preferred)
 *     - string: a FontAwesome class (e.g. 'fa fa-flag')
 *     - string starting with 'flag:' indicating a country code for flag classes (e.g. 'flag:us')
 * - value, onChange
 * - searchable: show an input to filter options
 * - size: 'sm'|'md'|'lg'
 */
export default function Dropdown({
  id,
  label,
  placeholder = '',
  options = [],
  value,
  onChange,
  searchable = true,
  size = 'md',
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [highlight, setHighlight] = useState(-1);
  const containerRef = useRef(null);

  useEffect(() => {
    function onDoc(e) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target)) {
        setOpen(false);
        setHighlight(-1);
      }
    }
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  const selected = options.find(o => String(o.value) === String(value)) || null;

  const visible = filter && filter.trim()
    ? options.filter(o => (o.label || '').toLowerCase().includes(filter.toLowerCase()))
    : options;

  function toggle() {
    setOpen(o => !o);
    if (!open) setTimeout(() => { const el = containerRef.current?.querySelector('input'); if (el) el.focus(); }, 0);
  }

  function handleSelect(opt) {
    setOpen(false);
    setFilter('');
    setHighlight(-1);
    if (onChange) onChange(opt.value);
  }

  function renderLeftIcon(opt) {
    if (!opt) return null;
    if (React.isValidElement(opt.icon)) return <span className={styles.icon}>{opt.icon}</span>;
    if (typeof opt.icon === 'string') {
      if (opt.icon.startsWith('flag:')) {
        const code = opt.icon.split(':')[1];
        // country-flag-icons use classes like 'flag-icon flag-icon-us' in some packages
        return <span className={`${styles.flag} flag-icon flag-icon-${code?.toLowerCase()}`} aria-hidden="true" />;
      }
      return <i className={`${opt.icon} ${styles.icon}`} aria-hidden="true" />;
    }
    return null;
  }

  return (
    <div className={`${styles.container} ${styles[`size-${size}`]}`} ref={containerRef}>
      {label && <label htmlFor={id} className={styles.label}>{label}</label>}

      <div className={styles.control} onClick={toggle} role="button" tabIndex={0} aria-haspopup="listbox" aria-expanded={open}>
        <div className={styles.value}>
          {selected ? (
            <>
              {renderLeftIcon(selected)}
              <span className={styles.valueLabel}>{selected.label}</span>
            </>
          ) : (
            <span className={styles.placeholder}>{placeholder}</span>
          )}
        </div>
        <div className={styles.caret} aria-hidden="true">▾</div>
      </div>

      {open && (
        <div className={styles.popup} role="listbox" aria-labelledby={id}>
          {searchable && (
            <div className={styles.searchRow}>
              <input
                type="search"
                placeholder="Search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className={styles.searchInput}
                aria-label="Search options"
              />
            </div>
          )}

          <ul className={styles.optionList}>
            {visible.length === 0 && <li className={styles.empty}>No results</li>}
            {visible.map((opt, idx) => (
              <li
                key={opt.value}
                role="option"
                aria-selected={String(opt.value) === String(value)}
                className={`${styles.option} ${String(opt.value) === String(value) ? styles.selected : ''} ${idx === highlight ? styles.highlight : ''}`}
                onClick={() => handleSelect(opt)}
                onMouseEnter={() => setHighlight(idx)}
              >
                <div className={styles.optionLeft}>
                  {renderLeftIcon(opt)}
                  <span className={styles.optionLabel}>{opt.label}</span>
                </div>
                {opt.code && <div className={styles.optionCode}>{opt.code}</div>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

Dropdown.propTypes = {
  id: PropTypes.string,
  label: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  placeholder: PropTypes.string,
  options: PropTypes.arrayOf(PropTypes.shape({ value: PropTypes.any, label: PropTypes.string, icon: PropTypes.any, code: PropTypes.string })),
  value: PropTypes.any,
  onChange: PropTypes.func,
  searchable: PropTypes.bool,
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
};

export { Dropdown };

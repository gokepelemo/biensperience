/**
 * ActivityTypeSelect Component
 *
 * Simple dropdown select for activity types.
 * Minimal implementation for maximum stability.
 */

import { useState, useRef, useEffect } from 'react';
import { ACTIVITY_TYPES, getActivityType } from '../../constants/activity-types';
import styles from './ActivityTypeSelect.module.scss';

export default function ActivityTypeSelect({
  value,
  onChange,
  placeholder = 'Select activity type...',
  disabled = false,
  size = 'md',
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const searchRef = useRef(null);

  // Get currently selected type
  const selectedType = value ? getActivityType(value) : null;

  // Filter types by search term
  const visibleTypes = search.trim()
    ? ACTIVITY_TYPES.filter(t => {
        const s = search.toLowerCase();
        return t.label.toLowerCase().includes(s) ||
               t.value.toLowerCase().includes(s) ||
               (t.keywords && t.keywords.some(k => k.toLowerCase().includes(s)));
      })
    : ACTIVITY_TYPES;

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;

    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearch('');
      }
    }

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  // Focus search when opening
  useEffect(() => {
    if (isOpen && searchRef.current) {
      searchRef.current.focus();
    }
  }, [isOpen]);

  function handleToggle() {
    if (disabled) return;
    setIsOpen(!isOpen);
    if (isOpen) setSearch('');
  }

  function handleSelect(typeValue) {
    onChange(typeValue);
    setIsOpen(false);
    setSearch('');
  }

  function handleClear(e) {
    e.stopPropagation();
    onChange(null);
  }

  return (
    <div ref={containerRef} className={`${styles.activityTypeSelect} ${styles[size]} ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        className={styles.trigger}
        onClick={handleToggle}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {selectedType ? (
          <span className={styles.selected}>
            <span className={styles.icon}>{selectedType.icon}</span>
            <span className={styles.label}>{selectedType.label}</span>
          </span>
        ) : (
          <span className={styles.placeholder}>{placeholder}</span>
        )}
        <span className={styles.controls}>
          {selectedType && !disabled && (
            <span className={styles.clear} onClick={handleClear} role="button" tabIndex={-1}>×</span>
          )}
          <svg className={styles.caret} width="12" height="12" viewBox="0 0 12 12">
            <path d="M2 4L6 8L10 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </span>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className={styles.dropdown}>
          <input
            ref={searchRef}
            type="text"
            className={styles.search}
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className={styles.list}>
            {visibleTypes.length === 0 ? (
              <div className={styles.empty}>No matches</div>
            ) : (
              visibleTypes.map(type => (
                <div
                  key={type.value}
                  className={`${styles.option} ${type.value === value ? styles.active : ''}`}
                  onClick={() => handleSelect(type.value)}
                >
                  <span className={styles.optionIcon}>{type.icon}</span>
                  <span className={styles.optionLabel}>{type.label}</span>
                  {type.value === value && <span className={styles.check}>✓</span>}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * PlanItemDetailsButton Component
 * Dropdown button for adding details to a plan item (notes, location, chat, photos, documents)
 */

import { useState, useRef, useEffect } from 'react';
import './PlanItemDetailsButton.css';

export default function PlanItemDetailsButton({ onSelectDetailType, disabled = false }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [dropdownOpen]);

  const handleOptionClick = (detailType) => {
    setDropdownOpen(false);
    onSelectDetailType(detailType);
  };

  const detailOptions = [
    { type: 'note', label: '📝 Add Note', icon: '📝' },
    { type: 'location', label: '📍 Add Location', icon: '📍', disabled: true }, // Future feature
    { type: 'chat', label: '💬 Add Chat', icon: '💬', disabled: true }, // Future feature
    { type: 'photo', label: '📷 Add Photo', icon: '📷', disabled: true }, // Future feature
    { type: 'document', label: '📄 Add Document', icon: '📄', disabled: true } // Future feature
  ];

  return (
    <div ref={dropdownRef} className="plan-item-details-button-container">
      <button
        className="plan-item-details-button"
        onClick={(e) => {
          e.stopPropagation();
          setDropdownOpen(!dropdownOpen);
        }}
        disabled={disabled}
        type="button"
        aria-label="Add details to plan item"
        aria-expanded={dropdownOpen}
      >
        ✚ Add
      </button>

      {dropdownOpen && (
        <div className="plan-item-details-dropdown">
          {detailOptions.map((option) => (
            <button
              key={option.type}
              className={`plan-item-details-option ${option.disabled ? 'disabled' : ''}`}
              onClick={() => !option.disabled && handleOptionClick(option.type)}
              disabled={option.disabled}
              type="button"
            >
              <span className="option-icon">{option.icon}</span>
              <span className="option-label">{option.label.replace(/^.+ /, '')}</span>
              {option.disabled && <span className="coming-soon">(Coming Soon)</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

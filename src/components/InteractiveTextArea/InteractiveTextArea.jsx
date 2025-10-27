/**
 * InteractiveTextArea component with mentions support
 * Allows mentioning users, destinations, and experiences with interactive popovers
 *
 * @module InteractiveTextArea
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Form, Dropdown } from 'react-bootstrap';
import {
  createMention,
  MENTION_TYPES
} from '../../utilities/mentions';
import './InteractiveTextArea.css';

/**
 * Interactive TextArea with mentions support
 *
 * @param {Object} props
 * @param {string} props.value - Current text value
 * @param {Function} props.onChange - Change handler
 * @param {string} props.placeholder - Placeholder text
 * @param {number} props.rows - Number of rows
 * @param {string} props.visibility - Current visibility setting
 * @param {Function} props.onVisibilityChange - Visibility change handler
 * @param {Array} props.availableEntities - Available entities for mentions
 * @param {Object} props.entityData - Map of entityId -> entity data for popovers
 * @param {boolean} props.disabled - Whether the textarea is disabled
 * @param {string} props.className - Additional CSS classes
 */
const InteractiveTextArea = ({
  value = '',
  onChange,
  placeholder = 'Type your message... Use @ to mention users, destinations, or experiences',
  rows = 4,
  visibility = 'public',
  onVisibilityChange,
  availableEntities = [],
  entityData = {},
  disabled = false,
  className = '',
  ...props
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [mentionStart, setMentionStart] = useState(-1);
  const textareaRef = useRef(null);

  const visibilityOptions = [
    { value: 'public', label: 'Public', icon: '🌐' },
    { value: 'contributors', label: 'Contributors Only', icon: '👥' },
    { value: 'private', label: 'Private', icon: '🔒' }
  ];

  /**
   * Handle textarea input changes
   */
  const handleInputChange = useCallback((e) => {
    const newValue = e.target.value;
    const newCursorPosition = e.target.selectionStart;

    setCursorPosition(newCursorPosition);

    // Check for mention trigger (@)
    const textBeforeCursor = newValue.slice(0, newCursorPosition);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      const query = mentionMatch[1].toLowerCase();
      setMentionStart(newCursorPosition - query.length - 1);

      // Filter available entities based on query
      const filteredEntities = availableEntities.filter(entity =>
        entity.displayName.toLowerCase().includes(query) ||
        entity.type.toLowerCase().includes(query)
      );

      setSuggestions(filteredEntities.slice(0, 5)); // Limit to 5 suggestions
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
      setMentionStart(-1);
    }

    onChange(newValue);
  }, [onChange, availableEntities]);

  /**
   * Handle mention selection from suggestions
   */
  const handleMentionSelect = useCallback((entity) => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const mentionText = createMention(entity.type, entity.id);
    const textBeforeMention = value.slice(0, mentionStart);
    const textAfterCursor = value.slice(cursorPosition);

    const newText = textBeforeMention + mentionText + ' ' + textAfterCursor;
    const newCursorPosition = textBeforeMention.length + mentionText.length + 1;

    onChange(newText);

    // Update cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPosition, newCursorPosition);
    }, 0);

    setShowSuggestions(false);
    setMentionStart(-1);
  }, [value, mentionStart, cursorPosition, onChange]);

  /**
   * Handle keyboard navigation in suggestions
   */
  const handleKeyDown = useCallback((e) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === 'Escape') {
      setShowSuggestions(false);
      setMentionStart(-1);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      // Could implement arrow key navigation for suggestions
    } else if (e.key === 'Enter' && suggestions.length === 1) {
      e.preventDefault();
      handleMentionSelect(suggestions[0]);
    }
  }, [showSuggestions, suggestions, handleMentionSelect]);

  /**
   * Handle clicks outside to close suggestions
   */
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (textareaRef.current && !textareaRef.current.contains(event.target)) {
        setShowSuggestions(false);
        setMentionStart(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`interactive-textarea ${className}`}>
      <Form.Control
        ref={textareaRef}
        as="textarea"
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className="interactive-textarea-input"
        {...props}
      />

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="mentions-suggestions">
          {suggestions.map((entity, index) => (
            <div
              key={`${entity.type}-${entity.id}`}
              className="mention-suggestion-item"
              onClick={() => handleMentionSelect(entity)}
            >
              <div className="mention-suggestion-icon">
                {entity.type === MENTION_TYPES.USER && '👤'}
                {entity.type === MENTION_TYPES.DESTINATION && '📍'}
                {entity.type === MENTION_TYPES.EXPERIENCE && '🎯'}
              </div>
              <div className="mention-suggestion-content">
                <div className="mention-suggestion-name">{entity.displayName}</div>
                <div className="mention-suggestion-type">{entity.type}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Visibility selector */}
      <div className="interactive-textarea-footer">
        <Dropdown onSelect={onVisibilityChange}>
          <Dropdown.Toggle
            variant="outline-secondary"
            size="sm"
            className="visibility-selector"
          >
            {visibilityOptions.find(opt => opt.value === visibility)?.icon}{' '}
            {visibilityOptions.find(opt => opt.value === visibility)?.label}
          </Dropdown.Toggle>
          <Dropdown.Menu>
            {visibilityOptions.map(option => (
              <Dropdown.Item
                key={option.value}
                eventKey={option.value}
                active={visibility === option.value}
              >
                {option.icon} {option.label}
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </Dropdown>
      </div>
    </div>
  );
};

export default InteractiveTextArea;
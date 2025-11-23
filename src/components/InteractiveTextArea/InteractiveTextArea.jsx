/**
 * InteractiveTextArea component with mentions support
 * Allows mentioning users, destinations, and experiences with interactive popovers
 *
 * @module InteractiveTextArea
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Form, Dropdown } from 'react-bootstrap';
import {
  createMention,
  MENTION_TYPES,
  parseMentions,
  editableTextToMentions
} from '../../utilities/mentions';
import { resolveMentionsToDisplayText } from '../../utilities/mention-resolver';
import { searchAll } from '../../utilities/search-api';
import { logger } from '../../utilities/logger';
import styles from './InteractiveTextArea.module.scss';

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
  const [isSearching, setIsSearching] = useState(false);
  const textareaRef = useRef(null);
  const containerRef = useRef(null);
  const searchDebounceRef = useRef(null);

  const visibilityOptions = [
    { value: 'public', label: 'Public', icon: '🌐' },
    { value: 'contributors', label: 'Contributors Only', icon: '👥' },
    { value: 'private', label: 'Private', icon: '🔒' }
  ];

  // Convert stored format {entity/id} to display format @Name or #Name for initial display
  // After that, we work entirely in display format until submit
  const [internalValue, setInternalValue] = useState('');
  const [isResolvingMentions, setIsResolvingMentions] = useState(false);

  // Sync with external value changes (e.g., when editing an existing note)
  // Fetch entity names from API to convert {entity/id} to @Name
  useEffect(() => {
    const resolveMentions = async () => {
      if (!value) {
        setInternalValue('');
        return;
      }

      setIsResolvingMentions(true);
      try {
        // Build plan items map from entityData for efficiency
        const planItemsMap = {};
        if (entityData) {
          Object.entries(entityData).forEach(([id, entity]) => {
            if (entity.type === 'plan-item' || entity.experience_name) {
              planItemsMap[id] = entity;
            }
          });
        }

        // Resolve mentions via API
        const displayText = await resolveMentionsToDisplayText(value, planItemsMap);
        setInternalValue(displayText);
      } catch (error) {
        console.error('[InteractiveTextArea] Failed to resolve mentions:', error);
        // Fallback: show raw storage format
        setInternalValue(value);
      } finally {
        setIsResolvingMentions(false);
      }
    };

    resolveMentions();
  }, [value, entityData]);

  /**
   * Handle textarea input changes
   * User sees display format (@Name), but we emit storage format ({entity/id})
   */
  const handleInputChange = useCallback((e) => {
    const newDisplayValue = e.target.value;
    const newCursorPosition = e.target.selectionStart;

    setCursorPosition(newCursorPosition);
    setInternalValue(newDisplayValue);

    // Check for mention triggers (@ for users, # for plan items)
    const textBeforeCursor = newDisplayValue.slice(0, newCursorPosition);
    const userMentionMatch = textBeforeCursor.match(/@(\w*)$/);
    const planItemMentionMatch = textBeforeCursor.match(/#(\w*)$/);

    if (userMentionMatch) {
      const query = userMentionMatch[1];
      setMentionStart(newCursorPosition - query.length - 1);

      // Clear existing debounce timer
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }

      // If query is empty, show empty suggestions (but don't return early)
      if (!query.trim()) {
        setSuggestions([]);
        setShowSuggestions(true);
      } else {
        // Debounce global search for @ mentions (users, destinations, experiences)
        setIsSearching(true);
        searchDebounceRef.current = setTimeout(async () => {
          try {
            logger.debug('[InteractiveTextArea] Searching for entities', { query });

            // First, filter local availableEntities by query
            const localMatches = (availableEntities || [])
              .filter(entity =>
                entity.type !== 'plan-item' && // Exclude plan items from @ search
                entity.displayName?.toLowerCase().includes(query.toLowerCase())
              );

            // Then get global search results
            const results = await searchAll(query, {
              types: ['user', 'destination', 'experience'],
              limit: 5
            });

            // Transform global search results to entity format
            const globalEntities = results.map(result => ({
              type: result.type,
              id: result._id,
              displayName: result.type === 'user'
                ? (result.name || result.username || 'Unknown User')
                : (result.name || 'Unknown')
            }));

            // Merge: local matches first, then global results (removing duplicates)
            const localIds = new Set(localMatches.map(e => e.id));
            const uniqueGlobalEntities = globalEntities.filter(e => !localIds.has(e.id));
            const mergedEntities = [...localMatches, ...uniqueGlobalEntities];

            setSuggestions(mergedEntities);
            setShowSuggestions(true);
            setIsSearching(false);
          } catch (error) {
            logger.error('[InteractiveTextArea] Entity search failed', { query }, error);
            setSuggestions([]);
            setIsSearching(false);
          }
        }, 300); // 300ms debounce
      }
    } else if (planItemMentionMatch) {
      const query = planItemMentionMatch[1].toLowerCase();
      setMentionStart(newCursorPosition - query.length - 1);

      // Filter for plan items only (# prefix) - uses local availableEntities
      const filteredEntities = availableEntities.filter(entity =>
        entity.type === 'plan-item' &&
        (entity.displayName.toLowerCase().includes(query))
      );

      setSuggestions(filteredEntities.slice(0, 5)); // Limit to 5 suggestions
      setShowSuggestions(true);
    } else {
      // Clear suggestions if no mention trigger
      setShowSuggestions(false);
      setMentionStart(-1);

      // Clear debounce timer
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    }

    // Convert display format back to storage format before emitting
    // This ensures parent always receives {entity/id} format
    const storageValue = editableTextToMentions(newDisplayValue, availableEntities);
    onChange(storageValue);
  }, [onChange, availableEntities]);

  /**
   * Handle mention selection from suggestions
   * Insert storage format {entity/id} which will be displayed as @Name or #Name
   */
  const handleMentionSelect = useCallback(async (entity) => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;

    // Create storage format: {entity/id}
    const storageMention = createMention(entity.type, entity.id, entity.displayName);

    const textBeforeMention = value.slice(0, mentionStart);
    const textAfterCursor = value.slice(cursorPosition);

    // Insert the storage format into the actual value
    const newStorageValue = textBeforeMention + storageMention + ' ' + textAfterCursor;

    // Pass storage format to parent immediately
    onChange(newStorageValue);

    // Resolve the new value to display format
    setIsResolvingMentions(true);
    try {
      const planItemsMap = {};
      if (entityData) {
        Object.entries(entityData).forEach(([id, entity]) => {
          if (entity.type === 'plan-item' || entity.experience_name) {
            planItemsMap[id] = entity;
          }
        });
      }

      const displayText = await resolveMentionsToDisplayText(newStorageValue, planItemsMap);
      setInternalValue(displayText);

      // Calculate cursor position in display text
      const displayBeforeMention = await resolveMentionsToDisplayText(textBeforeMention, planItemsMap);
      const newCursorPosition = displayBeforeMention.length + (entity.type === 'plan-item' ? '#' : '@').length + entity.displayName.length + 1;

      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(newCursorPosition, newCursorPosition);
      }, 0);
    } catch (error) {
      console.error('[InteractiveTextArea] Failed to resolve mention after selection:', error);
      setInternalValue(newStorageValue);
    } finally {
      setIsResolvingMentions(false);
    }

    setShowSuggestions(false);
    setMentionStart(-1);
  }, [value, mentionStart, cursorPosition, onChange, entityData]);

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
      // Check if click is outside the entire container (including suggestions dropdown)
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowSuggestions(false);
        setMentionStart(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /**
   * Cleanup debounce timer on unmount
   */
  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, []);

  return (
    <div ref={containerRef} className={`${styles.interactiveTextarea} ${className}`}>
      <Form.Control
        ref={textareaRef}
        as="textarea"
        value={internalValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className={styles.interactiveTextareaInput}
        {...props}
      />

      {/* Suggestions dropdown */}
      {showSuggestions && (
        <div className={styles.mentionsSuggestions}>
          {isSearching ? (
            <div className={styles.mentionSuggestionItem}>
              <div className={styles.mentionSuggestionIcon}>⏳</div>
              <div className={styles.mentionSuggestionContent}>
                <div className={styles.mentionSuggestionName}>Searching...</div>
              </div>
            </div>
          ) : suggestions.length > 0 ? (
            suggestions.map((entity, index) => (
              <div
                key={`${entity.type}-${entity.id}`}
                className={styles.mentionSuggestionItem}
                onClick={() => handleMentionSelect(entity)}
              >
                <div className={styles.mentionSuggestionIcon}>
                  {entity.type === MENTION_TYPES.USER && '👤'}
                  {entity.type === MENTION_TYPES.DESTINATION && '📍'}
                  {entity.type === MENTION_TYPES.EXPERIENCE && '🎯'}
                  {entity.type === 'plan-item' && '✅'}
                </div>
                <div className={styles.mentionSuggestionContent}>
                  <div className={styles.mentionSuggestionName}>{entity.displayName}</div>
                  <div className={styles.mentionSuggestionType}>{entity.type}</div>
                </div>
              </div>
            ))
          ) : (
            <div className={styles.mentionSuggestionItem}>
              <div className={styles.mentionSuggestionIcon}>🔍</div>
              <div className={styles.mentionSuggestionContent}>
                <div className={styles.mentionSuggestionName}>No results found</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Visibility selector */}
      <div className={styles.interactiveTextareaFooter}>
        <Dropdown onSelect={onVisibilityChange}>
          <Dropdown.Toggle
            variant="outline-secondary"
            size="sm"
            className={styles.visibilitySelector}
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
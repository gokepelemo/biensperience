/**
 * InteractiveTextArea component with mentions support
 * Allows mentioning users, destinations, and experiences with interactive popovers
 *
 * @module InteractiveTextArea
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Dropdown } from 'react-bootstrap';
import { RichTextarea } from 'rich-textarea';
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
 * @param {boolean} props.showFooter - Whether to show the visibility footer (default: true)
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
  showFooter = true,
  className = '',
  ...props
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsStyle, setSuggestionsStyle] = useState({});
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

  // Force full width on RichTextarea wrapper to override library's inline width calculation
  useEffect(() => {
    if (!containerRef.current) return;

    const forceFullWidth = () => {
      // Robustly find the rendered textarea (library output) by class
      const textareaEl = containerRef.current.querySelector('textarea[class*="interactiveTextareaInput"]');
      if (textareaEl && textareaEl.parentElement) {
        const wrapper = textareaEl.parentElement; // This is the inline-block wrapper the library creates

        // Force the wrapper (first child) to be full width
        try {
          wrapper.style.setProperty('width', '100%', 'important');
          wrapper.style.setProperty('display', 'block', 'important');
          wrapper.style.setProperty('box-sizing', 'border-box', 'important');
        } catch (err) {
          // ignore
        }

        // Force the wrapper's first child (the inner absolutely-positioned div) to full width as well
        const innerFirst = wrapper.querySelector(':scope > div:first-child');
        if (innerFirst) {
          innerFirst.style.setProperty('width', '100%', 'important');
          innerFirst.style.setProperty('box-sizing', 'border-box', 'important');
        }

        // Also ensure the actual textarea is full width
        try {
          textareaEl.style.setProperty('width', '100%', 'important');
          textareaEl.style.setProperty('box-sizing', 'border-box', 'important');
        } catch (err) {}
      } else {
        // Fallback: try previous selector if textarea not found
        const richTextareaContainer = containerRef.current.querySelector('[class*="interactiveTextareaInput"]');
        if (richTextareaContainer) {
          const firstChildDiv = richTextareaContainer.querySelector(':scope > div:first-child');
          if (firstChildDiv) {
            firstChildDiv.style.setProperty('width', '100%', 'important');
            firstChildDiv.style.setProperty('display', 'block', 'important');
            firstChildDiv.style.setProperty('box-sizing', 'border-box', 'important');
          }
          const allDivs = richTextareaContainer.querySelectorAll('div');
          allDivs.forEach(wrapper => {
            wrapper.style.setProperty('width', '100%', 'important');
            wrapper.style.setProperty('box-sizing', 'border-box', 'important');
          });
          richTextareaContainer.style.setProperty('width', '100%', 'important');
        }
      }
    };

    // Initial force
    forceFullWidth();

    // Use MutationObserver to catch when library adds inline styles
    const observer = new MutationObserver(forceFullWidth);
    observer.observe(containerRef.current, {
      attributes: true,
      attributeFilter: ['style'],
      subtree: true
    });

    // Re-run on window resize (library might recalculate)
    window.addEventListener('resize', forceFullWidth);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', forceFullWidth);
    };
  }, [internalValue, value]); // Re-run when content changes

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
    // Allow spaces, hyphens and apostrophes in mention queries (matches like "@John", "@New York", "#Plan Item")
    const userMentionMatch = textBeforeCursor.match(/@([A-Za-z0-9\s\-']*)$/);
    const planItemMentionMatch = textBeforeCursor.match(/#([A-Za-z0-9\s\-']*)$/);

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
      const localMatches = (availableEntities || []).filter(entity =>
        entity.type === 'plan-item' &&
        (entity.displayName || '').toLowerCase().includes(query)
      );

      if (localMatches.length > 0) {
        setSuggestions(localMatches.slice(0, 5)); // Limit to 5 suggestions
        setShowSuggestions(true);
      } else {
        // Debounce global search for # mentions (plan items)
        setIsSearching(true);
        searchDebounceRef.current = setTimeout(async () => {
          try {
            logger.debug('[InteractiveTextArea] Searching for plan items', { query });

            // First, filter local availableEntities by query
            const localPlanItems = (availableEntities || [])
              .filter(entity =>
                entity.type === 'plan-item' &&
                entity.displayName?.toLowerCase().includes(query.toLowerCase())
              );

            // Then get global search results for plans
            const results = await searchAll(query, {
              types: ['plan'],
              limit: 5
            });

            // Transform global search results to plan-item entity format
            const globalEntities = results.map(result => ({
              type: 'plan-item',
              id: result._id,
              displayName: result.name || result.experience_name || 'Unknown Plan Item'
            }));

            // Merge: local matches first, then global results (removing duplicates)
            const localIds = new Set(localPlanItems.map(e => e.id));
            const uniqueGlobalEntities = globalEntities.filter(e => !localIds.has(e.id));
            const mergedEntities = [...localPlanItems, ...uniqueGlobalEntities];

            setSuggestions(mergedEntities);
            setShowSuggestions(true);
            setIsSearching(false);
          } catch (error) {
            logger.error('[InteractiveTextArea] Plan item search failed', { query }, error);
            setSuggestions([]);
            setIsSearching(false);
          }
        }, 300); // 300ms debounce
      }
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

    // Insert into the display text (`internalValue`) at the mentionStart position.
    // This avoids mapping display->storage offsets and preserves anchors for multiple mentions.
    try {
      const displayBefore = internalValue.slice(0, Math.max(0, mentionStart));
      const displayAfter = internalValue.slice(cursorPosition || displayBefore.length);
      const prefix = entity.type === 'plan-item' ? '#' : '@';
      const inserted = `${prefix}${entity.displayName}`;
      const newDisplayValue = `${displayBefore}${inserted} ${displayAfter}`;

      // Update local display state immediately
      setInternalValue(newDisplayValue);

      // Convert to storage format and emit to parent
      const storage = editableTextToMentions(newDisplayValue, availableEntities);
      onChange(storage);

      // Move cursor to just after the inserted mention
      const newCursorPosition = displayBefore.length + inserted.length + 1;
      setTimeout(() => {
        textarea.focus();
        try {
          textarea.setSelectionRange(newCursorPosition, newCursorPosition);
        } catch (err) {}
      }, 0);
    } catch (err) {
      console.error('[InteractiveTextArea] Error inserting mention:', err);
    }

    setShowSuggestions(false);
    setMentionStart(-1);
  }, [value, mentionStart, cursorPosition, onChange, entityData]);

  // Position suggestions dropdown directly under the textarea element
  const updateSuggestionsPosition = useCallback(() => {
    if (!textareaRef.current || !containerRef.current) return;

    try {
      const textareaRect = textareaRef.current.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();

      const top = textareaRect.bottom - containerRect.top;
      const left = textareaRect.left - containerRect.left;
      const width = textareaRect.width;

      setSuggestionsStyle({ position: 'absolute', top: `${top}px`, left: `${left}px`, width: `${width}px` });
    } catch (err) {
      // ignore measurement errors
    }
  }, []);

  // Update position when suggestions visibility changes, on resize, or when content changes
  useEffect(() => {
    if (!showSuggestions) return;
    updateSuggestionsPosition();

    window.addEventListener('resize', updateSuggestionsPosition);
    window.addEventListener('scroll', updateSuggestionsPosition, true);
    return () => {
      window.removeEventListener('resize', updateSuggestionsPosition);
      window.removeEventListener('scroll', updateSuggestionsPosition, true);
    };
  }, [showSuggestions, internalValue, updateSuggestionsPosition]);

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

  // Style function for rich-textarea to make mentions bold
  const mentionStyle = useCallback((value) => {
    // Match @Name or #Name patterns (mentions in display format)
    const mentionRegex = /(@|#)([A-Za-z0-9\s\-']+)/g;
    const matches = [];
    let match;

    while ((match = mentionRegex.exec(value)) !== null) {
      const prefix = match[1];
      const text = match[0];
      // Styles per prefix: @ => user/destination/experience, # => plan-item
      const baseStyle = {
        fontWeight: 600,
        padding: '2px 6px',
        borderRadius: '6px',
        display: 'inline-block',
        lineHeight: '1.2',
        pointerEvents: 'none'
      };

      const atStyle = {
        background: 'rgba(124,143,240,0.12)',
        color: 'var(--color-text-primary)'
      };

      const hashStyle = {
        background: 'rgba(72,201,176,0.12)',
        color: 'var(--color-text-primary)'
      };

      const style = Object.assign({}, baseStyle, prefix === '@' ? atStyle : hashStyle);

      matches.push({
        start: match.index,
        end: match.index + text.length,
        style
      });
    }

    return matches;
  }, []);

  return (
    <div ref={containerRef} className={`${styles.interactiveTextarea} ${className}`}>
      <RichTextarea
        ref={textareaRef}
        value={internalValue}
        onChange={(e) => handleInputChange(e)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className={styles.interactiveTextareaInput}
        style={mentionStyle}
        {...props}
      />

      {/* Suggestions dropdown */}
      {showSuggestions && (
        <div className={styles.mentionsSuggestions} style={suggestionsStyle}>
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
      {showFooter && (
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
      )}
    </div>
  );
};

export default InteractiveTextArea;
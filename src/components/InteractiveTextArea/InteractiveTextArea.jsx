/**
 * InteractiveTextArea component with mentions support
 * Allows mentioning users, destinations, and experiences with interactive popovers
 *
 * Additional rich-textarea features (opt-in via props):
 * - highlightUrls: Detects and highlights URLs, making them clickable
 * - highlightHashtags: Detects and highlights #hashtags
 * - highlightEmoji: Detects and highlights emoji characters
 * - customHighlights: Array of { pattern: RegExp, style: CSSObject } for custom highlighting
 *
 * @module InteractiveTextArea
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Dropdown } from 'react-bootstrap';
import { RichTextarea, createRegexRenderer } from 'rich-textarea';
import {
  createMention,
  MENTION_TYPES,
  parseMentions,
  editableTextToMentions,
  formatEntityTypeLabel
} from '../../utilities/mentions';
import { resolveMentionsToDisplayText } from '../../utilities/mention-resolver';
import { searchAll } from '../../utilities/search-api';
import { logger } from '../../utilities/logger';
import { createFilter } from '../../utilities/trie';
import styles from './InteractiveTextArea.module.scss';

/**
 * Highlight styles for createRegexRenderer (defined at module level for performance)
 * These CSS objects are applied to matched text in the textarea overlay
 */
const URL_STYLE = { color: '#0066cc', textDecoration: 'underline' };
const HASHTAG_STYLE = { color: '#1da1f2', fontWeight: '500' };
const EMOJI_STYLE = { background: 'rgba(255,220,100,0.3)', borderRadius: '2px' };
const MENTION_STYLE = { background: 'rgba(124,143,240,0.25)', color: '#5b6cdb', borderRadius: '3px', fontWeight: '600' };

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
 * @param {boolean} props.highlightUrls - Enable URL detection and highlighting (default: false)
 * @param {boolean} props.highlightHashtags - Enable hashtag highlighting (default: false)
 * @param {boolean} props.highlightEmoji - Enable emoji highlighting (default: false)
 * @param {Array} props.customHighlights - Array of { pattern: RegExp, style: CSSObject } for custom highlighting
 * @param {Function} props.onUrlClick - Callback when a highlighted URL is clicked (url) => void
 */
const InteractiveTextArea = ({
  value = '',
  onChange,
  placeholder = 'Type your message... Use @ to mention users, destinations, or experiences',
  rows = 4,
  visibility = 'contributors',
  onVisibilityChange,
  availableEntities = [],
  entityData = {},
  disabled = false,
  showFooter = true,
  className = '',
  // New highlighting features
  highlightUrls = false,
  highlightHashtags = false,
  highlightEmoji = false,
  customHighlights = [],
  onUrlClick,
  ...props
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsStyle, setSuggestionsStyle] = useState({});
  const [cursorPosition, setCursorPosition] = useState(0);
  const [mentionStart, setMentionStart] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);
  // Track confirmed mention ranges: [{ start, end, entityId, type }]
  const confirmedMentionsRef = useRef([]);
  const textareaRef = useRef(null);
  const containerRef = useRef(null);
  const searchDebounceRef = useRef(null);

  // Plan notes are always restricted to owner and collaborators
  // - 'contributors': Visible to all plan collaborators (All Contributors)
  // - 'private': Only visible to the note creator
  const visibilityOptions = [
    { value: 'contributors', label: 'All Contributors', icon: '👥' },
    { value: 'private', label: 'Private', icon: '🔒' }
  ];

  // Build trie index for fast local entity filtering
  const entityTrieFilter = useMemo(() => {
    if (!availableEntities || availableEntities.length === 0) return null;
    return createFilter({
      fields: [
        { path: 'displayName', score: 100 },
        { path: 'type', score: 20 },
      ]
    }).buildIndex(availableEntities);
  }, [availableEntities]);

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
        // Plan items can be identified by: type === 'plan-item' OR having experienceId + planId
        const planItemsMap = {};
        if (entityData) {
          Object.entries(entityData).forEach(([id, entity]) => {
            if (entity.type === 'plan-item' || (entity.experienceId && entity.planId)) {
              planItemsMap[id] = entity;
            }
          });
        }

        // Resolve mentions via API
        const displayText = await resolveMentionsToDisplayText(value, planItemsMap);
        setInternalValue(displayText);
      } catch (error) {
        logger.error('[InteractiveTextArea] Failed to resolve mentions:', { error: error.message }, error);
        // Fallback: show raw storage format
        setInternalValue(value);
      } finally {
        setIsResolvingMentions(false);
      }
    };

    resolveMentions();
  }, [value, entityData]);

  /**
   * Abstracted search function used by both @ and # mentions
   * Performs local filtering + global search with deduplication
   * @param {string} query - Search query
   * @param {string} mentionType - Either 'user' (@) or 'plan-item' (#)
   */
  const performMentionSearch = useCallback(async (query, mentionType) => {
    try {
      const isUserMention = mentionType === 'user';
      logger.debug(`[InteractiveTextArea] Searching for ${mentionType}`, {
        query,
        availableEntitiesCount: availableEntities?.length || 0,
        planItemsCount: (availableEntities || []).filter(e => e.type === 'plan-item').length
      });

      // First, filter local availableEntities by query using trie for O(m) performance
      let localMatches;
      if (entityTrieFilter) {
        // Use trie-based filtering
        const trieResults = entityTrieFilter.filter(query, { rankResults: true, limit: 20 });
        localMatches = trieResults.filter(entity => {
          if (isUserMention) {
            // For @: include user, destination, experience (exclude plan-item)
            return entity.type !== 'plan-item';
          } else {
            // For #: only include plan-item
            return entity.type === 'plan-item';
          }
        });
        logger.debug(`[InteractiveTextArea] Trie filter results for ${mentionType}`, {
          trieResultsCount: trieResults.length,
          localMatchesCount: localMatches.length,
          localMatches: localMatches.slice(0, 3).map(e => ({ type: e.type, displayName: e.displayName }))
        });
      } else {
        // Fallback to linear search
        localMatches = (availableEntities || [])
          .filter(entity => {
            if (isUserMention) {
              return entity.type !== 'plan-item' &&
                     entity.displayName?.toLowerCase().includes(query.toLowerCase());
            } else {
              return entity.type === 'plan-item' &&
                     entity.displayName?.toLowerCase().includes(query.toLowerCase());
            }
          });
        logger.debug(`[InteractiveTextArea] Linear filter results for ${mentionType}`, {
          localMatchesCount: localMatches.length
        });
      }

      // For # mentions (plan items), only use local matches - plan items aren't globally searchable
      // For @ mentions, also search globally for users, destinations, experiences
      // Normalize local matches to ensure displayName is always set
      let mergedEntities = localMatches.map(entity => ({
        ...entity,
        displayName: entity.displayName || entity.name || 'Unknown'
      }));

      if (isUserMention) {
        // Global search for @mentions: users, destinations, experiences
        try {
          const results = await searchAll(query, {
            types: ['user', 'destination', 'experience'],
            limit: 5
          });

          // Transform global search results to entity format
          const globalEntities = results.map(result => {
            let displayName;

            if (result.type === 'user') {
              // Users have name field, fallback to email prefix if no name
              displayName = result.name || result.email?.split('@')[0] || 'Unknown User';
            } else {
              // Destinations and experiences have name field
              displayName = result.name || result.title || 'Unknown';
            }

            return {
              type: result.type,
              id: result._id,
              displayName
            };
          });

          // Merge: local matches first (already normalized above), then global results (removing duplicates)
          const localIds = new Set(mergedEntities.map(e => e.id));
          const uniqueGlobalEntities = globalEntities.filter(e => !localIds.has(e.id));
          mergedEntities = [...mergedEntities, ...uniqueGlobalEntities];
        } catch (searchError) {
          // If global search fails, just use local matches
          logger.warn('[InteractiveTextArea] Global search failed, using local matches only', {
            query,
            error: searchError.message
          });
        }
      }

      logger.debug('[InteractiveTextArea] Setting suggestions', {
        count: mergedEntities.length,
        suggestions: mergedEntities.slice(0, 3).map(e => ({ type: e.type, id: e.id, displayName: e.displayName }))
      });
      setSuggestions(mergedEntities);
      setShowSuggestions(true);
      setIsSearching(false);
    } catch (error) {
      logger.error(`[InteractiveTextArea] ${mentionType} search failed`, { query }, error);
      setSuggestions([]);
      setIsSearching(false);
    }
  }, [availableEntities, entityTrieFilter]);

  /**
   * Find the active (unconfirmed) mention trigger before the cursor.
   * Returns { type: 'user'|'plan-item', start: number, query: string } or null.
   * Skips over confirmed mention ranges.
   *
   * RULES:
   * 1. If cursor is immediately after a confirmed mention (even with trailing space), don't trigger
   * 2. If cursor is inside a confirmed mention, don't trigger (user would need to backspace to edit)
   * 3. Only trigger search when user types @ or # followed by a query that doesn't match existing entity
   */
  const findActiveMentionTrigger = useCallback((text, cursorPos) => {
    const confirmed = confirmedMentionsRef.current;

    // Check if cursor is inside a confirmed mention range - no search
    const cursorInsideConfirmedMention = confirmed.some(m => cursorPos > m.start && cursorPos <= m.end);
    if (cursorInsideConfirmedMention) {
      return null;
    }

    // Check if cursor is immediately after a confirmed mention (at end or after trailing space)
    // This prevents re-triggering search when typing after selecting a mention
    const cursorAfterConfirmedMention = confirmed.some(m => {
      // Cursor is exactly at end of mention
      if (cursorPos === m.end) return true;
      // Cursor is 1 position after mention (the space we add after selection)
      if (cursorPos === m.end + 1 && text[m.end] === ' ') return true;
      return false;
    });
    if (cursorAfterConfirmedMention) {
      return null;
    }

    // Search backwards from cursor to find the most recent @ or #
    for (let i = cursorPos - 1; i >= 0; i--) {
      const char = text[i];

      // Stop if we hit a space, newline, or other word boundary (unless it's the trigger itself)
      if (char === ' ' || char === '\n' || char === '\t') {
        // Check if there's a trigger before this space that we should use
        // But only if we haven't gone too far back
        continue;
      }

      // Check if this position is inside a confirmed mention - skip search entirely
      const inConfirmed = confirmed.some(m => i >= m.start && i < m.end);
      if (inConfirmed) {
        // We've hit a confirmed mention, stop searching backwards
        return null;
      }

      if (char === '@' || char === '#') {
        // Found a trigger - extract query from trigger to cursor
        const queryText = text.slice(i + 1, cursorPos);

        // Validate query: allow letters, numbers, spaces, hyphens, apostrophes
        if (/^[A-Za-z0-9\s\-']*$/.test(queryText)) {
          const queryTrimmed = queryText.trim();
          const isHashMention = char === '#';
          const typesToCheck = isHashMention ? ['plan-item'] : ['user', 'destination', 'experience'];

          // Check if the full text matches a known entity - if so, it's complete, not active
          const matchesExistingEntity = (availableEntities || []).some(e =>
            typesToCheck.includes(e.type) &&
            e.displayName?.toLowerCase() === queryTrimmed.toLowerCase()
          );

          if (matchesExistingEntity) {
            // This is a complete mention, not an active search trigger
            return null;
          }

          return {
            type: char === '#' ? 'plan-item' : 'user',
            start: i,
            query: queryText
          };
        }
        // If query has invalid chars, this trigger is stale
        return null;
      }
    }
    return null;
  }, [availableEntities]);

  /**
   * Rebuild confirmed mentions list by scanning for valid mentions in text
   * Returns array of { start, end, entityId, type, displayName }
   */
  const rebuildConfirmedMentions = useCallback((text) => {
    const newConfirmed = [];
    // Match mentions that end at word boundary, newline, or end of string
    const mentionRegex = /(@|#)([A-Za-z0-9][A-Za-z0-9\s\-']*?)(?=\s|@|#|$|\n)/g;
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      const prefix = match[1];
      const name = match[2].trim();
      const type = prefix === '#' ? 'plan-item' : 'user';
      const typesToCheck = type === 'plan-item' ? ['plan-item'] : ['user', 'destination', 'experience'];

      // Check if this matches a known entity
      const entity = (availableEntities || []).find(e =>
        typesToCheck.includes(e.type) &&
        e.displayName?.toLowerCase() === name.toLowerCase()
      );

      if (entity) {
        newConfirmed.push({
          start: match.index,
          end: match.index + match[0].length,
          entityId: entity.id,
          type: entity.type,
          displayName: entity.displayName
        });
      }
    }

    return newConfirmed;
  }, [availableEntities]);

  /**
   * Handle textarea input changes
   * User sees display format (@Name), but we emit storage format ({entity/id})
   */
  const handleInputChange = useCallback((e) => {
    const newDisplayValue = e.target.value;
    const newCursorPosition = e.target.selectionStart;

    setCursorPosition(newCursorPosition);
    setInternalValue(newDisplayValue);

    // Skip mention detection if we just selected a mention (within last 500ms)
    // This prevents search from re-triggering when typing space/newline after selecting
    const timeSinceSelect = Date.now() - mentionSelectTimeRef.current;
    if (justSelectedMentionRef.current || timeSinceSelect < 500) {
      // Reset the flag after processing
      if (timeSinceSelect >= 100) {
        justSelectedMentionRef.current = false;
      }
      const storageValue = editableTextToMentions(newDisplayValue, availableEntities);
      onChange(storageValue);
      return;
    }

    // Update confirmed mentions based on current text (handle edits/deletions)
    confirmedMentionsRef.current = rebuildConfirmedMentions(newDisplayValue);

    // Find active mention trigger (not inside a confirmed mention)
    const activeTrigger = findActiveMentionTrigger(newDisplayValue, newCursorPosition);

    if (activeTrigger) {
      const query = activeTrigger.query.trim();
      setMentionStart(activeTrigger.start);

      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }

      if (!query) {
        setSuggestions([]);
        setShowSuggestions(true);
      } else {
        setIsSearching(true);
        searchDebounceRef.current = setTimeout(() => {
          performMentionSearch(query, activeTrigger.type);
        }, 300);
      }
    } else {
      setShowSuggestions(false);
      setMentionStart(-1);

      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    }

    const storageValue = editableTextToMentions(newDisplayValue, availableEntities);
    onChange(storageValue);
  }, [onChange, availableEntities, performMentionSearch, findActiveMentionTrigger, rebuildConfirmedMentions]);

  // Track if we just selected a mention to prevent re-triggering search
  // This ref prevents search from triggering immediately after selecting an entity
  const justSelectedMentionRef = useRef(false);
  // Track the timestamp when a mention was selected to prevent re-triggering for a short period
  const mentionSelectTimeRef = useRef(0);

  /**
   * Handle mention selection from suggestions
   * Insert display format @Name or #Name and track as confirmed mention
   */
  const handleMentionSelect = useCallback(async (entity) => {
    logger.debug('[InteractiveTextArea] handleMentionSelect', {
      type: entity?.type,
      id: entity?.id,
      displayName: entity?.displayName
    });

    if (!textareaRef.current) return;

    const textarea = textareaRef.current;

    // Set flag and timestamp to prevent re-triggering search after selection
    justSelectedMentionRef.current = true;
    mentionSelectTimeRef.current = Date.now();

    // Clear any pending search
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }

    // Close suggestions and reset state immediately
    setShowSuggestions(false);
    setMentionStart(-1);
    setIsSearching(false);
    setSuggestions([]);

    try {
      const displayBefore = internalValue.slice(0, Math.max(0, mentionStart));
      const displayAfter = internalValue.slice(cursorPosition || displayBefore.length);
      const prefix = entity.type === 'plan-item' ? '#' : '@';

      // Ensure we have a valid display name - fallback to name field or type-specific default
      const entityDisplayName = entity.displayName || entity.name ||
        (entity.type === 'user' ? 'Unknown User' :
         entity.type === 'destination' ? 'Unknown Destination' :
         entity.type === 'experience' ? 'Unknown Experience' :
         entity.type === 'plan-item' ? 'Unknown Item' : 'Unknown');
      const inserted = `${prefix}${entityDisplayName}`;
      const newDisplayValue = `${displayBefore}${inserted} ${displayAfter}`;

      // Add this mention to confirmed list immediately
      const mentionEnd = displayBefore.length + inserted.length;
      confirmedMentionsRef.current = [
        ...confirmedMentionsRef.current,
        {
          start: displayBefore.length,
          end: mentionEnd,
          entityId: entity.id,
          type: entity.type,
          displayName: entityDisplayName
        }
      ];

      // Update local display state
      setInternalValue(newDisplayValue);

      // Ensure entity is in availableEntities for conversion with resolved displayName
      const entityWithDisplayName = { ...entity, displayName: entityDisplayName };
      const entityExists = (availableEntities || []).some(e => e.id === entity.id && e.type === entity.type);
      const entitiesForConversion = entityExists
        ? availableEntities
        : [...(availableEntities || []), entityWithDisplayName];

      // Convert to storage format and emit to parent
      const storage = editableTextToMentions(newDisplayValue, entitiesForConversion);
      onChange(storage);

      // Move cursor to just after the inserted mention (after the space)
      const newCursorPos = mentionEnd + 1;
      setTimeout(() => {
        textarea.focus();
        try {
          textarea.setSelectionRange(newCursorPos, newCursorPos);
        } catch (err) {}
        // Don't reset justSelectedMentionRef here - let the timestamp-based check handle it
        // This ensures we have protection for at least 500ms after selection
      }, 0);
    } catch (err) {
      logger.error('[InteractiveTextArea] Error inserting mention:', err);
      justSelectedMentionRef.current = false;
    }
  }, [internalValue, mentionStart, cursorPosition, onChange, availableEntities]);

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
    window.addEventListener('scroll', updateSuggestionsPosition, { capture: true, passive: true });
    return () => {
      window.removeEventListener('resize', updateSuggestionsPosition);
      window.removeEventListener('scroll', updateSuggestionsPosition, { capture: true });
    };
  }, [showSuggestions, internalValue, updateSuggestionsPosition]);

  /**
   * Handle keyboard navigation in suggestions
   * IMPORTANT: Only prevent Enter for auto-selecting a single mention suggestion.
   * In all other cases, allow Enter to create line breaks naturally.
   */
  const handleKeyDown = useCallback((e) => {
    // Allow normal Enter behavior (line breaks) when:
    // - Suggestions dropdown is not showing
    // - No suggestions available
    // - Multiple suggestions (user must click to select)
    if (!showSuggestions || suggestions.length === 0) {
      return; // Let Enter create line breaks
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setShowSuggestions(false);
      setMentionStart(-1);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      // Could implement arrow key navigation for suggestions
    } else if (e.key === 'Enter') {
      // Only auto-select if there's exactly one suggestion
      // Otherwise, allow line break
      if (suggestions.length === 1) {
        e.preventDefault();
        handleMentionSelect(suggestions[0]);
      }
      // If multiple suggestions, Enter creates a line break (default behavior)
    }
  }, [showSuggestions, suggestions, handleMentionSelect]);

  /**
   * Handle selection changes from RichTextarea's onSelectionChange
   * This provides better caret tracking than onSelect
   * If user places cursor inside a highlighted mention, we don't trigger search
   */
  const handleSelectionChange = useCallback((range) => {
    if (!range) return;

    const pos = range.selectionStart;
    setCursorPosition(pos);

    // Check if cursor is inside a confirmed mention
    const confirmed = confirmedMentionsRef.current;
    const insideMention = confirmed.find(m => pos > m.start && pos < m.end);

    if (insideMention) {
      // Cursor is inside a mention - close any open suggestions
      setShowSuggestions(false);
      setMentionStart(-1);
    }
  }, []);

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

  /**
   * Build regex pattern for highlighting known entity mentions
   * Creates pattern like (@Name1|@Name2|#Item1|#Item2)
   */
  const mentionHighlightRegex = useMemo(() => {
    if (!availableEntities || availableEntities.length === 0) return null;

    // Build patterns for all known entities
    const patterns = [];
    (availableEntities || []).forEach(e => {
      if (e.displayName) {
        // Escape special regex characters in entity names
        const escapedName = e.displayName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const prefix = e.type === 'plan-item' ? '#' : '@';
        patterns.push(`${prefix}${escapedName}`);
      }
    });

    if (patterns.length === 0) return null;

    // Create regex that matches any known mention
    // Use word boundary or lookahead for space/newline/@ /#/end
    return new RegExp(`(${patterns.join('|')})(?=\\s|@|#|$|\\n)`, 'gi');
  }, [availableEntities]);

  /**
   * Create combined renderer for all highlight patterns
   * Includes: mentions, URLs, hashtags, emoji, and custom patterns
   * This renderer is passed as children to RichTextarea
   *
   * IMPORTANT: createRegexRenderer requires regex with global 'g' flag.
   * Each regex must be created fresh to avoid lastIndex issues.
   */
  const combinedRenderer = useMemo(() => {
    // Build array of [pattern, style] pairs for createRegexRenderer
    const renderers = [];

    // 1. Mention highlighting (highest priority - entities)
    if (mentionHighlightRegex) {
      renderers.push([mentionHighlightRegex, MENTION_STYLE]);
    }

    // 2. URL highlighting - makes URLs visually distinct
    if (highlightUrls) {
      // Create fresh regex instance to avoid lastIndex state issues
      renderers.push([
        /https?:\/\/[-_.!~*'()a-zA-Z0-9;/?:@&=+$,%#]+/g,
        URL_STYLE
      ]);
    }

    // 3. Hashtag highlighting (general hashtags, not plan-item mentions)
    if (highlightHashtags) {
      renderers.push([
        /#[a-zA-Z][a-zA-Z0-9_]*/g,
        HASHTAG_STYLE
      ]);
    }

    // 4. Emoji highlighting - subtle background to make emojis stand out
    if (highlightEmoji) {
      renderers.push([
        /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]/gu,
        EMOJI_STYLE
      ]);
    }

    // 5. Custom highlights from props
    if (customHighlights && customHighlights.length > 0) {
      customHighlights.forEach(({ pattern, style }) => {
        if (pattern && style) {
          renderers.push([pattern, style]);
        }
      });
    }

    // If no renderers configured, return undefined so RichTextarea renders plain text
    if (renderers.length === 0) {
      return undefined;
    }

    // Use createRegexRenderer with all patterns
    // This returns a function: (value: string) => React.ReactNode
    return createRegexRenderer(renderers);
  }, [mentionHighlightRegex, highlightUrls, highlightHashtags, highlightEmoji, customHighlights]);

  return (
    <div ref={containerRef} className={`${styles.interactiveTextarea} ${className}`}>
      <RichTextarea
        ref={textareaRef}
        value={internalValue}
        onChange={(e) => handleInputChange(e)}
        onKeyDown={handleKeyDown}
        onSelectionChange={handleSelectionChange}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className={styles.interactiveTextareaInput}
        {...props}
      >
        {combinedRenderer || undefined}
      </RichTextarea>

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
            suggestions.map((entity) => {
              // Ensure displayName is always defined - compute once for both display and click
              const displayName = entity.displayName || entity.name ||
                (entity.type === 'user' ? 'Unknown User' :
                 entity.type === 'destination' ? 'Unknown Destination' :
                 entity.type === 'experience' ? 'Unknown Experience' :
                 entity.type === 'plan-item' ? 'Unknown Item' : 'Unknown');
              return (
                <div
                  key={`${entity.type}-${entity.id}`}
                  className={styles.mentionSuggestionItem}
                  onClick={() => handleMentionSelect({ ...entity, displayName })}
                >
                  <div className={styles.mentionSuggestionIcon}>
                    {entity.type === MENTION_TYPES.USER && '👤'}
                    {entity.type === MENTION_TYPES.DESTINATION && '📍'}
                    {entity.type === MENTION_TYPES.EXPERIENCE && '🎯'}
                    {entity.type === 'plan-item' && '✅'}
                  </div>
                  <div className={styles.mentionSuggestionContent}>
                    <div className={styles.mentionSuggestionName}>{displayName}</div>
                    <div className={styles.mentionSuggestionType}>{formatEntityTypeLabel(entity.type)}</div>
                  </div>
                </div>
              );
            })
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
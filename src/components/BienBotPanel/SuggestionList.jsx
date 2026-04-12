/**
 * SuggestionList — Renders plan item suggestions with checkbox selection.
 *
 * Displayed inline in assistant messages when a `suggestion_list` structured
 * content block is present. Users select items they want to add, then click
 * "Add selected" to create an `add_plan_items` action.
 *
 * Items whose text already appears in the active plan are filtered out via the
 * `existingItemTexts` prop (a Set of lowercased, trimmed item texts).
 *
 * @module components/BienBotPanel/SuggestionList
 */

import React, { useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Button, Text } from '../design-system';
import styles from './BienBotPanel.module.css';

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 6L9 17l-5-5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function SuggestionList({ data, onAddSelected, disabled, existingItemTexts }) {
  const { suggestions = [], destination_name, source_count } = data || {};

  // Filter out items already in the plan so we never suggest duplicates.
  const filteredSuggestions = useMemo(() => {
    if (!existingItemTexts?.size) return suggestions;
    return suggestions.filter(item => {
      const text = (item.text || item.content || '').toLowerCase().trim();
      return text && !existingItemTexts.has(text);
    });
  }, [suggestions, existingItemTexts]);

  const [selected, setSelected] = useState(new Set());

  const toggleItem = useCallback((index) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selected.size === filteredSuggestions.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredSuggestions.map((_, i) => i)));
    }
  }, [selected.size, filteredSuggestions]);

  const handleAdd = useCallback(() => {
    if (selected.size === 0 || !onAddSelected) return;
    const items = [...selected].map(i => filteredSuggestions[i]).filter(Boolean);
    onAddSelected(items);
    setSelected(new Set());
  }, [selected, filteredSuggestions, onAddSelected]);

  // Nothing to show at all.
  if (!suggestions.length) return null;

  const allAdded = filteredSuggestions.length === 0;
  const filteredCount = suggestions.length - filteredSuggestions.length;
  const allSelected = selected.size === filteredSuggestions.length;

  return (
    <div className={styles.suggestionList}>
      <div className={styles.suggestionHeader}>
        <Text size="sm" className={styles.suggestionTitle}>
          {destination_name
            ? `Popular items in ${destination_name}`
            : 'Suggested plan items'}
        </Text>
        {source_count > 0 && (
          <Text size="xs" className={styles.suggestionMeta}>
            Based on {source_count} experience{source_count !== 1 ? 's' : ''}
          </Text>
        )}
      </div>

      {/* All suggestions are already in the plan */}
      {allAdded ? (
        <div className={styles.suggestionAllAdded}>
          <Text size="sm" className={styles.suggestionAllAddedText}>
            All suggested items are already in your plan.
          </Text>
        </div>
      ) : (
        <>
          {filteredCount > 0 && (
            <Text size="xs" className={styles.suggestionFilteredNote}>
              {filteredCount} item{filteredCount !== 1 ? 's' : ''} already in your plan hidden
            </Text>
          )}

          <button
            type="button"
            className={styles.suggestionSelectAll}
            onClick={handleSelectAll}
            disabled={disabled}
          >
            <Text size="xs">{allSelected ? 'Deselect all' : 'Select all'}</Text>
          </button>

          <div className={styles.suggestionItems}>
            {filteredSuggestions.map((item, idx) => {
              const isSelected = selected.has(idx);
              const sources = item.sources?.length
                ? item.sources.slice(0, 2).join(', ')
                : null;

              return (
                <button
                  key={idx}
                  type="button"
                  className={`${styles.suggestionItem} ${isSelected ? styles.suggestionItemSelected : ''}`}
                  onClick={() => toggleItem(idx)}
                  disabled={disabled}
                  aria-pressed={isSelected}
                >
                  <span className={styles.suggestionItemRow}>
                    <span className={`${styles.suggestionCheckbox} ${isSelected ? styles.suggestionCheckboxChecked : ''}`}>
                      {isSelected && <CheckIcon />}
                    </span>
                    <span className={styles.suggestionItemContent}>
                      <span className={styles.suggestionItemText}>{(item.text || item.content || '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ')}</span>
                      {sources && (
                        <span className={styles.suggestionItemSource}>
                          from {sources}
                        </span>
                      )}
                    </span>
                    {item.frequency > 1 && (
                      <span className={styles.suggestionItemFrequency}>
                        {item.frequency}x
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          {selected.size > 0 && (
            <div className={styles.suggestionActions}>
              <Button
                variant="primary"
                size="sm"
                onClick={handleAdd}
                disabled={disabled}
              >
                Add {selected.size} item{selected.size !== 1 ? 's' : ''}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

SuggestionList.propTypes = {
  data: PropTypes.shape({
    suggestions: PropTypes.arrayOf(PropTypes.shape({
      text: PropTypes.string,
      content: PropTypes.string,
      frequency: PropTypes.number,
      sources: PropTypes.arrayOf(PropTypes.string),
      activity_type: PropTypes.string,
      cost_estimate: PropTypes.number
    })),
    destination_name: PropTypes.string,
    source_count: PropTypes.number
  }),
  onAddSelected: PropTypes.func,
  disabled: PropTypes.bool,
  existingItemTexts: PropTypes.instanceOf(Set)
};

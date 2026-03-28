/**
 * SuggestionList — Renders plan item suggestions with checkbox selection.
 *
 * Displayed inline in assistant messages when a `suggestion_list` structured
 * content block is present. Users select items they want to add, then click
 * "Add selected" to create an `add_plan_items` action.
 *
 * @module components/BienBotPanel/SuggestionList
 */

import React, { useState, useCallback } from 'react';
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

export default function SuggestionList({ data, onAddSelected, disabled }) {
  const { suggestions = [], destination_name, source_count } = data || {};
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
    if (selected.size === suggestions.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(suggestions.map((_, i) => i)));
    }
  }, [selected.size, suggestions]);

  const handleAdd = useCallback(() => {
    if (selected.size === 0 || !onAddSelected) return;
    const items = [...selected].map(i => suggestions[i]).filter(Boolean);
    onAddSelected(items);
    setSelected(new Set());
  }, [selected, suggestions, onAddSelected]);

  if (!suggestions.length) return null;

  const allSelected = selected.size === suggestions.length;

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

      <button
        type="button"
        className={styles.suggestionSelectAll}
        onClick={handleSelectAll}
        disabled={disabled}
      >
        <Text size="xs">{allSelected ? 'Deselect all' : 'Select all'}</Text>
      </button>

      <div className={styles.suggestionItems}>
        {suggestions.map((item, idx) => {
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
              <span className={`${styles.suggestionCheckbox} ${isSelected ? styles.suggestionCheckboxChecked : ''}`}>
                {isSelected && <CheckIcon />}
              </span>
              <span className={styles.suggestionItemContent}>
                <span className={styles.suggestionItemText}>{item.text || item.content}</span>
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
  disabled: PropTypes.bool
};

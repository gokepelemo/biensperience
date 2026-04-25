/**
 * TipSuggestionList — Renders travel tips from external sources with checkbox selection.
 *
 * Reuses the SuggestionList CSS classes for the shared list/checkbox/actions structure,
 * adding only tip-specific badge and icon styles. Displayed inline in assistant messages
 * or after destination creation when a `tip_suggestion_list` structured content block
 * is present.
 *
 * @module components/BienBotPanel/TipSuggestionList
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

/**
 * Badge color mapping for tip categories.
 */
const CATEGORY_COLORS = {
  Sightseeing: 'info',
  Activities: 'primary',
  Food: 'success',
  Nightlife: 'primary',
  Shopping: 'warning',
  Accommodation: 'info',
  Transportation: 'neutral',
  'Getting There': 'neutral',
  Safety: 'danger',
  Health: 'danger',
  Language: 'warning',
  Culture: 'primary',
  Customs: 'primary',
  Weather: 'info',
  'Practical Info': 'neutral',
  Connectivity: 'neutral',
  Overview: 'info'
};

function TipSuggestionList({ data, onAddSelected, disabled }) {
  const { tips = [], destination_name, provider_count } = data || {};
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
    if (selected.size === tips.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(tips.map((_, i) => i)));
    }
  }, [selected.size, tips]);

  const handleAdd = useCallback(() => {
    if (selected.size === 0 || !onAddSelected) return;
    const items = [...selected].map(i => tips[i]).filter(Boolean);
    onAddSelected(items, data?.destination_id);
    setSelected(new Set());
  }, [selected, tips, onAddSelected, data?.destination_id]);

  if (!tips.length) return null;

  const allSelected = selected.size === tips.length;

  return (
    <div className={styles.suggestionList}>
      <div className={styles.suggestionHeader}>
        <Text size="sm" className={styles.suggestionTitle}>
          {destination_name
            ? `Travel tips for ${destination_name}`
            : 'Suggested travel tips'}
        </Text>
        {provider_count > 0 && (
          <Text size="xs" className={styles.suggestionMeta}>
            From {provider_count} source{provider_count !== 1 ? 's' : ''}
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
        {tips.map((tip, idx) => {
          const isSelected = selected.has(idx);
          const category = tip.category || tip.type || null;
          const colorClass = category ? CATEGORY_COLORS[category] || 'neutral' : null;

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
                {tip.icon && (
                  <span className={styles.tipIcon} aria-hidden="true">{tip.icon}</span>
                )}
                {category && (
                  <span className={`${styles.tipBadge} ${styles[`tipBadge_${colorClass}`] || ''}`}>
                    {category}
                  </span>
                )}
                <span className={styles.suggestionItemText}>{tip.value}</span>
                {tip.source && (
                  <span className={styles.suggestionItemSource}>
                    via {tip.source}
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
            Add {selected.size} tip{selected.size !== 1 ? 's' : ''}
          </Button>
        </div>
      )}
    </div>
  );
}

TipSuggestionList.propTypes = {
  data: PropTypes.shape({
    tips: PropTypes.arrayOf(PropTypes.shape({
      type: PropTypes.string,
      category: PropTypes.string,
      value: PropTypes.string,
      source: PropTypes.string,
      url: PropTypes.string,
      icon: PropTypes.string,
      callToAction: PropTypes.shape({
        url: PropTypes.string,
        label: PropTypes.string
      })
    })),
    destination_id: PropTypes.string,
    destination_name: PropTypes.string,
    provider_count: PropTypes.number
  }),
  onAddSelected: PropTypes.func,
  disabled: PropTypes.bool
};

export default React.memo(TipSuggestionList);

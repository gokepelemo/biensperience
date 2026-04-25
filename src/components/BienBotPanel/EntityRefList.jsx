/**
 * EntityRefList — Inline rich entity cards for entity_ref_list structured content blocks.
 *
 * Rendered inside assistant message bubbles when the LLM returns entity_refs.
 * Each card shows entity type, name, and is clickable for navigation.
 * plan_item cards expand on click to reveal "Mark complete" and "Navigate" actions.
 *
 * @module components/BienBotPanel/EntityRefList
 */

import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import styles from './BienBotPanel.module.css';
import { getEntityUrl } from '../../utilities/bienbot-entity-urls';

const TYPE_ICONS = {
  destination: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" fill="currentColor" />
    </svg>
  ),
  experience: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2l2.09 6.26L21 9l-5 4.73L17.18 21 12 17.77 6.82 21 8 13.73 3 9l6.91-.74L12 2z" fill="currentColor" />
    </svg>
  ),
  plan: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  plan_item: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 11l3 3L22 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

const TYPE_LABELS = {
  destination: 'Destination',
  experience: 'Experience',
  plan: 'Plan',
  plan_item: 'Plan item',
};


function EntityRefList({ refs, onSelect }) {
  const navigate = useNavigate();
  // Tracks which plan_item card (by index) has its action row expanded.
  const [expandedIdx, setExpandedIdx] = useState(null);

  if (!refs || refs.length === 0) return null;

  return (
    <div className={styles.entityRefList}>
      {refs.map((ref, i) => {
        const url = getEntityUrl(ref);
        const label = TYPE_LABELS[ref.type] || ref.type;
        const icon = TYPE_ICONS[ref.type] || null;
        const isPlanItem = ref.type === 'plan_item';
        const isExpanded = expandedIdx === i;

        // plan_item cards expand to show action buttons instead of navigating immediately.
        const handleClick = isPlanItem
          ? () => setExpandedIdx(isExpanded ? null : i)
          : onSelect
            ? () => onSelect(ref)
            : (url ? () => navigate(url) : undefined);

        return (
          <div key={`${ref._id}-${i}`} className={styles.entityRefWrapper}>
            <button
              className={`${styles.entityRefCard} ${isExpanded ? styles.entityRefCardExpanded : ''}`}
              onClick={handleClick}
              disabled={!handleClick}
              type="button"
              aria-expanded={isPlanItem ? isExpanded : undefined}
              aria-label={`${isPlanItem ? 'Options for' : onSelect ? 'Select' : 'View'} ${label}: ${ref.name}`}
            >
              {icon && <span className={styles.entityRefIcon}>{icon}</span>}
              <span className={styles.entityRefBody}>
                <span className={styles.entityRefType}>{label}</span>
                <span className={styles.entityRefName}>{ref.name}</span>
                {ref.detail && (
                  <span className={styles.entityRefDetail}>{ref.detail}</span>
                )}
              </span>
              {isPlanItem ? (
                <svg
                  className={`${styles.entityRefArrow} ${isExpanded ? styles.entityRefArrowUp : ''}`}
                  width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true"
                >
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : url ? (
                <svg className={styles.entityRefArrow} width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : null}
            </button>

            {isPlanItem && isExpanded && (
              <div className={styles.entityRefActions}>
                <button
                  type="button"
                  className={styles.entityRefActionBtn}
                  onClick={() => {
                    setExpandedIdx(null);
                    onSelect && onSelect({ ...ref, action: 'mark_complete' });
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Mark complete
                </button>
                <button
                  type="button"
                  className={`${styles.entityRefActionBtn} ${styles.entityRefActionBtnSecondary}`}
                  onClick={() => {
                    setExpandedIdx(null);
                    const navUrl = getEntityUrl(ref);
                    if (navUrl) {
                      navigate(navUrl);
                    } else {
                      onSelect && onSelect({ ...ref, action: 'navigate' });
                    }
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M15 3h6v6M10 14L21 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Navigate to item
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

EntityRefList.propTypes = {
  refs: PropTypes.arrayOf(PropTypes.shape({
    type: PropTypes.string.isRequired,
    _id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    experience_id: PropTypes.string,
    plan_id: PropTypes.string,
    detail: PropTypes.string,
  })).isRequired,
  onSelect: PropTypes.func,
};

export default React.memo(EntityRefList);

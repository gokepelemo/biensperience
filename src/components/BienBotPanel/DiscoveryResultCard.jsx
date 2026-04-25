/**
 * DiscoveryResultCard — Renders discovery results as interactive cards.
 *
 * Displays a paginated list of experience discovery results from BienBot's
 * discover_content read-only action. Shows skeleton cards while streaming
 * (data === null), then transitions to real content in-place.
 *
 * @module components/BienBotPanel/DiscoveryResultCard
 */

import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Button, Text } from '../design-system';
import { formatCostEstimate } from '../../utilities/cost-utils';
import styles from './BienBotPanel.module.css';

const INITIAL_VISIBLE = 5;

// ---------------------------------------------------------------------------
// Activity type → gradient background for photo placeholder
// ---------------------------------------------------------------------------

const ACTIVITY_GRADIENTS = {
  food:          'linear-gradient(135deg, #f97316, #ea580c)',
  drinks:        'linear-gradient(135deg, #f97316, #ea580c)',
  coffee:        'linear-gradient(135deg, #f97316, #ea580c)',
  market:        'linear-gradient(135deg, #f97316, #ea580c)',
  culinary:      'linear-gradient(135deg, #f97316, #ea580c)',
  local:         'linear-gradient(135deg, #f97316, #ea580c)',
  adventure:     'linear-gradient(135deg, #16a34a, #15803d)',
  nature:        'linear-gradient(135deg, #16a34a, #15803d)',
  sports:        'linear-gradient(135deg, #16a34a, #15803d)',
  tour:          'linear-gradient(135deg, #16a34a, #15803d)',
  museum:        'linear-gradient(135deg, #7c3aed, #6d28d9)',
  sightseeing:   'linear-gradient(135deg, #7c3aed, #6d28d9)',
  religious:     'linear-gradient(135deg, #7c3aed, #6d28d9)',
  historical:    'linear-gradient(135deg, #7c3aed, #6d28d9)',
  cultural:      'linear-gradient(135deg, #7c3aed, #6d28d9)',
  wellness:      'linear-gradient(135deg, #0ea5e9, #0284c7)',
  health:        'linear-gradient(135deg, #0ea5e9, #0284c7)',
  rest:          'linear-gradient(135deg, #0ea5e9, #0284c7)',
  beach:         'linear-gradient(135deg, #0ea5e9, #0284c7)',
  nightlife:     'linear-gradient(135deg, #db2777, #be185d)',
  entertainment: 'linear-gradient(135deg, #db2777, #be185d)',
  photography:   'linear-gradient(135deg, #64748b, #475569)',
  mountain:      'linear-gradient(135deg, #64748b, #475569)',
  urban:         'linear-gradient(135deg, #0f766e, #0d9488)',
  shopping:      'linear-gradient(135deg, #0f766e, #0d9488)',
  class:         'linear-gradient(135deg, #0f766e, #0d9488)',
};

const FALLBACK_GRADIENT = 'linear-gradient(135deg, #6366f1, #4f46e5)';

function getGradient(activityTypes) {
  if (!activityTypes?.length) return FALLBACK_GRADIENT;
  return ACTIVITY_GRADIENTS[activityTypes[0]] || FALLBACK_GRADIENT;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SkeletonCard() {
  return (
    <div className={styles.discoverySkeletonCard} aria-hidden="true">
      <div className={styles.discoverySkeletonThumb} />
      <div className={styles.discoverySkeletonBody}>
        <div className={`${styles.discoverySkeletonLine} ${styles.discoverySkeletonLineLg}`} />
        <div className={`${styles.discoverySkeletonLine} ${styles.discoverySkeletonLineSm}`} />
        <div className={styles.discoverySkeletonBadgeRow}>
          <div className={styles.discoverySkeletonBadge} />
          <div className={styles.discoverySkeletonBadge} />
        </div>
        <div className={`${styles.discoverySkeletonLine} ${styles.discoverySkeletonLineMd}`} />
      </div>
    </div>
  );
}

function detectEmptyCase(filtersApplied = {}) {
  const { destination_name, destination_id } = filtersApplied;
  if (!destination_id && destination_name) return 'no_destination';
  if (destination_id) return 'destination_exists';
  return 'cross_destination';
}

function EmptyState({ queryMetadata, onEmpty }) {
  const filtersApplied = queryMetadata?.filters_applied || {};
  const { destination_name } = filtersApplied;
  const emptyCase = detectEmptyCase(filtersApplied);

  let primary, secondary, ctaLabel;

  if (emptyCase === 'no_destination') {
    primary = `No experiences found for ${destination_name}`;
    secondary = 'It may not be in your destinations yet.';
    ctaLabel = `Add ${destination_name} as a destination`;
  } else if (emptyCase === 'destination_exists') {
    const destLabel = destination_name || 'this destination';
    primary = `No experiences found in ${destLabel}`;
    secondary = 'Be the first to create one.';
    ctaLabel = 'Create an experience here';
  } else {
    primary = 'No matching experiences found.';
    secondary = 'Try broadening your search or start fresh.';
    ctaLabel = 'Create a destination to get started';
  }

  return (
    <div className={styles.discoveryEmptyState}>
      <div className={styles.discoveryEmptyPrimary}>{primary}</div>
      <div className={styles.discoveryEmptySecondary}>{secondary}</div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onEmpty(filtersApplied)}
        className={styles.discoveryEmptyBtn}
      >
        {ctaLabel}
      </Button>
    </div>
  );
}

EmptyState.propTypes = {
  queryMetadata: PropTypes.object,
  onEmpty: PropTypes.func.isRequired,
};

function ActivityBadges({ types }) {
  if (!types?.length) return null;
  const visible = types.slice(0, 3);
  const overflow = types.length - visible.length;
  return (
    <div className={styles.discoveryBadges}>
      {visible.map(t => (
        <span key={t} className={styles.discoveryBadge}>{t}</span>
      ))}
      {overflow > 0 && (
        <span className={`${styles.discoveryBadge} ${styles.discoveryBadgeOverflow}`}>
          +{overflow}
        </span>
      )}
    </div>
  );
}

function StatsRow({ planCount, completionRate, costEstimate }) {
  const showCompletion = completionRate != null && completionRate >= 0.01;
  const showCost = costEstimate != null && costEstimate > 0;
  if (!planCount && !showCompletion && !showCost) return null;
  return (
    <div className={styles.discoveryStats}>
      {planCount > 0 && (
        <span className={styles.discoveryStatItem}>
          {planCount} plan{planCount !== 1 ? 's' : ''}
        </span>
      )}
      {showCompletion && (
        <span className={styles.discoveryStatItem}>
          {Math.round(completionRate * 100)}% complete
        </span>
      )}
      {showCost && (
        <span className={styles.discoveryStatItem}>
          ~{formatCostEstimate(costEstimate)}
        </span>
      )}
    </div>
  );
}

function DiscoveryCard({ result, onView, onPlan, disabled }) {
  const {
    experience_id,
    experience_name,
    destination_name,
    activity_types,
    cost_estimate,
    plan_count,
    completion_rate,
    match_reason,
    default_photo_url,
  } = result;

  return (
    <div className={styles.discoveryCard}>
      {default_photo_url ? (
        <img
          src={default_photo_url}
          alt={experience_name}
          className={styles.discoveryThumb}
          loading="lazy"
        />
      ) : (
        <div
          className={styles.discoveryThumb}
          style={{ background: getGradient(activity_types) }}
          aria-hidden="true"
        />
      )}
      <div className={styles.discoveryBody}>
        <div className={styles.discoveryName}>{experience_name}</div>
        {destination_name && (
          <div className={styles.discoveryDestination}>
            <span aria-hidden="true">📍</span> {destination_name}
          </div>
        )}
        <ActivityBadges types={activity_types} />
        <StatsRow
          planCount={plan_count}
          completionRate={completion_rate}
          costEstimate={cost_estimate}
        />
        {match_reason && (
          <div className={styles.discoveryMatchReason}>{match_reason}</div>
        )}
        <div className={styles.discoveryActions}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onView(experience_id)}
            disabled={disabled}
            className={styles.discoveryBtnView}
          >
            View ↗
          </Button>
          <Button
            variant="gradient"
            size="sm"
            onClick={() => onPlan(experience_name, experience_id)}
            disabled={disabled}
            className={styles.discoveryBtnPlan}
          >
            Plan this →
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

function DiscoveryResultCard({ data, onView, onPlan, onEmpty, disabled }) {
  const [expanded, setExpanded] = useState(false);
  const handleToggle = useCallback(() => setExpanded(prev => !prev), []);

  // Skeleton mode — data is null while the stream is in progress
  if (data === null) {
    return (
      <div className={styles.discoveryList} aria-label="Loading discovery results">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  const { results = [], query_metadata } = data;
  if (!results.length) {
    return (
      <EmptyState
        queryMetadata={query_metadata}
        onEmpty={onEmpty}
      />
    );
  }

  const overflow = results.length - INITIAL_VISIBLE;
  const visible = expanded ? results : results.slice(0, INITIAL_VISIBLE);

  return (
    <div className={styles.discoveryList}>
      {query_metadata?.result_count > 0 && (
        <Text size="xs" className={styles.discoveryMeta}>
          {query_metadata.result_count} result{query_metadata.result_count !== 1 ? 's' : ''}
          {query_metadata.cross_destination ? ' across all destinations' : ''}
        </Text>
      )}
      {visible.map(result => (
        <DiscoveryCard
          key={result.experience_id}
          result={result}
          onView={onView}
          onPlan={onPlan}
          disabled={disabled}
        />
      ))}
      {overflow > 0 && (
        <button
          type="button"
          className={styles.discoveryShowMore}
          onClick={handleToggle}
          disabled={disabled}
        >
          {expanded ? 'Show less' : `Show ${overflow} more`}
        </button>
      )}
    </div>
  );
}

DiscoveryResultCard.propTypes = {
  data: PropTypes.shape({
    results: PropTypes.arrayOf(
      PropTypes.shape({
        experience_id: PropTypes.string.isRequired,
        experience_name: PropTypes.string.isRequired,
        destination_name: PropTypes.string,
        destination_id: PropTypes.string,
        activity_types: PropTypes.arrayOf(PropTypes.string),
        cost_estimate: PropTypes.number,
        plan_count: PropTypes.number,
        completion_rate: PropTypes.number,
        collaborator_count: PropTypes.number,
        relevance_score: PropTypes.number,
        match_reason: PropTypes.string,
        default_photo_url: PropTypes.string,
      })
    ),
    query_metadata: PropTypes.object,
  }),
  onView: PropTypes.func.isRequired,
  onPlan: PropTypes.func.isRequired,
  onEmpty: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

export default React.memo(DiscoveryResultCard);

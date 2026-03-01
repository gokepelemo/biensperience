/**
 * PlanMetricsDisplay Component
 * Displays metrics for a plan (planned date, completion, cost)
 *
 * Wrapped with React.memo to prevent unnecessary re-renders - this component
 * only needs to re-render when metrics (date, completion, cost) actually change.
 */

import { memo } from 'react';
import TagPill from '../../../components/Pill/TagPill';
import { formatDateMetricCard } from '../../../utilities/date-utils';
import CostEstimate from '../../../components/CostEstimate/CostEstimate';
import { lang } from '../../../lang.constants';
import styles from './PlanMetricsDisplay.module.scss';

function PlanMetricsDisplay({
  plannedDate,
  completionPercentage,
  totalCost,
  onEditDate,
  showEditButton = true
}) {
  // Dynamic font size adjustment removed - badges have consistent sizing

  // Format full date for tooltip
  const fullDateText = plannedDate ? formatDateMetricCard(plannedDate) : 'No date set';

  return (
    <div className={`plan-metrics ${styles.metricsGrid}`}>
      {/* Completion Percentage */}
      <div className={styles.metricCol}>
        <div className={`metric-card ${styles.fullHeight}`} title={`${completionPercentage}% of plan items completed`}>
          <div className="metric-label">Completion</div>
          <div className="metric-value">{completionPercentage}%</div>
          <div className={styles.progressTrack} style={{ height: 'var(--progress-bar-height-sm)' }}>
            <div
              className={styles.progressFill}
              role="progressbar"
              style={{ width: `${completionPercentage}%` }}
              aria-valuenow={completionPercentage}
              aria-valuemin="0"
              aria-valuemax="100"
            />
          </div>
        </div>
      </div>

      {/* Planned Date */}
      <div className={styles.metricCol}>
        <div className={`metric-card ${styles.fullHeight}`} title={fullDateText}>
          <div className="metric-label">Planned Date</div>
          <div className="metric-value-container">
            {plannedDate ? (
              <TagPill 
                color="primary" 
                className="metric-badge metric-badge-date" 
                onClick={onEditDate}
                title={fullDateText}
              >
                {formatDateMetricCard(plannedDate)}
              </TagPill>
            ) : (
              <TagPill 
                color="neutral" 
                className="metric-badge" 
                onClick={onEditDate}
                title={lang.current.tooltip.setPlannedDate}
              >
                Not set
              </TagPill>
            )}
          </div>
          {showEditButton && (
            <button
              className={styles.editDateBtn}
              onClick={onEditDate}
              title={plannedDate ? 'Edit planned date' : 'Set a planned date'}
            >
              {plannedDate ? 'Update Date' : 'Set Date'}
            </button>
          )}
        </div>
      </div>

      {/* Total Cost */}
      <div className={styles.metricCol}>
        <div className={`metric-card ${styles.fullHeight}`} title={`Estimated cost: $${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}>
          <div className="metric-label">Estimated Cost</div>
          <div className="metric-value metric-value-cost">
            <CostEstimate
              cost={totalCost}
              showTooltip={true}
              compact={true}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(PlanMetricsDisplay);

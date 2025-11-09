/**
 * PlanMetricsDisplay Component
 * Displays metrics for a plan (planned date, completion, cost)
 */

import TagPill from '../../../components/Pill/TagPill';
import { formatDateMetricCard } from '../../../utilities/date-utils';
import { formatCurrency } from '../../../utilities/currency-utils';

export default function PlanMetricsDisplay({
  plannedDate,
  completionPercentage,
  totalCost,
  onEditDate,
  showEditButton = true
}) {
  // Dynamic font size adjustment removed - badges have consistent sizing

  return (
    <div className="plan-metrics row g-3 my-4">
      {/* Planned Date */}
      <div className="col-md-4">
        <div className="metric-card h-100">
          <div className="metric-label">Planned Date</div>
          <div className="metric-value-container">
            {plannedDate ? (
              <TagPill color="primary" className="metric-badge" onClick={onEditDate}>
                {formatDateMetricCard(plannedDate)}
              </TagPill>
            ) : (
              <TagPill color="neutral" className="metric-badge" onClick={onEditDate}>
                Not set
              </TagPill>
            )}
          </div>
          {showEditButton && (
            <button
              className="btn btn-sm btn-outline-primary mt-2"
              onClick={onEditDate}
            >
              {plannedDate ? 'Edit Date' : 'Set Date'}
            </button>
          )}
        </div>
      </div>

      {/* Completion Percentage */}
      <div className="col-md-4">
        <div className="metric-card h-100">
          <div className="metric-label">Completion</div>
          <div className="metric-value">{completionPercentage}%</div>
          <div className="progress mt-2" style={{ height: 'var(--progress-bar-height-sm)' }}>
            <div
              className="progress-bar gradient-animated"
              role="progressbar"
              style={{ width: `${completionPercentage}%` }}
              aria-valuenow={completionPercentage}
              aria-valuemin="0"
              aria-valuemax="100"
            />
          </div>
        </div>
      </div>

      {/* Total Cost */}
      <div className="col-md-4">
        <div className="metric-card h-100">
          <div className="metric-label">Estimated Cost</div>
          <div className="metric-value">{formatCurrency(totalCost)}</div>
        </div>
      </div>
    </div>
  );
}

/**
 * PlanMetricsDisplay Component
 * Displays metrics for a plan (planned date, completion, cost)
 */

import TagPill from '../../../components/Pill/TagPill';
import { formatDateMetricCard } from '../../../utilities/date-utils';
import CostEstimate from '../../../components/CostEstimate/CostEstimate';

export default function PlanMetricsDisplay({
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
    <div className="plan-metrics row g-3 my-4">
      {/* Planned Date */}
      <div className="col-md-4">
        <div className="metric-card h-100" title={fullDateText}>
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
                title="Click to set a planned date"
              >
                Not set
              </TagPill>
            )}
          </div>
          {showEditButton && (
            <button
              className="btn btn-sm btn-outline-primary mt-2"
              onClick={onEditDate}
              title={plannedDate ? 'Edit planned date' : 'Set a planned date'}
            >
              {plannedDate ? 'Edit Date' : 'Set Date'}
            </button>
          )}
        </div>
      </div>

      {/* Completion Percentage */}
      <div className="col-md-4">
        <div className="metric-card h-100" title={`${completionPercentage}% of plan items completed`}>
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
        <div className="metric-card h-100" title={`Estimated cost: $${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}>
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

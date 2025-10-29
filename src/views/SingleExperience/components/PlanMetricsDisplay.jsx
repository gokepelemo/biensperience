/**
 * PlanMetricsDisplay Component
 * Displays metrics for a plan (planned date, completion, cost)
 */

import { useRef, useEffect } from 'react';
import { formatDateMetricCard } from '../../../utilities/date-utils';
import { formatCurrency } from '../../../utilities/currency-utils';

export default function PlanMetricsDisplay({
  plannedDate,
  completionPercentage,
  totalCost,
  onEditDate,
  showEditButton = true
}) {
  const plannedDateRef = useRef(null);

  // Dynamic font size adjustment for planned date
  useEffect(() => {
    const adjustPlannedDateFontSize = () => {
      const element = plannedDateRef.current;
      if (!element) return;

      const container = element.parentElement;
      if (!container) return;

      let fontSize = 24;
      element.style.fontSize = `${fontSize}px`;

      while (element.scrollWidth > container.clientWidth && fontSize > 10) {
        fontSize -= 1;
        element.style.fontSize = `${fontSize}px`;
      }
    };

    if (plannedDate) {
      adjustPlannedDateFontSize();
      window.addEventListener('resize', adjustPlannedDateFontSize);
      return () => window.removeEventListener('resize', adjustPlannedDateFontSize);
    }
  }, [plannedDate]);

  return (
    <div className="plan-metrics row g-3 my-4">
      {/* Planned Date */}
      <div className="col-md-4">
        <div className="metric-card h-100">
          <div className="metric-label">Planned Date</div>
          <div className="metric-value-container">
            <div ref={plannedDateRef} className="metric-value">
              {plannedDate ? formatDateMetricCard(plannedDate) : 'Not set'}
            </div>
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
          <div className="progress mt-2" style={{ height: '8px' }}>
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

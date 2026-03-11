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
import { Box } from '@chakra-ui/react';
import { Button as DSButton } from '../../../components/design-system';

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
    <Box className="plan-metrics" css={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)', marginTop: 'var(--space-6)', marginBottom: 'var(--space-6)', '@media (max-width: 768px)': { gridTemplateColumns: '1fr' } }}>
      {/* Completion Percentage */}
      <Box style={{ minHeight: 0 }}>
        <div className="metric-card" style={{ height: '100%' }} title={`${completionPercentage}% of plan items completed`}>
          <div className="metric-label">Completion</div>
          <div className="metric-value">{completionPercentage}%</div>
          <Box style={{ display: 'flex', overflow: 'hidden', backgroundColor: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius-pill)', marginTop: 'var(--space-2)', height: 'var(--progress-bar-height-sm)' }}>
            <Box
              css={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                overflow: 'hidden',
                textAlign: 'center',
                whiteSpace: 'nowrap',
                transition: 'width 0.6s ease',
                background: 'var(--gradient-primary, linear-gradient(135deg, var(--color-primary), var(--color-primary-light)))',
                backgroundSize: '200% 200%',
                animation: 'gradientShift 3s ease infinite',
                '@keyframes gradientShift': {
                  '0%': { backgroundPosition: '0% 50%' },
                  '50%': { backgroundPosition: '100% 50%' },
                  '100%': { backgroundPosition: '0% 50%' }
                }
              }}
              role="progressbar"
              style={{ width: `${completionPercentage}%` }}
              aria-valuenow={completionPercentage}
              aria-valuemin="0"
              aria-valuemax="100"
            />
          </Box>
        </div>
      </Box>

      {/* Planned Date */}
      <Box style={{ minHeight: 0 }}>
        <div className="metric-card" style={{ height: '100%' }} title={fullDateText}>
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
            <DSButton
              variant="outline"
              size="sm"
              onClick={onEditDate}
              title={plannedDate ? 'Edit planned date' : 'Set a planned date'}
              style={{ marginTop: 'var(--space-2)' }}
            >
              {plannedDate ? 'Update Date' : 'Set Date'}
            </DSButton>
          )}
        </div>
      </Box>

      {/* Total Cost */}
      <Box style={{ minHeight: 0 }}>
        <div className="metric-card" style={{ height: '100%' }} title={`Estimated cost: $${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}>
          <div className="metric-label">Estimated Cost</div>
          <div className="metric-value metric-value-cost">
            <CostEstimate
              cost={totalCost}
              showTooltip={true}
              compact={true}
            />
          </div>
        </div>
      </Box>
    </Box>
  );
}

export default memo(PlanMetricsDisplay);

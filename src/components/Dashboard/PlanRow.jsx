import React, { memo, useCallback } from 'react';
import { Heading, Text, Button, HashLink } from '../design-system';
import { FaCheckCircle, FaCalendar, FaTasks, FaChevronRight, FaUsers } from 'react-icons/fa';
import CostEstimate from '../CostEstimate/CostEstimate';
import ActualCost from '../ActualCost/ActualCost';
import Pill from '../Pill/Pill';
import InfoTooltip from '../InfoTooltip/InfoTooltip';
import { formatDateMetricCard } from '../../utilities/date-utils';
import { lang } from '../../lang.constants';
import { getTotalCostTooltip } from '../../utilities/cost-utils';
import styles from './MyPlans.module.css';

/**
 * PlanRow - Memoized row component for MyPlans list view.
 *
 * Extracted from MyPlans.jsx so each row can short-circuit re-renders
 * when neighbouring plans change but its own data did not. With ~10 plans
 * per page and ~50+ in collaborative scenarios, this avoids re-running
 * the full plan-card render tree (cost rollups, item grids, accordion JSX)
 * on unrelated state changes (e.g. another row toggling expansion).
 *
 * Parent (MyPlans) MUST pass stable callback refs via useCallback for the
 * memoization to be effective. See MyPlans.jsx for the wrapping.
 */
function PlanRow({
  plan,
  isExpanded,
  isCostExpanded,
  collaborators,
  userCurrency,
  calculateTotal,
  onTogglePlan,
  onToggleCost,
}) {
  const itemCount = (plan.plan || []).length;
  const completedCount = (plan.plan || []).filter(item => item.complete).length;

  const completionPercentage = plan.completion_percentage !== undefined
    ? plan.completion_percentage
    : (itemCount > 0 ? Math.round((completedCount / itemCount) * 100) : 0);

  const actualTotalCost = calculateTotal(plan.costs || []);
  const hasActualCosts = plan.costs && plan.costs.length > 0;
  const planEstimate = plan.total_cost || 0;

  const handleHeaderClick = useCallback(() => {
    onTogglePlan(plan._id);
  }, [onTogglePlan, plan._id]);

  const handleHeaderKey = useCallback((e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onTogglePlan(plan._id);
    }
  }, [onTogglePlan, plan._id]);

  const handleCostClick = useCallback((e) => {
    e.stopPropagation();
    onToggleCost(plan._id);
  }, [onToggleCost, plan._id]);

  const handleCostKey = useCallback((e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggleCost(plan._id);
    }
  }, [onToggleCost, plan._id]);

  // Stop click propagation on the inner item links so clicking them
  // doesn't collapse the parent row.
  const stopPropagation = useCallback((e) => e.stopPropagation(), []);

  return (
    <div
      className={`${styles.planCard} ${isExpanded ? styles.expanded : ''}`}
      onClick={handleHeaderClick}
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      aria-label={isExpanded
        ? lang.current.myPlans.collapsePlanAria.replace('{name}', plan.experience?.name || 'Unnamed Experience')
        : lang.current.myPlans.expandPlanAria.replace('{name}', plan.experience?.name || 'Unnamed Experience')}
      onKeyPress={handleHeaderKey}
    >
      {/* Plan Header - Always Visible */}
      <div className={styles.planHeader}>
        <div className={styles.planHeaderContent}>
          <div className={styles.planTitleSection}>
            <div className={styles.planTitleRow}>
              <Heading level={5} className={styles.planTitle}>
                {plan.experience?.name || 'Unnamed Experience'}
              </Heading>
              {plan.isCollaborative && (
                <span className={styles.sharedBadgeWrapper}>
                  <Pill variant="info" size="sm" rounded>
                    <FaUsers size={10} style={{ marginRight: '4px' }} />
                    {lang.current.label.sharedPlan}
                  </Pill>
                  <InfoTooltip
                    id={`shared-plan-${plan._id}`}
                    content={lang.current.label.sharedPlanTooltip.replace('{ownerName}', plan.user?.name || 'the owner')}
                    ariaLabel="Shared plan information"
                  />
                </span>
              )}
            </div>
            <div className={styles.planMeta}>
              <span className={styles.metaItem}>
                <FaTasks size={12} />
                {lang.current.myPlans.itemsProgress.replace('{completed}', completedCount).replace('{total}', itemCount)}
              </span>
              {plan.planned_date && (
                <span className={styles.metaItem}>
                  <FaCalendar size={12} />
                  {formatDateMetricCard(plan.planned_date)}
                </span>
              )}
            </div>
          </div>

          <div className={styles.planHeaderRight}>
            <div className={styles.planCost}>
              {hasActualCosts ? (
                <div className={styles.costBreakdown}>
                  <div className={styles.costRow}>
                    <Text size="sm" variant="muted">{lang.current.label.estimatedLabel}</Text>
                    <Text weight="semibold" size="base">
                      <CostEstimate
                        cost={planEstimate}
                        showTooltip={true}
                        compact={true}
                        isActual={false}
                      />
                    </Text>
                  </div>
                  <div className={styles.costRow}>
                    <Text size="sm" variant="muted">{lang.current.label.actualLabel}</Text>
                    <Text weight="bold" size="lg">
                      <CostEstimate
                        cost={actualTotalCost}
                        currency={userCurrency}
                        showTooltip={true}
                        compact={true}
                        isActual={true}
                        exact={true}
                        costCount={plan.costs?.length}
                      />
                    </Text>
                  </div>
                </div>
              ) : (
                <Text weight="bold" size="lg">
                  <CostEstimate
                    cost={plan.total_cost || 0}
                    showTooltip={true}
                    compact={true}
                    isActual={false}
                    exact={true}
                  />
                </Text>
              )}
            </div>
            <div className={`${styles.expandIcon} ${isExpanded ? styles.rotated : ''}`}>
              <FaChevronRight size={16} />
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className={styles.progressBarContainer}>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${completionPercentage}%` }}
              role="progressbar"
              aria-valuenow={completionPercentage}
              aria-valuemin="0"
              aria-valuemax="100"
            />
          </div>
          <Text size="xs" variant="muted" className={styles.progressText}>
            {lang.current.myPlans.percentComplete.replace('{percent}', completionPercentage)}
          </Text>
        </div>
      </div>

      {/* Plan Body - Collapsible */}
      {isExpanded && (
        <div className={styles.planBody}>
          {/* Plan Items Grid */}
          <div className={styles.planItemsGrid}>
            {(plan.plan || []).map((item) => {
              const isCompleted = item.complete || false;
              const itemLink = `/experiences/${plan.experience?._id || plan.experience}#plan-${plan._id}-item-${item._id}`;

              return (
                <HashLink
                  key={item._id}
                  to={itemLink}
                  className={`${styles.planItem} ${isCompleted ? styles.completed : ''}`}
                  onClick={stopPropagation}
                >
                  {/* Completion Badge */}
                  {isCompleted && (
                    <div className={styles.completionBadge}>
                      <FaCheckCircle size={12} />
                      <span>{lang.current.myPlans.done}</span>
                    </div>
                  )}

                  {/* Item Content */}
                  <div className={styles.itemContent}>
                    <Text
                      weight="semibold"
                      className={styles.itemText}
                      style={{
                        textDecoration: isCompleted ? 'line-through' : 'none',
                        color: isCompleted ? 'var(--color-text-muted)' : 'inherit'
                      }}
                    >
                      {item.text}
                    </Text>
                    {Number(item.cost) > 0 && (
                      <Text size="sm" variant="muted" className={styles.itemCost}>
                        <CostEstimate
                          cost={item.cost}
                          showTooltip={true}
                          compact={true}
                          exact={true}
                        />
                      </Text>
                    )}
                  </div>
                </HashLink>
              );
            })}
          </div>

          {/* Additional Costs */}
          {plan.costs && plan.costs.length > 0 && (
            <div className={styles.additionalCosts}>
              <Heading level={6} className={styles.costSectionHeading}>{lang.current.heading.actualCosts}</Heading>

              {/* Total Cost Accordion */}
              <div className={styles.totalCostAccordion}>
                <div
                  className={`${styles.totalCostCard} ${isCostExpanded ? styles.expanded : ''}`}
                  onClick={handleCostClick}
                  role="button"
                  tabIndex={0}
                  aria-expanded={isCostExpanded}
                  aria-label={isCostExpanded
                    ? lang.current.myPlans.collapseCostBreakdownAria.replace('{name}', plan.experience?.name || 'Unnamed Experience')
                    : lang.current.myPlans.expandCostBreakdownAria.replace('{name}', plan.experience?.name || 'Unnamed Experience')}
                  onKeyPress={handleCostKey}
                >
                  <div className={styles.totalCostHeader}>
                    <Text weight="semibold" size="base" className={styles.totalCostLabel}>{lang.current.label.totalSpent}</Text>
                    <div className={styles.totalCostValue}>
                      <CostEstimate
                        cost={actualTotalCost}
                        currency={userCurrency}
                        showTooltip={true}
                        compact={true}
                        isActual={true}
                        exact={true}
                        tooltipContent={`${lang.current.label.trackedCosts}: ${getTotalCostTooltip(actualTotalCost, plan.costs, { currency: userCurrency })}`}
                        tooltipVariant="light"
                      />
                      <div className={`${styles.expandIcon} ${isCostExpanded ? styles.rotated : ''}`}>
                        <FaChevronRight size={14} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Individual Costs - Accordion Body */}
                {isCostExpanded && (
                  <div className={styles.costsAccordionBody}>
                    <ActualCost
                      costs={plan.costs}
                      collaborators={collaborators || []}
                      planItems={plan.plan || []}
                      plan={plan}
                      currency={userCurrency}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* View Full Experience Button */}
          <div className={styles.planFooter}>
            <HashLink to={`/experiences/${plan.experience?._id || plan.experience}#plan-${plan._id}`}>
              <Button variant="outline" size="md" style={{ width: '100%' }}>
                {lang.current.myPlans.viewFullExperience}
              </Button>
            </HashLink>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(PlanRow);

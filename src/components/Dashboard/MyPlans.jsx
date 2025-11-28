import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Heading,
  Text,
  Button,
  Container,
  Stack,
  FlexBetween,
  FadeIn,
  SkeletonLoader,
  HashLink,
  EmptyState
} from '../design-system';
import { FaCheckCircle, FaCalendar, FaTasks, FaChevronRight } from 'react-icons/fa';
import CostEstimate from '../CostEstimate/CostEstimate';
import { getUserPlans } from '../../utilities/plans-api';
import { usePlanExperience } from '../../contexts/PlanExperienceContext';
import styles from './MyPlans.module.scss';

export default function MyPlans() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedPlanId, setExpandedPlanId] = useState(null);
  const navigate = useNavigate();
  const { openPlanExperienceModal } = usePlanExperience();

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        const resp = await getUserPlans();
        if (!mounted) return;
        // API may return { data: [...] } or an array
        const list = (resp && resp.data) ? resp.data : (Array.isArray(resp) ? resp : (resp?.plans || []));
        setPlans(list);
        // Auto-expand first plan only (default collapsed state)
        if (list.length > 0) {
          setExpandedPlanId(list[0]._id);
        }
      } catch (e) {
        // ignore
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  // Listen for plan updates (e.g., plan item completion changes)
  useEffect(() => {
    const handlePlanUpdated = (event) => {
      // Event payload may have plan data in different locations depending on the source
      // - updatePlanItem: { plan, planId }
      // - updatePlan: { data, planId, version }
      // - reorderPlanItems: { data, planId, version }
      const detail = event.detail || {};
      const plan = detail.plan || detail.data;
      if (!plan || !plan._id) return;

      // Update the plan in local state with fresh data from server
      setPlans((prevPlans) => {
        return prevPlans.map((p) => {
          if (p._id === plan._id) {
            // Merge updated plan data, ensuring we keep the virtual properties
            return {
              ...p,
              ...plan,
              // Ensure completion_percentage is updated
              completion_percentage: plan.completion_percentage !== undefined
                ? plan.completion_percentage
                : p.completion_percentage
            };
          }
          return p;
        });
      });
    };

    window.addEventListener('plan:updated', handlePlanUpdated);
    return () => window.removeEventListener('plan:updated', handlePlanUpdated);
  }, []);

  const togglePlan = (planId) => {
    // If clicking already expanded plan, collapse it
    // Otherwise, expand the clicked plan (collapsing any other)
    setExpandedPlanId(expandedPlanId === planId ? null : planId);
  };

  return (
    <FadeIn>
      <div
        className="my-plans-card"
        style={{
          width: '100%',
          height: '100%',
          padding: 'var(--space-6)',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-light)',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <Heading level={4} className="mb-2">My Plans</Heading>
        <Text size="sm" variant="muted" className="mb-4">
          Your saved plans with progress and cost estimates
        </Text>

        {loading && (
          <Stack spacing="md">
            <SkeletonLoader variant="text" width="100%" height="80px" />
            <SkeletonLoader variant="text" width="100%" height="80px" />
            <SkeletonLoader variant="text" width="100%" height="80px" />
          </Stack>
        )}

        {!loading && plans.length === 0 && (
          <EmptyState
            variant="plans"
            size="md"
            onPrimaryAction={() => navigate('/experiences')}
            onSecondaryAction={() => openPlanExperienceModal()}
          />
        )}

        {!loading && plans.length > 0 && (
          <Stack spacing="md">
            {plans.map((plan) => {
              const isExpanded = expandedPlanId === plan._id;
              const itemCount = (plan.plan || []).length;
              const completedCount = (plan.plan || []).filter(item => item.complete).length;

              // Use server-calculated completion percentage (virtual property)
              // Fallback to local calculation if not available
              const completionPercentage = plan.completion_percentage !== undefined
                ? plan.completion_percentage
                : (itemCount > 0 ? Math.round((completedCount / itemCount) * 100) : 0);

              return (
                <div
                  key={plan._id}
                  className={`${styles.planCard} ${isExpanded ? styles.expanded : ''}`}
                  onClick={() => togglePlan(plan._id)}
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  aria-label={`${isExpanded ? 'Collapse' : 'Expand'} plan for ${plan.experience?.name || 'Unnamed Experience'}`}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      togglePlan(plan._id);
                    }
                  }}
                >
                  {/* Plan Header - Always Visible */}
                  <div className={styles.planHeader}>
                    <div className={styles.planHeaderContent}>
                      <div className={styles.planTitleSection}>
                        <Heading level={5} className={styles.planTitle}>
                          {plan.experience?.name || 'Unnamed Experience'}
                        </Heading>
                        <div className={styles.planMeta}>
                          <span className={styles.metaItem}>
                            <FaTasks size={12} />
                            {completedCount}/{itemCount} items
                          </span>
                          {plan.planned_date && (
                            <span className={styles.metaItem}>
                              <FaCalendar size={12} />
                              {new Date(plan.planned_date).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className={styles.planHeaderRight}>
                        <div className={styles.planCost}>
                          <Text weight="bold" size="lg">
                            <CostEstimate
                              cost={plan.total_cost || 0}
                              showTooltip={true}
                              compact={true}
                            />
                          </Text>
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
                        {completionPercentage}% complete
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
                          const itemLink = `/experiences/${plan.experience?._id || plan.experience}#plan-${plan._id}-item-${item.plan_item_id || item._id}`;

                          return (
                            <HashLink
                              key={item.plan_item_id || item._id}
                              to={itemLink}
                              className={`${styles.planItem} ${isCompleted ? styles.completed : ''}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {/* Completion Badge */}
                              {isCompleted && (
                                <div className={styles.completionBadge}>
                                  <FaCheckCircle size={12} />
                                  <span>Done</span>
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
                          <Heading level={6} className="mb-3">Additional Costs</Heading>
                          <Stack spacing="sm">
                            {plan.costs.map((c) => (
                              <FlexBetween
                                key={c._id || `${c.title}-${c.cost}`}
                                className={styles.costItem}
                              >
                                <div className={styles.costInfo}>
                                  <Text weight="semibold">{c.title}</Text>
                                  {c.description && (
                                    <Text size="sm" variant="muted">{c.description}</Text>
                                  )}
                                </div>
                                <Text weight="semibold">
                                  <CostEstimate
                                    cost={c.cost || 0}
                                    currency={c.currency || 'USD'}
                                    showTooltip={true}
                                    compact={true}
                                  />
                                </Text>
                              </FlexBetween>
                            ))}
                          </Stack>
                        </div>
                      )}

                      {/* View Full Experience Button */}
                      <div className={styles.planFooter}>
                        <HashLink to={`/experiences/${plan.experience?._id || plan.experience}#plan-${plan._id}`}>
                          <Button variant="outline" size="md" style={{ width: '100%' }}>
                            View Full Experience
                          </Button>
                        </HashLink>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </Stack>
        )}
      </div>
    </FadeIn>
  );
}

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { unstable_batchedUpdates as batchedUpdates } from 'react-dom';
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
import { FaCheckCircle, FaCalendar, FaTasks, FaChevronRight, FaChevronDown, FaUsers, FaList, FaUser, FaUserFriends } from 'react-icons/fa';
import CostEstimate from '../CostEstimate/CostEstimate';
import ActualCost from '../ActualCost/ActualCost';
import Pill from '../Pill/Pill';
import InfoTooltip from '../InfoTooltip/InfoTooltip';
import { SearchableSelect } from '../FormField';
import { getUserPlans, getCollaborators } from '../../utilities/plans-api';
import { usePlanExperience } from '../../contexts/PlanExperienceContext';
import { formatDateMetricCard } from '../../utilities/date-utils';
import { eventBus } from '../../utilities/event-bus';
import { lang } from '../../lang.constants';
import { getTotalCostTooltip } from '../../utilities/cost-utils';
import styles from './MyPlans.module.scss';

const PLANS_PER_PAGE = 10;

// Filter options for plans
const PLAN_FILTERS = {
  ALL: 'all',
  OWNED: 'owned',
  SHARED: 'shared'
};

export default function MyPlans() {
  const [plans, setPlans] = useState([]);
  const [planFilter, setPlanFilter] = useState(PLAN_FILTERS.ALL);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [expandedPlanId, setExpandedPlanId] = useState(null);
  const [expandedCostAccordions, setExpandedCostAccordions] = useState(new Set());
  const [collaborators, setCollaborators] = useState(new Map()); // planId -> collaborators array
  const [pagination, setPagination] = useState({ page: 1, hasMore: false, totalCount: 0 });
  const navigate = useNavigate();
  const { openPlanExperienceModal } = usePlanExperience();

  // Filter plans based on dropdown selection
  const ownedPlans = plans.filter(plan => !plan.isCollaborative);
  const sharedPlans = plans.filter(plan => plan.isCollaborative);
  const displayedPlans = planFilter === PLAN_FILTERS.ALL
    ? plans
    : planFilter === PLAN_FILTERS.OWNED
      ? ownedPlans
      : sharedPlans;

  // Filter options for searchable select with icons
  const filterOptions = useMemo(() => [
    { value: PLAN_FILTERS.ALL, label: 'All Plans', icon: FaList, suffix: `${plans.length}` },
    { value: PLAN_FILTERS.OWNED, label: 'My Plans', icon: FaUser, suffix: `${ownedPlans.length}` },
    { value: PLAN_FILTERS.SHARED, label: 'Shared', icon: FaUserFriends, suffix: `${sharedPlans.length}` }
  ], [plans.length, ownedPlans.length, sharedPlans.length]);

  // Fetch collaborators for a list of plans in parallel
  const fetchCollaboratorsForPlans = async (planList) => {
    const collaboratorPromises = planList.map(async (plan) => {
      try {
        const planCollaborators = await getCollaborators(plan._id);
        return { planId: plan._id, collaborators: planCollaborators || [] };
      } catch (e) {
        return { planId: plan._id, collaborators: [] };
      }
    });

    const collaboratorResults = await Promise.all(collaboratorPromises);
    return collaboratorResults;
  };

  // Ref to track if initial load has completed (for merge pattern decisions)
  const initialLoadCompleteRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        // Use pagination for initial load
        const resp = await getUserPlans({ paginate: true, page: 1, limit: PLANS_PER_PAGE });
        if (!mounted) return;

        // Handle paginated response
        const list = resp?.data || [];
        const paginationData = resp?.pagination || { page: 1, hasMore: false, totalCount: list.length };

        // CRITICAL FIX (biensperience-c063): Use merge pattern to prevent UI flash
        // Batch all state updates together to prevent intermediate renders
        batchedUpdates(() => {
          setPlans(prev => {
            // On initial load (prev=[]), just use API data
            if (!initialLoadCompleteRef.current || prev.length === 0) {
              return list;
            }
            // If API returns empty but we had data, preserve existing (trust events for deletions)
            if (list.length === 0 && prev.length > 0) {
              return prev;
            }
            // Normal case: use fresh data from API
            return list;
          });
          setPagination(paginationData);
        });

        // Mark initial load as complete
        initialLoadCompleteRef.current = true;

        // Fetch collaborators for all plans in parallel
        const collaboratorResults = await fetchCollaboratorsForPlans(list);
        if (!mounted) return;

        const collaboratorsMap = new Map();
        collaboratorResults.forEach(({ planId, collaborators: collabs }) => {
          collaboratorsMap.set(planId, collabs);
        });
        setCollaborators(collaboratorsMap);

        // Auto-expand first plan only (default collapsed state)
        if (list.length > 0) {
          setExpandedPlanId(list[0]._id);
        }
      } catch (e) {
        // On error, preserve existing state - don't flash to empty
        // The UI will show current data which may be stale but is better than empty
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  // Load more plans handler
  const handleLoadMore = async () => {
    if (loadingMore || !pagination.hasMore) return;

    try {
      setLoadingMore(true);
      const nextPage = pagination.page + 1;
      const resp = await getUserPlans({ paginate: true, page: nextPage, limit: PLANS_PER_PAGE });

      const newPlans = resp?.data || [];
      const paginationData = resp?.pagination || { page: nextPage, hasMore: false };

      // Fetch collaborators for new plans
      const collaboratorResults = await fetchCollaboratorsForPlans(newPlans);

      // Merge new collaborators with existing
      setCollaborators(prev => {
        const newMap = new Map(prev);
        collaboratorResults.forEach(({ planId, collaborators: collabs }) => {
          newMap.set(planId, collabs);
        });
        return newMap;
      });

      // Append new plans
      setPlans(prev => [...prev, ...newPlans]);
      setPagination(paginationData);
    } catch (e) {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  };

  // Listen for plan events (created, updated, deleted)
  useEffect(() => {
    // Handle plan:created - add new plan to list
    const unsubscribeCreated = eventBus.subscribe('plan:created', async (event) => {
      const detail = event.detail || {};
      const plan = detail.plan || detail.data;
      if (!plan || !plan._id) return;

      // Add new plan to list (at the beginning, most recent first)
      setPlans(prev => {
        // Check if plan already exists (deduplication)
        const exists = prev.some(p => p._id === plan._id);
        if (exists) {
          // Update existing instead of adding duplicate
          return prev.map(p => p._id === plan._id ? { ...p, ...plan } : p);
        }
        // Add to beginning of list
        return [plan, ...prev];
      });

      // Update pagination count
      setPagination(prev => ({
        ...prev,
        totalCount: prev.totalCount + 1
      }));

      // Fetch collaborators for new plan
      try {
        const planCollaborators = await getCollaborators(plan._id);
        setCollaborators(prev => new Map(prev).set(plan._id, planCollaborators || []));
      } catch (e) {
        // If collaborators fetch fails, keep existing data
      }
    });

    // Handle plan:updated - merge updates into existing plan
    const unsubscribeUpdated = eventBus.subscribe('plan:updated', async (event) => {
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

      // Refresh collaborators for this plan
      try {
        const planCollaborators = await getCollaborators(plan._id);
        setCollaborators(prev => new Map(prev).set(plan._id, planCollaborators || []));
      } catch (e) {
        // If collaborators fetch fails, keep existing data
      }
    });

    // Handle plan:deleted - remove plan from list
    const unsubscribeDeleted = eventBus.subscribe('plan:deleted', (event) => {
      const detail = event.detail || {};
      const planId = detail.planId;
      if (!planId) return;

      // Remove plan from list
      setPlans(prev => prev.filter(p => p._id !== planId));

      // Update pagination count
      setPagination(prev => ({
        ...prev,
        totalCount: Math.max(0, prev.totalCount - 1)
      }));

      // Remove collaborators for deleted plan
      setCollaborators(prev => {
        const newMap = new Map(prev);
        newMap.delete(planId);
        return newMap;
      });

      // If expanded plan was deleted, clear expansion
      setExpandedPlanId(prev => prev === planId ? null : prev);
    });

    return () => {
      unsubscribeCreated();
      unsubscribeUpdated();
      unsubscribeDeleted();
    };
  }, []);

  const togglePlan = (planId) => {
    // If clicking already expanded plan, collapse it
    // Otherwise, expand the clicked plan (collapsing any other)
    setExpandedPlanId(expandedPlanId === planId ? null : planId);
  };

  const toggleCostAccordion = (planId) => {
    setExpandedCostAccordions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(planId)) {
        newSet.delete(planId);
      } else {
        newSet.add(planId);
      }
      return newSet;
    });
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
        <div className={styles.headerWrapper}>
          <FlexBetween className="mb-2">
            <Heading level={4}>{lang.en.heading.myPlans}</Heading>
            {plans.length > 0 && (
              <div className={styles.planFilterDropdown}>
                <SearchableSelect
                  options={filterOptions}
                  value={planFilter}
                  onChange={setPlanFilter}
                  placeholder="Filter plans"
                  searchable={false}
                  size="sm"
                  aria-label="Filter plans"
                />
              </div>
            )}
          </FlexBetween>
        </div>
        <Text size="sm" variant="muted" className="mb-4">
          {lang.en.dashboard.myPlansDescription}
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

        {!loading && plans.length > 0 && displayedPlans.length === 0 && (
          <EmptyState
            variant="plans"
            size="md"
            title={planFilter === PLAN_FILTERS.SHARED ? "No shared plans yet" : "No plans in this category"}
            description={planFilter === PLAN_FILTERS.SHARED
              ? "When someone shares a plan with you, it will appear here."
              : "Try changing the filter to see other plans."}
          />
        )}

        {!loading && displayedPlans.length > 0 && (
          <Stack spacing="md">
            {displayedPlans.map((plan) => {
              const isExpanded = expandedPlanId === plan._id;
              const itemCount = (plan.plan || []).length;
              const completedCount = (plan.plan || []).filter(item => item.complete).length;

              // Use server-calculated completion percentage (virtual property)
              // Fallback to local calculation if not available
              const completionPercentage = plan.completion_percentage !== undefined
                ? plan.completion_percentage
                : (itemCount > 0 ? Math.round((completedCount / itemCount) * 100) : 0);

              // Calculate actual total cost from plan costs
              const actualTotalCost = (plan.costs || []).reduce((sum, cost) => sum + (cost.cost || 0), 0);
              const hasActualCosts = plan.costs && plan.costs.length > 0;
              const experienceEstimate = plan.experience?.cost_estimate || 0;
              const planEstimate = plan.total_cost || 0;

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
                        <div className={styles.planTitleRow}>
                          <Heading level={5} className={styles.planTitle}>
                            {plan.experience?.name || 'Unnamed Experience'}
                          </Heading>
                          {plan.isCollaborative && (
                            <span className={styles.sharedBadgeWrapper}>
                              <Pill variant="info" size="sm" rounded>
                                <FaUsers size={10} style={{ marginRight: '4px' }} />
                                {lang.en.label.sharedPlan}
                              </Pill>
                              <InfoTooltip
                                id={`shared-plan-${plan._id}`}
                                content={lang.en.label.sharedPlanTooltip.replace('{ownerName}', plan.user?.name || 'the owner')}
                                ariaLabel="Shared plan information"
                              />
                            </span>
                          )}
                        </div>
                        <div className={styles.planMeta}>
                          <span className={styles.metaItem}>
                            <FaTasks size={12} />
                            {completedCount}/{itemCount} items
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
                                <Text size="sm" variant="muted">{lang.en.label.estimatedLabel}</Text>
                                <Text weight="semibold" size="md">
                                  <CostEstimate
                                    cost={planEstimate}
                                    showTooltip={true}
                                    compact={true}
                                    isActual={false}
                                  />
                                </Text>
                              </div>
                              <div className={styles.costRow}>
                                <Text size="sm" variant="muted">{lang.en.label.actualLabel}</Text>
                                <Text weight="bold" size="lg">
                                  <CostEstimate
                                    cost={actualTotalCost}
                                    showTooltip={true}
                                    compact={true}
                                    isActual={true}
                                    exact={true}
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
                          const itemLink = `/experiences/${plan.experience?._id || plan.experience}#plan-${plan._id}-item-${item._id}`;

                          return (
                            <HashLink
                              key={item._id}
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
                                      isActual={true}
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
                          <Heading level={6} className="mb-3">{lang.en.heading.actualCosts}</Heading>
                          
                          {/* Total Cost Accordion */}
                          <div className={styles.totalCostAccordion}>
                            <div 
                              className={`${styles.totalCostCard} ${expandedCostAccordions.has(plan._id) ? styles.expanded : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleCostAccordion(plan._id);
                              }}
                              role="button"
                              tabIndex={0}
                              aria-expanded={expandedCostAccordions.has(plan._id)}
                              aria-label={`${expandedCostAccordions.has(plan._id) ? 'Collapse' : 'Expand'} cost breakdown for ${plan.experience?.name || 'Unnamed Experience'}`}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  toggleCostAccordion(plan._id);
                                }
                              }}
                            >
                              <div className={styles.totalCostHeader}>
                                <Text weight="semibold" size="md">{lang.en.label.totalSpent}</Text>
                                <div className={styles.totalCostValue}>
                                  <CostEstimate
                                    cost={actualTotalCost}
                                    currency="USD"
                                    showTooltip={true}
                                    compact={true}
                                    isActual={true}
                                    exact={true}
                                    tooltipContent={getTotalCostTooltip(actualTotalCost, plan.costs, { currency: 'USD' })}
                                  />
                                  <div className={`${styles.expandIcon} ${expandedCostAccordions.has(plan._id) ? styles.rotated : ''}`}>
                                    <FaChevronRight size={14} />
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Individual Costs - Accordion Body */}
                            {expandedCostAccordions.has(plan._id) && (
                              <div className={styles.costsAccordionBody}>
                                <ActualCost
                                  costs={plan.costs}
                                  collaborators={collaborators.get(plan._id) || []}
                                  planItems={plan.plan || []}
                                  plan={plan}
                                  currency="USD"
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
                            View Full Experience
                          </Button>
                        </HashLink>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Load More Button */}
            {pagination.hasMore && (
              <div style={{ textAlign: 'center', marginTop: 'var(--space-4)' }}>
                <Button
                  variant="outline"
                  size="md"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? 'Loading...' : `Load More (${pagination.totalCount - plans.length} remaining)`}
                </Button>
              </div>
            )}
          </Stack>
        )}
      </div>
    </FadeIn>
  );
}

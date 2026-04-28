import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { unstable_batchedUpdates as batchedUpdates } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Heading,
  Text,
  Button,
  Stack,
  FlexBetween,
  FadeIn,
  SkeletonLoader,
  EmptyState
} from '../design-system';
import { FaCalendarAlt, FaList, FaUser, FaUserFriends, FaThList } from 'react-icons/fa';
import { SearchableSelectBasic } from '../FormField';
import { getUserPlans, getCollaborators } from '../../utilities/plans-api';
import { usePlanExperience } from '../../contexts/PlanExperienceContext';
import { eventBus } from '../../utilities/event-bus';
import { lang } from '../../lang.constants';
import { useViewModePreference } from '../../hooks/useUIPreference';
import { useCurrencyConversion } from '../../hooks/useCurrencyConversion';
import { useDataTransition } from '../../hooks/useDataTransition';
import PlanCalendar from './PlanCalendar';
import PlanRow from './PlanRow';
import styles from './MyPlans.module.css';

// View mode options (kept for local use, matches VIEW_MODES from preferences)
const VIEW_MODES = {
  LIST: 'list',
  CALENDAR: 'calendar'
};

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
  // Use persisted view mode preference
  const { viewMode, setViewMode } = useViewModePreference('myPlans', VIEW_MODES.LIST);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [expandedPlanId, setExpandedPlanId] = useState(null);
  const [expandedCostAccordions, setExpandedCostAccordions] = useState(new Set());
  const [collaborators, setCollaborators] = useState(new Map()); // planId -> collaborators array
  const [pagination, setPagination] = useState({
    page: 1,
    hasMore: false,
    totalCount: 0,
    totalOwnedCount: 0,
    totalSharedCount: 0
  });
  const navigate = useNavigate();
  const { openPlanExperienceModal } = usePlanExperience();

  // Currency conversion hook for proper cost rollups
  const { calculateTotal, formatTotal, userCurrency } = useCurrencyConversion();

  // Filter plans based on dropdown selection - memoize to prevent new array references
  // that would cause PlanCalendar to re-render and tooltips to flash in a loop
  const displayedPlans = useMemo(() => {
    if (planFilter === PLAN_FILTERS.ALL) return plans;
    if (planFilter === PLAN_FILTERS.OWNED) return plans.filter(plan => !plan.isCollaborative);
    return plans.filter(plan => plan.isCollaborative);
  }, [plans, planFilter]);

  // Filter options for searchable select with icons
  // Use pagination totals (from API) for accurate counts across all pages
  const filterOptions = useMemo(() => [
    { value: PLAN_FILTERS.ALL, label: lang.current.myPlans.filterAll, icon: FaList, suffix: `${pagination.totalCount}` },
    { value: PLAN_FILTERS.OWNED, label: lang.current.myPlans.filterMyPlans, icon: FaUser, suffix: `${pagination.totalOwnedCount}` },
    { value: PLAN_FILTERS.SHARED, label: lang.current.myPlans.filterSharedPlans, icon: FaUserFriends, suffix: `${pagination.totalSharedCount}` }
  ], [pagination.totalCount, pagination.totalOwnedCount, pagination.totalSharedCount]);

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
        // Fallback for pagination data - compute counts from loaded data if API doesn't provide them
        const ownedCount = list.filter(p => !p.isCollaborative).length;
        const sharedCount = list.filter(p => p.isCollaborative).length;
        const paginationData = resp?.pagination || {
          page: 1,
          hasMore: false,
          totalCount: list.length,
          totalOwnedCount: ownedCount,
          totalSharedCount: sharedCount
        };

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
      const plan = event.plan || event.data;
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

      // Update pagination counts (total and owned/shared)
      // New plans created by the current user are owned (not collaborative)
      const isCollaborative = plan.isCollaborative || false;
      setPagination(prev => ({
        ...prev,
        totalCount: prev.totalCount + 1,
        totalOwnedCount: isCollaborative ? prev.totalOwnedCount : prev.totalOwnedCount + 1,
        totalSharedCount: isCollaborative ? prev.totalSharedCount + 1 : prev.totalSharedCount
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
      const plan = event.plan || event.data;
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
      const planId = event.planId;
      if (!planId) return;

      // Use batchedUpdates to ensure both state updates see the same plan data
      batchedUpdates(() => {
        // Find the plan to determine if it's owned or shared, then remove and update counts
        setPlans(prev => {
          const planToRemove = prev.find(p => p._id === planId);
          const wasCollaborative = planToRemove?.isCollaborative || false;

          // Update pagination counts based on the plan type
          setPagination(prevPagination => ({
            ...prevPagination,
            totalCount: Math.max(0, prevPagination.totalCount - 1),
            totalOwnedCount: wasCollaborative ? prevPagination.totalOwnedCount : Math.max(0, prevPagination.totalOwnedCount - 1),
            totalSharedCount: wasCollaborative ? Math.max(0, prevPagination.totalSharedCount - 1) : prevPagination.totalSharedCount
          }));

          return prev.filter(p => p._id !== planId);
        });
      });

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

  // Stable callback so memoized PlanRow children don't re-render on parent state changes.
  // Use functional setState so we don't depend on `expandedPlanId` in the dep array.
  const togglePlan = useCallback((planId) => {
    setExpandedPlanId(prev => (prev === planId ? null : planId));
  }, []);

  // Subtle animation when plans data changes (new plans, completions, cost changes)
  const { transitionClass: plansTransitionClass } = useDataTransition(displayedPlans, {
    animation: 'highlight',
    selectFields: (plans) => plans?.map(p => ({
      id: p._id,
      completed: (p.plan || []).filter(i => i.complete).length,
      cost: p.total_cost,
      date: p.planned_date,
    })),
  });

  const toggleCostAccordion = useCallback((planId) => {
    setExpandedCostAccordions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(planId)) {
        newSet.delete(planId);
      } else {
        newSet.add(planId);
      }
      return newSet;
    });
  }, []);

  // Stable view mode handlers
  const handleSetListView = useCallback(() => setViewMode(VIEW_MODES.LIST), [setViewMode]);
  const handleSetCalendarView = useCallback(() => setViewMode(VIEW_MODES.CALENDAR), [setViewMode]);

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
          <FlexBetween className={styles.headerBottomSpacing}>
            <Heading level={2}>{lang.current.heading.plans}</Heading>
            <div className={styles.headerControls}>
              {/* View mode toggle */}
              {plans.length > 0 && (
                <div className={styles.viewToggle} role="group" aria-label={lang.current.dashboardView.viewMode}>
                  <button
                    type="button"
                    className={`${styles.viewToggleButton} ${viewMode === VIEW_MODES.LIST ? styles.active : ''}`}
                    onClick={handleSetListView}
                    aria-pressed={viewMode === VIEW_MODES.LIST}
                    title={lang.current.dashboardView.listView}
                  >
                    <FaThList size={14} />
                  </button>
                  <button
                    type="button"
                    className={`${styles.viewToggleButton} ${viewMode === VIEW_MODES.CALENDAR ? styles.active : ''}`}
                    onClick={handleSetCalendarView}
                    aria-pressed={viewMode === VIEW_MODES.CALENDAR}
                    title={lang.current.dashboardView.calendarView}
                  >
                    <FaCalendarAlt size={14} />
                  </button>
                </div>
              )}
              {/* Filter dropdown */}
              {plans.length > 0 && (
                <div className={styles.planFilterDropdown}>
                  <SearchableSelectBasic
                    options={filterOptions}
                    value={planFilter}
                    onChange={setPlanFilter}
                    placeholder={lang.current.dashboardView.filterPlans}
                    searchable={false}
                    size="md"
                    aria-label={lang.current.dashboardView.filterPlans}
                  />
                </div>
              )}
            </div>
          </FlexBetween>
        </div>
        <Text size="sm" variant="muted" className={`mb-4 ${styles.subheading}`}>
          {lang.current.dashboard.myPlansDescription}
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
            title={planFilter === PLAN_FILTERS.SHARED ? lang.current.myPlans.noSharedPlans : lang.current.myPlans.noPlansInCategory}
            description={planFilter === PLAN_FILTERS.SHARED
              ? lang.current.myPlans.noSharedPlansDescription
              : lang.current.myPlans.noPlansInCategoryDescription}
          />
        )}

        {/* Calendar View */}
        {!loading && displayedPlans.length > 0 && viewMode === VIEW_MODES.CALENDAR && (
          <PlanCalendar plans={displayedPlans} />
        )}

        {/* List View */}
        {!loading && displayedPlans.length > 0 && viewMode === VIEW_MODES.LIST && (
          <Stack spacing="md" className={plansTransitionClass}>
            {displayedPlans.map((plan) => (
              <PlanRow
                key={plan._id}
                plan={plan}
                isExpanded={expandedPlanId === plan._id}
                isCostExpanded={expandedCostAccordions.has(plan._id)}
                collaborators={collaborators.get(plan._id)}
                userCurrency={userCurrency}
                calculateTotal={calculateTotal}
                onTogglePlan={togglePlan}
                onToggleCost={toggleCostAccordion}
              />
            ))}

            {/* Load More Button */}
            {pagination.hasMore && (
              <div style={{ textAlign: 'center', marginTop: 'var(--space-4)' }}>
                <Button
                  variant="outline"
                  size="md"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? lang.current.myPlans.loading : lang.current.button.loadMore}
                </Button>
              </div>
            )}
          </Stack>
        )}
      </div>
    </FadeIn>
  );
}

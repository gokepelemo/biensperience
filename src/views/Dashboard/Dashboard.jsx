import React, { useState, useEffect, useRef } from 'react';
import { Card, Button } from 'react-bootstrap';
import { FaCalendar, FaStar, FaMapMarkerAlt, FaDollarSign } from 'react-icons/fa';
import { getDashboardData } from '../../utilities/dashboard-api';
import { getUser } from '../../utilities/users-service';
import { formatCostEstimate } from '../../utilities/cost-utils';
import { formatCurrency } from '../../utilities/currency-utils';
import { logger } from '../../utilities/logger';
import { useToast } from '../../contexts/ToastContext';
import { SkeletonLoader, Heading, Text } from '../../components/design-system';
import { eventBus } from '../../utilities/event-bus';
import { lang } from '../../lang.constants';
import {
  StatsCard,
  ActivityList,
  QuickActions,
  UpcomingPlans,
  ActivePlansCard,
  MyPlans,
  Preferences,
} from '../../components/Dashboard';
import MessagesModal from '../../components/ChatModal/MessagesModal';
import ViewNav from '../../components/ViewNav';
import styles from './Dashboard.module.scss';

export default function Dashboard() {
  const [dashboardData, setDashboardData] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [showMessagesModal, setShowMessagesModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const user = getUser();
  const toast = useToast();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    try {
      const hash = (window.location.hash || '').replace('#', '');
      if (!hash) return;

      // Messages is modal-only (no dedicated tab content)
      if (hash === 'messages') {
        setShowMessagesModal(true);
        // Restore the previous tab to avoid navigating to an empty view
        try {
          window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#overview`);
        } catch (e) {
          // ignore
        }
        return;
      }

      if (['overview', 'plans', 'preferences'].includes(hash)) {
        setActiveTab(hash);
        return;
      }
      
      if (hash === 'quick-actions' && quickActionsRef.current) {
        quickActionsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (hash === 'upcoming-plans' && upcomingPlansRef.current) {
        upcomingPlansRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    } catch (e) {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handlePlanUpdated = () => {
      logger.debug('[Dashboard] Plan updated event received, refreshing dashboard');
      fetchDashboardData();
    };

    // Subscribe to standardized plan:updated event via event bus
    const unsubscribePlanUpdated = eventBus.subscribe('plan:updated', handlePlanUpdated);

    return () => {
      unsubscribePlanUpdated();
    };
  }, []);

  const quickActionsRef = useRef(null);
  const upcomingPlansRef = useRef(null);

  const handleSelectNav = (key) => {
    if (key === 'messages') {
      setShowMessagesModal(true);
      return;
    }
    setActiveTab(key);
  };

  const handleCloseMessagesModal = () => {
    setShowMessagesModal(false);
    // Clean up the URL hash if it's currently '#messages' to prevent re-triggering
    if (window.location.hash === '#messages') {
      try {
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${activeTab}`);
      } catch (e) {
        // ignore
      }
    }
  };

  useEffect(() => {
    const onHashChange = () => {
      try {
        const hash = (window.location.hash || '').replace('#', '');
        if (!hash) return;

        // Messages is modal-only (no dedicated tab content)
        if (hash === 'messages') {
          setShowMessagesModal(true);
          try {
            window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${activeTab}`);
          } catch (e) {
            // ignore
          }
          return;
        }

        if (['overview', 'plans', 'preferences'].includes(hash)) {
          setActiveTab(hash);
          return;
        }
        if (hash === 'quick-actions' && quickActionsRef.current) {
          quickActionsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }
        if (hash === 'upcoming-plans' && upcomingPlansRef.current) {
          upcomingPlansRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }
      } catch (e) {}
    };

    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [activeTab]);

  async function fetchDashboardData() {
    try {
      setLoading(true);
      setError(null);
      logger.debug('[Dashboard] Fetching dashboard data');

      const data = await getDashboardData();
      setDashboardData(data);
      logger.info('[Dashboard] Dashboard data loaded', {
        stats: data.stats,
        activityCount: data.recentActivity?.length || 0,
        upcomingPlansCount: data.upcomingPlans?.length || 0,
      });
    } catch (err) {
      logger.error('[Dashboard] Failed to load dashboard data', err);
      const message = err?.message || lang.current.alert.failedToLoadDashboardData;
      try {
        toast.error(message, { header: 'Dashboard Error', duration: 8000 });
      } catch (e) {
        logger.debug('[Dashboard] Toast provider not available', e);
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <DashboardSkeleton />;

  if (!dashboardData) {
    return (
      <Container className={styles.errorContainer}>
        <Card
          style={{
            backgroundColor: 'var(--color-bg-primary)',
            border: '1px solid var(--color-border-light)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-6)',
            textAlign: 'center',
          }}
        >
          <div className={styles.errorIcon}>
            <FaStar size={48} />
          </div>
          <Heading level={2} className={styles.errorTitle}>
            {lang.current.heading.dashboardUnavailable}
          </Heading>
          <Text className={styles.errorMessage}>{error || lang.current.alert.unableToLoadDashboard}</Text>
          <Button onClick={fetchDashboardData} variant="primary">
            Try Again
          </Button>
        </Card>
      </Container>
    );
  }

  const { stats = {}, recentActivity = [], upcomingPlans = [] } = dashboardData;

  const activePlansValue = typeof stats.activePlans === 'number' ? stats.activePlans : 0;
  const experiencesValue = typeof stats.experiences === 'number' ? stats.experiences : 0;
  const destinationsValue = typeof stats.destinations === 'number' ? stats.destinations : 0;
  const totalSpentValue = typeof stats.totalSpent === 'number' ? stats.totalSpent : 0;

  // Navigation items with optional badges
  const navItems = [
    { key: 'overview', label: lang.current.label.dashboard },
    { key: 'plans', label: lang.current.heading.plans, badge: activePlansValue || undefined },
    { key: 'messages', label: lang.current.label.messages },
    { key: 'preferences', label: lang.current.label.preferences },
  ];

  return (
    <div className={styles.dashboardContainer}>
      {/* Mobile/Tablet navigation - shown at top before content */}
      <div className={styles.mobileNav}>
        <ViewNav
          items={navItems}
          activeKey={activeTab}
          onSelect={handleSelectNav}
        />
      </div>

      {/* CSS Grid Layout - Sidebar + Main Content */}
      <div className={styles.dashboardLayout}>
        {/* Desktop sidebar navigation */}
        <aside className={styles.dashboardSidebar}>
          <ViewNav
            items={navItems}
            activeKey={activeTab}
            onSelect={handleSelectNav}
          />
        </aside>

        {/* Main content area */}
        <main className={styles.dashboardMain}>
          {activeTab === 'overview' && (
            <>
              <div className={styles.welcomeSection}>
                <Heading level={1} className={styles.welcomeTitle}>
                  Welcome back, {user?.name?.split(' ')[0] || 'Traveler'}!
                </Heading>
                <Text className={styles.welcomeSubtitle}>
                  Here's what's happening with your travel plans
                </Text>
              </div>

              {/* Stats Grid - 4 equal columns */}
              <div className={styles.statsGrid}>
                <ActivePlansCard stats={dashboardData.stats} loading={loading} />
                <StatsCard
                  label={experiencesValue === 1 ? 'Experience' : 'Experiences'}
                  value={experiencesValue}
                  color="var(--color-success)"
                  icon={<FaStar />}
                />
                <StatsCard
                  label={destinationsValue === 1 ? 'Destination' : 'Destinations'}
                  value={destinationsValue}
                  color="var(--color-warning)"
                  icon={<FaMapMarkerAlt />}
                />
                <StatsCard
                  label="Estimated Cost"
                  value={formatCostEstimate(totalSpentValue)}
                  color="var(--color-info)"
                  icon={<FaDollarSign />}
                  tooltip={`Cost estimate: ${formatCurrency(totalSpentValue)}`}
                />
              </div>

              {/* Main content grid - Activity + Side column */}
              <div className={styles.mainContentGrid}>
                <div className={styles.activityColumn}>
                  <ActivityList initialActivities={recentActivity} />
                </div>

                <div className={styles.sideColumn}>
                  <div className={styles.quickActionsWrapper} ref={quickActionsRef}>
                    <QuickActions />
                  </div>

                  <div className={styles.upcomingPlansWrapper} ref={upcomingPlansRef}>
                    <UpcomingPlans plans={upcomingPlans} />
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'plans' && (
            <div className={styles.tabContentFlex}>
              <MyPlans />
            </div>
          )}

          {activeTab === 'preferences' && (
            <div className={styles.tabContentFlex}>
              <Preferences />
            </div>
          )}
        </main>
      </div>

      <MessagesModal
        show={showMessagesModal}
        onClose={handleCloseMessagesModal}
      />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className={styles.dashboardContainer}>
      {/* CSS Grid Layout - matches real dashboard */}
      <div className={styles.skeletonLayout}>
        {/* Sidebar skeleton */}
        <aside className={styles.skeletonSidebar}>
          <SkeletonLoader variant="text" width="120px" height={24} className={styles.skeletonSidebarTitle} />
          <div className={styles.skeletonNavItems}>
            {/* 4 nav items to match actual navigation */}
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonLoader key={i} variant="rectangle" width="100%" height={40} />
            ))}
          </div>
        </aside>

        {/* Main content skeleton */}
        <main className={styles.skeletonMain}>
          {/* Welcome section skeleton */}
          <div className={styles.skeletonWelcome}>
            <SkeletonLoader variant="text" width="320px" height={36} className={styles.skeletonWelcomeTitle} />
            <SkeletonLoader variant="text" width="280px" height={20} className={styles.skeletonWelcomeSubtitle} />
          </div>

          {/* Stats grid skeleton - 4 cards matching actual layout */}
          <div className={styles.skeletonStatsGrid}>
            {/* ActivePlansCard skeleton - taller due to breakdown */}
            <div className={styles.skeletonActivePlansCard}>
              <div className={styles.skeletonActivePlansContent}>
                <SkeletonLoader variant="text" width="48px" height={36} />
                <SkeletonLoader variant="text" width="100px" height={16} />
                <div className={styles.skeletonActivePlansBreakdown}>
                  <SkeletonLoader variant="text" width="80px" height={14} />
                  <SkeletonLoader variant="text" width="70px" height={14} />
                </div>
              </div>
              <SkeletonLoader variant="rectangle" className={styles.skeletonStatIcon} />
            </div>

            {/* 3 StatsCard skeletons */}
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={styles.skeletonStatCard}>
                <div className={styles.skeletonStatContent}>
                  <SkeletonLoader variant="text" width="48px" height={36} />
                  <SkeletonLoader variant="text" width="90px" height={16} />
                </div>
                <SkeletonLoader variant="rectangle" className={styles.skeletonStatIcon} />
              </div>
            ))}
          </div>

          {/* Main content grid skeleton */}
          <div className={styles.skeletonContentGrid}>
            {/* Activity card skeleton */}
            <div className={styles.skeletonActivityCard}>
              <SkeletonLoader variant="text" width="140px" height={24} className={styles.skeletonActivityTitle} />
              <div className={styles.skeletonActivityList}>
                {/* 4 activity items to match typical list */}
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className={styles.skeletonActivityItem}>
                    <div className={styles.skeletonActivityItemContent}>
                      <SkeletonLoader variant="text" width="70%" height={16} />
                      <SkeletonLoader variant="text" width="100px" height={14} />
                    </div>
                    <SkeletonLoader variant="rectangle" width={60} height={32} />
                  </div>
                ))}
              </div>
            </div>

            {/* Side column skeleton */}
            <div className={styles.skeletonSideColumn}>
              {/* Quick actions skeleton */}
              <div className={styles.skeletonQuickActionsCard}>
                <SkeletonLoader variant="text" width="120px" height={24} className={styles.skeletonQuickActionsTitle} />
                <div className={styles.skeletonQuickActionsList}>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <SkeletonLoader key={i} variant="rectangle" width="100%" className={styles.skeletonQuickActionBtn} />
                  ))}
                </div>
              </div>

              {/* Upcoming plans skeleton */}
              <div className={styles.skeletonUpcomingCard}>
                <SkeletonLoader variant="text" width="130px" height={24} className={styles.skeletonUpcomingTitle} />
                <div className={styles.skeletonUpcomingList}>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className={styles.skeletonUpcomingItem}>
                      <SkeletonLoader variant="text" width="80%" height={16} />
                      <SkeletonLoader variant="text" width="100px" height={14} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

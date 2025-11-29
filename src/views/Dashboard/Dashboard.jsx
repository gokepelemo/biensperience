import React, { useState, useEffect, useRef } from 'react';
import { Container, Row, Col, Card, Button } from 'react-bootstrap';
import { FaCalendar, FaStar, FaMapMarkerAlt, FaDollarSign } from 'react-icons/fa';
import { getDashboardData } from '../../utilities/dashboard-api';
import { getUser } from '../../utilities/users-service';
import { logger } from '../../utilities/logger';
import { useToast } from '../../contexts/ToastContext';
import { SkeletonLoader, Heading, Text } from '../../components/design-system';
import { eventBus } from '../../utilities/event-bus';
import {
  StatsCard,
  ActivityList,
  QuickActions,
  UpcomingPlans,
  ActivePlansCard,
  MyPlans,
  Preferences,
} from '../../components/Dashboard';
import styles from './Dashboard.module.scss';

export default function Dashboard() {
  const [dashboardData, setDashboardData] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
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

    // Subscribe to event bus instead of window.addEventListener
    const unsubscribePlanUpdated = eventBus.subscribe('plan:updated', handlePlanUpdated);
    const unsubscribeBienPlanUpdated = eventBus.subscribe('bien:plan_updated', handlePlanUpdated);

    return () => {
      unsubscribePlanUpdated();
      unsubscribeBienPlanUpdated();
    };
  }, []);

  const quickActionsRef = useRef(null);
  const upcomingPlansRef = useRef(null);

  useEffect(() => {
    const onHashChange = () => {
      try {
        const hash = (window.location.hash || '').replace('#', '');
        if (!hash) return;
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
  }, []);

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
            Dashboard Unavailable
          </Heading>
          <Text className={styles.errorMessage}>{error || 'We were unable to load your dashboard data.'}</Text>
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

  return (
    <div className={styles.dashboardContainer}>
      <Container fluid>
        <Row>
          <Col
            lg={2}
            className={`${styles.dashboardSidebar} ${styles.dashboardSidebarMobileHidden}`}
          >
            <nav>
              {[
                { key: 'overview', label: 'Overview' },
                { key: 'plans', label: 'My Plans' },
                { key: 'preferences', label: 'Preferences' },
              ].map((item) => {
                const isActive = activeTab === item.key;
                return (
                  <div
                    role="button"
                    tabIndex={0}
                    key={item.key}
                    onClick={() => {
                      setActiveTab(item.key);
                      try { window.history.pushState(null, '', `${window.location.pathname}#${item.key}`); } catch (e) {}
                    }}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        setActiveTab(item.key);
                        try { window.history.pushState(null, '', `${window.location.pathname}#${item.key}`); } catch (e) {}
                      }
                    }}
                    className={`${styles.sidebarNavItem} ${isActive ? styles.sidebarNavItemActive : ''}`}
                  >
                    {item.label}
                  </div>
                );
              })}
            </nav>
          </Col>

          <Col
            lg={10}
            className={`${styles.dashboardMain} ${styles.dashboardMainMobilePadding}`}
          >
            {activeTab === 'overview' && (
              <>
                <div className={styles.welcomeSection}>
                  <Heading level={1} className={styles.welcomeTitle}>
                    Welcome back, {user?.name?.split(' ')[0] || 'Traveler'}! 👋
                  </Heading>
                  <Text className={styles.welcomeSubtitle}>
                    Here's what's happening with your travel plans
                  </Text>
                </div>

                <Row className={styles.statsRow}>
                  <ActivePlansCard stats={dashboardData.stats} loading={loading} />
                  {[
                    { label: 'Experiences', value: experiencesValue, color: 'var(--color-success)', icon: <FaStar /> },
                    { label: 'Destinations', value: destinationsValue, color: 'var(--color-warning)', icon: <FaMapMarkerAlt /> },
                    { label: 'Estimated Cost', value: `$${Number(totalSpentValue).toLocaleString()}`, color: 'var(--color-info)', icon: <FaDollarSign /> },
                  ].map((stat) => (
                    <StatsCard key={stat.label} label={stat.label} value={stat.value} color={stat.color} icon={stat.icon} />
                  ))}
                </Row>

                <Row className={styles.mainContentRow}>
                  <Col lg={8} className={styles.activityColumn}>
                    <ActivityList initialActivities={recentActivity} />
                  </Col>

                  <Col lg={4} className={styles.sideColumn}>
                    <div className={styles.quickActionsWrapper} ref={quickActionsRef}>
                      <QuickActions />
                    </div>

                    <div className={styles.upcomingPlansWrapper} ref={upcomingPlansRef}>
                      <UpcomingPlans plans={upcomingPlans} />
                    </div>
                  </Col>
                </Row>
              </>
            )}

            {/* My Experiences removed from dashboard per request */}

            {activeTab === 'plans' && (
              <div className={styles.tabContentFlex}>
                <MyPlans />
              </div>
            )}

            {/* Favorites tab removed per design — no rendering block */}

            {activeTab === 'preferences' && (
              <div className={styles.tabContentFlex}>
                <Preferences />
              </div>
            )}
          </Col>
        </Row>
      </Container>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className={styles.dashboardContainer}>
      <Container fluid>
        <Row>
          <Col lg={2} className={styles.skeletonSidebar}>
            <SkeletonLoader variant="text" width="120px" className={styles.skeletonSidebarTitle} />
            <div className={styles.skeletonNavItems}>
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonLoader key={i} variant="text" width="100%" height="20px" />
              ))}
            </div>
          </Col>

          <Col lg={10} className={styles.skeletonMain}>
            <Row className={styles.skeletonWelcomeRow}>
              <Col lg={8}>
                <SkeletonLoader variant="text" width="60%" height={36} />
                <SkeletonLoader variant="text" width="40%" height={20} className={styles.skeletonWelcomeTitle} />
              </Col>
            </Row>

            <Row>
              <Col lg={8}>
                <Card className={styles.skeletonCard}>
                  <SkeletonLoader variant="text" width="150px" height={24} className={styles.skeletonCardTitle} />
                  <div className={styles.skeletonStatsGrid}>
                    <SkeletonLoader variant="rectangle" height={80} width="100%" />
                    <SkeletonLoader variant="rectangle" height={80} width="100%" />
                    <SkeletonLoader variant="rectangle" height={80} width="100%" />
                  </div>
                </Card>
              </Col>

              <Col lg={4}>
                <Card className={styles.skeletonCard}>
                  <SkeletonLoader variant="text" width="120px" height={24} className={styles.skeletonCardTitle} />
                  <div className={styles.skeletonNavList}>
                    {Array.from({ length: 3 }).map((_, i) => (
                      <SkeletonLoader key={i} variant="rectangle" height="40px" />
                    ))}
                  </div>
                </Card>

                <Card className={styles.skeletonCard}>
                  <SkeletonLoader variant="text" width="130px" height={24} className={styles.skeletonCardTitle} />
                  <div className={styles.skeletonUpcomingList}>
                    {Array.from({ length: 3 }).map((_, i) => (
                      <SkeletonLoader key={i} variant="rectangle" height="50px" />
                    ))}
                  </div>
                </Card>
              </Col>
            </Row>
          </Col>
        </Row>
      </Container>
    </div>
  );
}

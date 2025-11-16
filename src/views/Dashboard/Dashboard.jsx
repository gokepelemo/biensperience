import React, { useState, useEffect, useRef } from 'react';
import { Container, Row, Col, Card, Button } from 'react-bootstrap';
import { FaCalendar, FaStar, FaMapMarkerAlt, FaDollarSign } from 'react-icons/fa';
import { getDashboardData } from '../../utilities/dashboard-api';
import { getUser } from '../../utilities/users-service';
import { logger } from '../../utilities/logger';
import { useToast } from '../../contexts/ToastContext';
import { SkeletonLoader, Heading, Text } from '../../components/design-system';
import {
  StatsCard,
  ActivityList,
  QuickActions,
  UpcomingPlans,
  ActivePlansCard,
  MyPlans,
  Preferences,
} from '../../components/Dashboard';
import './Dashboard.css';

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

    window.addEventListener('plan:updated', handlePlanUpdated);
    window.addEventListener('bien:plan_updated', handlePlanUpdated);

    return () => {
      window.removeEventListener('plan:updated', handlePlanUpdated);
      window.removeEventListener('bien:plan_updated', handlePlanUpdated);
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
      const message = err?.message || 'Failed to load dashboard data';
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
      <Container style={{ padding: 'var(--space-8) 0' }}>
        <Card
          style={{
            backgroundColor: 'var(--color-bg-primary)',
            border: '1px solid var(--color-border-light)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-6)',
            textAlign: 'center',
          }}
        >
          <div style={{ color: 'var(--color-text-error)', marginBottom: 'var(--space-4)' }}>
            <FaStar size={48} />
          </div>
          <Heading level={2} style={{ marginBottom: 'var(--space-2)' }}>
            Dashboard Unavailable
          </Heading>
          <Text style={{ marginBottom: 'var(--space-4)' }}>{error || 'We were unable to load your dashboard data.'}</Text>
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
    <div
      style={{
        backgroundColor: 'var(--color-bg-primary)',
        minHeight: '100vh',
        padding: 'var(--space-8) 0',
      }}
    >
      <Container fluid>
        <Row>
          <Col
            lg={2}
            className="dashboard-sidebar-mobile-hidden"
            style={{
              backgroundColor: 'var(--color-bg-secondary)',
              minHeight: '100vh',
              padding: 'var(--space-6)',
              borderRight: '1px solid var(--color-border-light)',
            }}
          >
            <Heading
              level={2}
              style={{
                fontSize: 'var(--font-size-xl)',
                fontWeight: 'var(--font-weight-bold)',
                color: 'var(--color-text-primary)',
                marginBottom: 'var(--space-8)',
              }}
            >
              Dashboard
            </Heading>
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
                    style={{
                      padding: 'var(--space-3)',
                      marginBottom: 'var(--space-2)',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: isActive ? 'var(--color-primary)' : 'transparent',
                      color: isActive ? 'white' : 'var(--color-text-primary)',
                      cursor: 'pointer',
                      fontWeight: isActive ? 'var(--font-weight-semibold)' : 'var(--font-weight-medium)',
                    }}
                  >
                    {item.label}
                  </div>
                );
              })}
            </nav>
          </Col>

          <Col
            lg={10}
            className="dashboard-main-mobile-padding"
            style={{
              padding: 'var(--space-8)',
              display: 'flex',
              flexDirection: 'column',
              minHeight: '100vh',
              overflow: 'hidden',
            }}
          >
            {activeTab === 'overview' && (
              <>
                <div style={{ marginBottom: 'var(--space-8)' }}>
                  <Heading
                    level={1}
                    style={{
                      fontSize: 'var(--font-size-3xl)',
                      fontWeight: 'var(--font-weight-bold)',
                      color: 'var(--color-text-primary)',
                      marginBottom: 'var(--space-2)',
                    }}
                  >
                    Welcome back, {user?.name?.split(' ')[0] || 'Traveler'}! 👋
                  </Heading>
                  <Text
                    style={{
                      fontSize: 'var(--font-size-lg)',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    Here's what's happening with your travel plans
                  </Text>
                </div>

                <Row style={{ marginBottom: 'var(--space-8)' }}>
                  <ActivePlansCard stats={dashboardData.stats} loading={loading} />
                  {[
                    { label: 'Experiences', value: experiencesValue, color: 'var(--color-success)', icon: <FaStar /> },
                    { label: 'Destinations', value: destinationsValue, color: 'var(--color-warning)', icon: <FaMapMarkerAlt /> },
                    { label: 'Estimated Cost', value: `$${Number(totalSpentValue).toLocaleString()}`, color: 'var(--color-info)', icon: <FaDollarSign /> },
                  ].map((stat) => (
                    <StatsCard key={stat.label} label={stat.label} value={stat.value} color={stat.color} icon={stat.icon} />
                  ))}
                </Row>

                <Row style={{ flex: 1, overflow: 'hidden' }}>
                  <Col lg={8} style={{ marginBottom: 'var(--space-6)', display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <ActivityList initialActivities={recentActivity} />
                  </Col>

                  <Col lg={4} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <div style={{ marginBottom: 'var(--space-6)' }} ref={quickActionsRef}>
                      <QuickActions />
                    </div>

                    <div style={{ flex: 1, overflow: 'auto' }} ref={upcomingPlansRef}>
                      <UpcomingPlans plans={upcomingPlans} />
                    </div>
                  </Col>
                </Row>
              </>
            )}

            {/* My Experiences removed from dashboard per request */}

            {activeTab === 'plans' && (
              <div style={{ flex: 1, overflow: 'auto' }}>
                <MyPlans />
              </div>
            )}

            {/* Favorites tab removed per design — no rendering block */}

            {activeTab === 'preferences' && (
              <div style={{ flex: 1, overflow: 'auto' }}>
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
    <div
      style={{
        backgroundColor: 'var(--color-bg-primary)',
        minHeight: '100vh',
        padding: 'var(--space-8) 0',
      }}
    >
      <Container fluid>
        <Row>
          <Col lg={2} style={{ backgroundColor: 'var(--color-bg-secondary)', minHeight: '100vh', padding: 'var(--space-6)', borderRight: '1px solid var(--color-border-light)' }}>
            <SkeletonLoader variant="text" width="120px" style={{ marginBottom: 'var(--space-8)' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonLoader key={i} variant="text" width="100%" height="20px" />
              ))}
            </div>
          </Col>

          <Col lg={10} style={{ padding: 'var(--space-8)' }}>
            <Row style={{ marginBottom: 'var(--space-6)' }}>
              <Col lg={8}>
                <SkeletonLoader variant="text" width="60%" height={36} />
                <SkeletonLoader variant="text" width="40%" height={20} style={{ marginTop: 'var(--space-2)' }} />
              </Col>
            </Row>

            <Row>
              <Col lg={8}>
                <Card style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
                  <SkeletonLoader variant="text" width="150px" height={24} style={{ marginBottom: 'var(--space-6)' }} />
                  <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
                    <SkeletonLoader variant="rectangle" height={80} width="100%" />
                    <SkeletonLoader variant="rectangle" height={80} width="100%" />
                    <SkeletonLoader variant="rectangle" height={80} width="100%" />
                  </div>
                </Card>
              </Col>

              <Col lg={4}>
                <Card style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
                  <SkeletonLoader variant="text" width="120px" height={24} style={{ marginBottom: 'var(--space-6)' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    {Array.from({ length: 3 }).map((_, i) => (
                      <SkeletonLoader key={i} variant="rectangle" height="40px" />
                    ))}
                  </div>
                </Card>

                <Card style={{ padding: 'var(--space-6)' }}>
                  <SkeletonLoader variant="text" width="130px" height={24} style={{ marginBottom: 'var(--space-6)' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
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

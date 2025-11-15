import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button } from 'react-bootstrap';
import { FaCalendar, FaStar, FaMapMarkerAlt, FaDollarSign } from 'react-icons/fa';
import { getDashboardData } from '../../utilities/dashboard-api';
import { getUser } from '../../utilities/users-service';
import { logger } from '../../utilities/logger';
import { useToast } from '../../contexts/ToastContext';
import { SkeletonLoader, Heading, Text } from '../../components/design-system';
import { StatsCard, ActivityList, QuickActions, UpcomingPlans, ActivePlansCard } from '../../components/Dashboard';
import './Dashboard.css';

/**
 * Dashboard view component
 * Displays user statistics, recent activity, and upcoming plans
 * Built exactly like the Popular Patterns >> Dashboard Layout story
 */
export default function Dashboard() {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const user = getUser();
  const toast = useToast();

  useEffect(() => {
    fetchDashboardData();
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
        upcomingPlansCount: data.upcomingPlans?.length || 0
      });
    } catch (err) {
      logger.error('[Dashboard] Failed to load dashboard data', err);
      const message = err?.message || 'Failed to load dashboard data';
      // Surface a toast so users get non-blocking feedback
      try {
        toast.error(message, { header: 'Dashboard Error', duration: 8000 });
      } catch (e) {
        // swallow if toast provider not mounted
        logger.debug('[Dashboard] Toast provider not available', e);
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <DashboardSkeleton />;
  }
  // If there was an error and no dashboard data, render a lightweight retry UI
  if (!dashboardData) {
    return (
      <Container style={{ padding: 'var(--space-8) 0' }}>
        <Card style={{
          backgroundColor: 'var(--color-bg-primary)',
          border: '1px solid var(--color-border-light)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-6)',
          textAlign: 'center'
        }}>
          <div style={{ color: 'var(--color-text-error)', marginBottom: 'var(--space-4)' }}>
            <FaStar size={48} />
          </div>
          <Heading level={2} style={{ marginBottom: 'var(--space-2)' }}>
            Dashboard Unavailable
          </Heading>
          <Text style={{ marginBottom: 'var(--space-4)' }}>
            {error || 'We were unable to load your dashboard data.'}
          </Text>
          <Button onClick={fetchDashboardData} variant="primary">
            Try Again
          </Button>
        </Card>
      </Container>
    );
  }

  const { stats = {}, recentActivity = [], upcomingPlans = [] } = dashboardData;

  // Defensive defaults for stat fields to avoid runtime errors when API returns partial data
  const activePlansValue = typeof stats.activePlans === 'number' ? stats.activePlans : 0;
  const experiencesValue = typeof stats.experiences === 'number' ? stats.experiences : 0;
  const destinationsValue = typeof stats.destinations === 'number' ? stats.destinations : 0;
  const totalSpentValue = typeof stats.totalSpent === 'number' ? stats.totalSpent : 0;

  return (
    <div style={{
      backgroundColor: 'var(--color-bg-primary)',
      minHeight: '100vh',
      padding: 'var(--space-8) 0',
    }}>
      <Container fluid>
        <Row>
          {/* Sidebar */}
          <Col lg={2} className="dashboard-sidebar-mobile-hidden" style={{
            backgroundColor: 'var(--color-bg-secondary)',
            minHeight: '100vh',
            padding: 'var(--space-6)',
            borderRight: '1px solid var(--color-border-light)',
          }}>
            <Heading level={2} style={{
              fontSize: 'var(--font-size-xl)',
              fontWeight: 'var(--font-weight-bold)',
              color: 'var(--color-text-primary)',
              marginBottom: 'var(--space-8)',
            }}>
              Dashboard
            </Heading>
            <nav>
              {[
                { label: 'Overview', active: true },
                { label: 'My Experiences' },
                { label: 'My Plans' },
                { label: 'Favorites' },
                { label: 'Settings' },
              ].map(item => (
                <div
                  key={item.label}
                  style={{
                    padding: 'var(--space-3)',
                    marginBottom: 'var(--space-2)',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: item.active ? 'var(--color-primary)' : 'transparent',
                    color: item.active ? 'white' : 'var(--color-text-primary)',
                    cursor: 'pointer',
                    fontWeight: item.active ? 'var(--font-weight-semibold)' : 'var(--font-weight-medium)',
                  }}
                >
                  {item.label}
                </div>
              ))}
            </nav>
          </Col>

          {/* Main Content */}
          <Col lg={10} className="dashboard-main-mobile-padding" style={{ padding: 'var(--space-8)' }}>
            {/* Welcome Header */}
            <div style={{ marginBottom: 'var(--space-8)' }}>
              <Heading level={1} style={{
                fontSize: 'var(--font-size-3xl)',
                fontWeight: 'var(--font-weight-bold)',
                color: 'var(--color-text-primary)',
                marginBottom: 'var(--space-2)',
              }}>
                Welcome back, {user?.name?.split(' ')[0] || 'Traveler'}! 👋
              </Heading>
              <Text style={{
                fontSize: 'var(--font-size-lg)',
                color: 'var(--color-text-secondary)',
              }}>
                Here's what's happening with your travel plans
              </Text>
            </div>

            {/* Stats Cards */}
            <Row style={{ marginBottom: 'var(--space-8)' }}>
              <ActivePlansCard stats={dashboardData.stats} loading={loading} />
              {[
                { label: 'Experiences', value: experiencesValue, color: 'var(--color-success)', icon: <FaStar /> },
                { label: 'Destinations', value: destinationsValue, color: 'var(--color-warning)', icon: <FaMapMarkerAlt /> },
                { label: 'Estimated Cost', value: `$${Number(totalSpentValue).toLocaleString()}`, color: 'var(--color-info)', icon: <FaDollarSign /> },
              ].map(stat => (
                <StatsCard
                  key={stat.label}
                  label={stat.label}
                  value={stat.value}
                  color={stat.color}
                  icon={stat.icon}
                />
              ))}
            </Row>

            <Row>
              {/* Recent Activity */}
              <Col lg={8} style={{ marginBottom: 'var(--space-6)' }}>
                <ActivityList initialActivities={recentActivity} />
              </Col>

              {/* Quick Actions & Upcoming Plans */}
              <Col lg={4}>
              {/* Quick Actions */}
              <div style={{ marginBottom: 'var(--space-6)' }}>
                <QuickActions />
              </div>

                {/* Upcoming Plans */}
                <UpcomingPlans plans={upcomingPlans} />
              </Col>
            </Row>
          </Col>
        </Row>
      </Container>
    </div>
  );
}

/**
 * Dashboard skeleton loading component
 * Shows placeholder content while data is loading
 */
function DashboardSkeleton() {
  return (
    <div style={{
      backgroundColor: 'var(--color-bg-primary)',
      minHeight: '100vh',
      padding: 'var(--space-8) 0',
    }}>
      <Container fluid>
        <Row>
          {/* Sidebar Skeleton */}
          <Col lg={2} style={{
            backgroundColor: 'var(--color-bg-secondary)',
            minHeight: '100vh',
            padding: 'var(--space-6)',
            borderRight: '1px solid var(--color-border-light)',
          }}>
            <SkeletonLoader variant="text" width="120px" style={{ marginBottom: 'var(--space-8)' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonLoader key={i} variant="rectangle" height="40px" />
              ))}
            </div>
          </Col>

          {/* Main Content Skeleton */}
          <Col lg={10} style={{ padding: 'var(--space-8)' }}>
            {/* Header Skeleton */}
            <div style={{ marginBottom: 'var(--space-8)' }}>
              <SkeletonLoader variant="text" width="300px" height="36px" style={{ marginBottom: 'var(--space-2)' }} />
              <SkeletonLoader variant="text" width="250px" height="24px" />
            </div>

            {/* Stats Cards Skeleton */}
            <Row style={{ marginBottom: 'var(--space-8)' }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <Col md={6} lg={3} key={i} style={{ marginBottom: 'var(--space-4)' }}>
                  <Card style={{
                    backgroundColor: 'var(--color-bg-primary)',
                    border: '1px solid var(--color-border-light)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 'var(--space-6)',
                    height: '120px',
                  }}>
                    <SkeletonLoader variant="rectangle" height="100%" />
                  </Card>
                </Col>
              ))}
            </Row>

            <Row>
              {/* Recent Activity Skeleton */}
              <Col lg={8} style={{ marginBottom: 'var(--space-6)' }}>
                <Card style={{
                  backgroundColor: 'var(--color-bg-primary)',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 'var(--space-6)',
                }}>
                  <SkeletonLoader variant="text" width="150px" height="24px" style={{ marginBottom: 'var(--space-6)' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    {Array.from({ length: 4 }).map((_, i) => (
                      <SkeletonLoader key={i} variant="rectangle" height="60px" />
                    ))}
                  </div>
                </Card>
              </Col>

              {/* Sidebar Skeletons */}
              <Col lg={4}>
                <Card style={{
                  backgroundColor: 'var(--color-bg-primary)',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 'var(--space-6)',
                  marginBottom: 'var(--space-6)',
                }}>
                  <SkeletonLoader variant="text" width="120px" height="24px" style={{ marginBottom: 'var(--space-6)' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    {Array.from({ length: 3 }).map((_, i) => (
                      <SkeletonLoader key={i} variant="rectangle" height="40px" />
                    ))}
                  </div>
                </Card>

                <Card style={{
                  backgroundColor: 'var(--color-bg-primary)',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 'var(--space-6)',
                }}>
                  <SkeletonLoader variant="text" width="130px" height="24px" style={{ marginBottom: 'var(--space-6)' }} />
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
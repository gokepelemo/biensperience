/**
 * Skeleton loader for SingleDestination view
 * Displays a layout-preserving loading state while destination data is fetched
 * Matches the actual SingleDestination layout pixel-perfectly
 */

import SkeletonLoader from '../../../components/SkeletonLoader/SkeletonLoader';
import { Breadcrumb, Container, Row, Col, Card } from '../../../components/design-system';
import { Box, Flex } from '@chakra-ui/react';
import styles from '../SingleDestination.module.css';

export default function SingleDestinationSkeleton() {
  return (
    <Box minH="100vh" pt="4" pb="8" bg="bg">
      <Container>
        {/* Breadcrumb Skeleton */}
        <Breadcrumb loading />

        {/* Hero Image Section — uses Chakra Box to match loaded state exactly */}
        <Box
          borderRadius="xl"
          overflow="hidden"
          mb={{ base: "4", md: "6" }}
          h={{ base: "300px", md: "450px" }}
          bg="bg.muted"
          position="relative"
        >
          <SkeletonLoader variant="rectangle" width="100%" height="100%" style={{ borderRadius: 0 }} />
          {/* Photo button skeleton */}
          <Flex
            position="absolute"
            right={{ base: "8px", md: "12px" }}
            bottom={{ base: "8px", md: "12px" }}
            minW="44px"
            h="44px"
            px={{ base: "2", md: "3" }}
            bg="rgba(255,255,255,0.06)"
            border="2px solid rgba(255,255,255,0.9)"
            borderRadius="8px"
            align="center"
            justify="center"
            gap="2"
          >
            <SkeletonLoader variant="rectangle" width="18px" height="18px" style={{ borderRadius: '2px', opacity: 0.3 }} />
          </Flex>
        </Box>

        {/* Stats bar skeleton — matches MetricsBar compact layout exactly
         * Uses the same .statsBar class + internal structure mirroring .metricsBar.compact */}
        <div className={styles.statsBar}>
          <div className={styles.skeletonMetricsRow}>
            {[1, 2, 3].map((i) => (
              <div key={i} className={styles.skeletonMetricItem}>
                <SkeletonLoader variant="text" width="70px" height="13px" style={{ marginBottom: '0.25rem' }} />
                <SkeletonLoader variant="text" width="30px" height="20px" />
              </div>
            ))}
          </div>
        </div>

        <Row>
          {/* Main content column */}
          <Col lg={8}>
            {/* Map card skeleton - matches GoogleMap height={350}, always present */}
            <Card className={styles.contentCard}>
              <Card.Body className={styles.contentCardBody}>
                <SkeletonLoader variant="text" width="100px" height="28px" style={{ marginBottom: 'var(--space-4)' }} />
                <SkeletonLoader variant="rectangle" width="100%" height="350px" style={{ borderRadius: 'var(--radius-lg)' }} />
              </Card.Body>
            </Card>

            {/* Experiences card skeleton - always present */}
            <Card className={styles.contentCard}>
              <Card.Body className={styles.contentCardBody}>
                <SkeletonLoader variant="text" width="220px" height="28px" style={{ marginBottom: 'var(--space-4)' }} />
                <Row>
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <Col md={6} key={i} style={{ marginBottom: 'var(--space-4)', display: 'flex', justifyContent: 'center' }}>
                      <SkeletonLoader variant="rectangle" width="100%" height="280px" />
                    </Col>
                  ))}
                </Row>
              </Card.Body>
            </Card>
          </Col>

          {/* Sidebar column */}
          <Col lg={4}>
            <div className={styles.sidebar}>
              <SkeletonLoader variant="text" width="120px" height="22px" style={{ marginBottom: 'var(--space-4)' }} />
              <div className={styles.sidebarActions}>
                <SkeletonLoader variant="rectangle" width="100%" height="44px" style={{ borderRadius: 'var(--radius-full)' }} />
                <SkeletonLoader variant="rectangle" width="100%" height="44px" style={{ borderRadius: 'var(--radius-full)' }} />
              </div>
            </div>
          </Col>
        </Row>
      </Container>
    </Box>
  );
}

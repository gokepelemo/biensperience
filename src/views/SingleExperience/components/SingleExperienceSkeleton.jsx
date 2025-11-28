/**
 * Skeleton loader for SingleExperience view
 * Displays a layout-preserving loading state while experience data is fetched
 */

import React from 'react';
import { Container, Row, Col, Card } from 'react-bootstrap';
import SkeletonLoader from '../../../components/SkeletonLoader/SkeletonLoader';
import styles from '../SingleExperience.module.scss';

export default function SingleExperienceSkeleton() {
  return (
    <div className={styles.experienceDetailContainer}>
      <Container>
        <Row>
          {/* Main Content Column (8 cols on lg+) */}
          <Col lg={8}>
            {/* Hero Image Skeleton */}
            <div className={styles.heroSection}>
              <SkeletonLoader
                variant="rectangle"
                width="100%"
                height="400px"
                style={{ borderRadius: 'var(--radius-lg)' }}
              />
            </div>

            {/* Tags Skeleton */}
            <div className={styles.tagsSection} style={{ marginTop: 'var(--space-4)' }}>
              <SkeletonLoader variant="rectangle" width="80px" height="24px" style={{ borderRadius: 'var(--radius-full)', marginRight: 'var(--space-2)' }} />
              <SkeletonLoader variant="rectangle" width="100px" height="24px" style={{ borderRadius: 'var(--radius-full)', marginRight: 'var(--space-2)' }} />
              <SkeletonLoader variant="rectangle" width="70px" height="24px" style={{ borderRadius: 'var(--radius-full)' }} />
            </div>

            {/* Title Section Skeleton */}
            <div className={styles.titleSection} style={{ marginTop: 'var(--space-4)' }}>
              <SkeletonLoader variant="text" size="lg" width="70%" height="40px" />
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                <SkeletonLoader variant="circle" width="20px" height="20px" />
                <SkeletonLoader variant="text" width="200px" height="20px" />
              </div>
            </div>

            {/* Overview Card Skeleton */}
            <Card className={styles.contentCard} style={{ marginTop: 'var(--space-6)' }}>
              <Card.Body className={styles.cardBody}>
                <SkeletonLoader variant="text" width="120px" height="24px" style={{ marginBottom: 'var(--space-3)' }} />
                <SkeletonLoader variant="text" lines={4} />
              </Card.Body>
            </Card>

            {/* Plan Items Card Skeleton */}
            <Card className={styles.contentCard} style={{ marginTop: 'var(--space-4)' }}>
              <Card.Body className={styles.cardBody}>
                {/* Tabs Skeleton */}
                <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', borderBottom: '1px solid var(--color-border-light)', paddingBottom: 'var(--space-3)' }}>
                  <SkeletonLoader variant="rectangle" width="100px" height="36px" style={{ borderRadius: 'var(--radius-md)' }} />
                  <SkeletonLoader variant="rectangle" width="80px" height="36px" style={{ borderRadius: 'var(--radius-md)' }} />
                </div>

                {/* Plan Items Skeleton */}
                {[1, 2, 3].map((i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3)', borderBottom: '1px solid var(--color-border-light)' }}>
                    <SkeletonLoader variant="circle" width="20px" height="20px" />
                    <div style={{ flex: 1 }}>
                      <SkeletonLoader variant="text" width="60%" height="18px" />
                      <SkeletonLoader variant="text" width="40%" height="14px" style={{ marginTop: 'var(--space-1)' }} />
                    </div>
                    <SkeletonLoader variant="rectangle" width="60px" height="24px" style={{ borderRadius: 'var(--radius-sm)' }} />
                  </div>
                ))}
              </Card.Body>
            </Card>
          </Col>

          {/* Sidebar Column (4 cols on lg+) */}
          <Col lg={4}>
            <div className={styles.stickyContainer}>
              {/* Action Buttons Skeleton */}
              <Card className={styles.actionCard}>
                <Card.Body style={{ padding: 'var(--space-4)' }}>
                  <SkeletonLoader variant="rectangle" width="100%" height="44px" style={{ borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-3)' }} />
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <SkeletonLoader variant="rectangle" width="100%" height="36px" style={{ borderRadius: 'var(--radius-md)' }} />
                    <SkeletonLoader variant="rectangle" width="36px" height="36px" style={{ borderRadius: 'var(--radius-md)' }} />
                  </div>
                </Card.Body>
              </Card>

              {/* Details Card Skeleton */}
              <Card className={styles.detailsCard} style={{ marginTop: 'var(--space-4)' }}>
                <Card.Body style={{ padding: 'var(--space-4)' }}>
                  <SkeletonLoader variant="text" width="100px" height="20px" style={{ marginBottom: 'var(--space-4)' }} />

                  {/* Detail Items */}
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                      <SkeletonLoader variant="circle" width="32px" height="32px" />
                      <div style={{ flex: 1 }}>
                        <SkeletonLoader variant="text" width="60px" height="12px" style={{ marginBottom: 'var(--space-1)' }} />
                        <SkeletonLoader variant="text" width="100px" height="16px" />
                      </div>
                    </div>
                  ))}
                </Card.Body>
              </Card>

              {/* Metrics Bar Skeleton */}
              <Card style={{ marginTop: 'var(--space-4)', border: '1px solid var(--color-border-light)', borderRadius: 'var(--radius-lg)' }}>
                <Card.Body style={{ padding: 'var(--space-3)' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} style={{ flex: '1 1 50%', minWidth: '140px', padding: 'var(--space-2)' }}>
                        <SkeletonLoader variant="text" width="50px" height="10px" style={{ marginBottom: 'var(--space-1)' }} />
                        <SkeletonLoader variant="text" width="80px" height="20px" />
                      </div>
                    ))}
                  </div>
                </Card.Body>
              </Card>
            </div>
          </Col>
        </Row>
      </Container>
    </div>
  );
}

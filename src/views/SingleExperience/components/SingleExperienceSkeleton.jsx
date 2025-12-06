/**
 * Skeleton loader for SingleExperience view
 * Displays a layout-preserving loading state while experience data is fetched
 * Matches the actual SingleExperience layout pixel-perfectly
 */

import { Container, Row, Col } from 'react-bootstrap';
import SkeletonLoader from '../../../components/SkeletonLoader/SkeletonLoader';
import styles from '../SingleExperience.module.scss';

export default function SingleExperienceSkeleton() {
  return (
    <div className={styles.experienceDetailContainer}>
      <Container>
        {/* Breadcrumb Skeleton */}
        <nav className={styles.breadcrumbNav} aria-label="breadcrumb">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <SkeletonLoader variant="text" width="50px" height="16px" />
            <span style={{ color: 'var(--color-text-muted)' }}>/</span>
            <SkeletonLoader variant="text" width="80px" height="16px" />
            <span style={{ color: 'var(--color-text-muted)' }}>/</span>
            <SkeletonLoader variant="text" width="120px" height="16px" />
          </div>
        </nav>

        <Row>
          {/* Main Content Column (8 cols on lg+) */}
          <Col lg={8}>
            {/* Hero Image Skeleton */}
            <div className={styles.heroSection}>
              <SkeletonLoader
                variant="rectangle"
                width="100%"
                height="100%"
                style={{ position: 'absolute', top: 0, left: 0, borderRadius: 'var(--radius-xl)' }}
              />
              {/* Photo button skeleton */}
              <div
                style={{
                  position: 'absolute',
                  right: '12px',
                  bottom: '12px',
                  width: '60px',
                  height: '44px',
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '8px'
                }}
              />
            </div>

            {/* Tags Skeleton */}
            <div className={styles.tagsSection}>
              <SkeletonLoader variant="rectangle" width="120px" height="28px" style={{ borderRadius: 'var(--radius-full)' }} />
              <SkeletonLoader variant="rectangle" width="90px" height="28px" style={{ borderRadius: 'var(--radius-full)' }} />
              <SkeletonLoader variant="rectangle" width="100px" height="28px" style={{ borderRadius: 'var(--radius-full)' }} />
            </div>

            {/* Title Section Skeleton */}
            <div className={styles.titleSection}>
              <SkeletonLoader variant="text" width="65%" height="42px" />
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
                <SkeletonLoader variant="circle" width="18px" height="18px" />
                <SkeletonLoader variant="text" width="180px" height="20px" />
              </div>
            </div>

            {/* Stats Bar Skeleton */}
            <div className={styles.statsBar}>
              {[1, 2, 3].map((i) => (
                <div key={i} className={styles.statItem}>
                  <SkeletonLoader variant="circle" width="24px" height="24px" />
                  <SkeletonLoader variant="text" width="30px" height="22px" />
                  <SkeletonLoader variant="text" width="60px" height="16px" />
                </div>
              ))}
            </div>

            {/* Overview Card Skeleton */}
            <div className={styles.contentCard}>
              <div className={styles.cardBody}>
                <SkeletonLoader variant="text" width="100px" height="26px" style={{ marginBottom: 'var(--space-4)' }} />
                <SkeletonLoader variant="text" width="100%" height="18px" style={{ marginBottom: 'var(--space-2)' }} />
                <SkeletonLoader variant="text" width="95%" height="18px" style={{ marginBottom: 'var(--space-2)' }} />
                <SkeletonLoader variant="text" width="88%" height="18px" style={{ marginBottom: 'var(--space-2)' }} />
                <SkeletonLoader variant="text" width="70%" height="18px" />
              </div>
            </div>

            {/* Plan Items Card Skeleton */}
            <div className={styles.contentCard}>
              <div className={styles.cardBody}>
                {/* Tabs Skeleton */}
                <div style={{
                  display: 'flex',
                  gap: 'var(--space-3)',
                  marginBottom: 'var(--space-4)',
                  borderBottom: '1px solid var(--color-border-light)',
                  paddingBottom: 'var(--space-3)'
                }}>
                  <SkeletonLoader variant="rectangle" width="110px" height="36px" style={{ borderRadius: 'var(--radius-md)' }} />
                  <SkeletonLoader variant="rectangle" width="85px" height="36px" style={{ borderRadius: 'var(--radius-md)' }} />
                </div>

                {/* Plan Items Skeleton */}
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-3)',
                      padding: 'var(--space-3) 0',
                      borderBottom: i < 5 ? '1px solid var(--color-border-light)' : 'none'
                    }}
                  >
                    <SkeletonLoader variant="circle" width="24px" height="24px" />
                    <div style={{ flex: 1 }}>
                      <SkeletonLoader variant="text" width={`${55 + (i * 5)}%`} height="18px" />
                    </div>
                    <SkeletonLoader variant="rectangle" width="32px" height="32px" style={{ borderRadius: 'var(--radius-sm)' }} />
                  </div>
                ))}
              </div>
            </div>
          </Col>

          {/* Sidebar Column (4 cols on lg+) */}
          <Col lg={4}>
            <div className={styles.sidebar}>
              <div className={styles.sidebarCard}>
                {/* Sidebar Title Skeleton */}
                <SkeletonLoader variant="text" width="150px" height="26px" style={{ marginBottom: 'var(--space-5)' }} />

                {/* Date Picker Section Skeleton */}
                <div style={{ marginBottom: 'var(--space-5)' }}>
                  <SkeletonLoader variant="text" width="90px" height="14px" style={{ marginBottom: 'var(--space-2)' }} />
                  <SkeletonLoader variant="rectangle" width="100%" height="44px" style={{ borderRadius: 'var(--radius-md)' }} />
                </div>

                {/* Details List Skeleton */}
                <div className={styles.detailsList}>
                  {/* Rating */}
                  <div className={styles.detailItem}>
                    <SkeletonLoader variant="text" width="50px" height="14px" style={{ marginBottom: 'var(--space-1)' }} />
                    <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                      {[1, 2, 3, 4, 5].map((j) => (
                        <SkeletonLoader key={j} variant="circle" width="18px" height="18px" />
                      ))}
                      <SkeletonLoader variant="text" width="30px" height="18px" style={{ marginLeft: 'var(--space-2)' }} />
                    </div>
                  </div>

                  {/* Difficulty */}
                  <div className={styles.detailItem}>
                    <SkeletonLoader variant="text" width="65px" height="14px" style={{ marginBottom: 'var(--space-1)' }} />
                    <div style={{ display: 'flex', gap: 'var(--space-1)', alignItems: 'center' }}>
                      {[1, 2, 3, 4, 5].map((j) => (
                        <SkeletonLoader key={j} variant="circle" width="12px" height="12px" />
                      ))}
                      <SkeletonLoader variant="text" width="60px" height="16px" style={{ marginLeft: 'var(--space-2)' }} />
                    </div>
                  </div>

                  {/* Estimated Cost */}
                  <div className={styles.detailItem}>
                    <SkeletonLoader variant="text" width="95px" height="14px" style={{ marginBottom: 'var(--space-1)' }} />
                    <SkeletonLoader variant="text" width="80px" height="22px" />
                  </div>

                  {/* Planning Time */}
                  <div className={styles.detailItem}>
                    <SkeletonLoader variant="text" width="90px" height="14px" style={{ marginBottom: 'var(--space-1)' }} />
                    <SkeletonLoader variant="text" width="70px" height="22px" />
                  </div>
                </div>

                {/* Action Buttons Skeleton */}
                <div className={styles.sidebarActions}>
                  <SkeletonLoader
                    variant="rectangle"
                    width="100%"
                    height="48px"
                    style={{ borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-3)' }}
                  />
                  <SkeletonLoader
                    variant="rectangle"
                    width="100%"
                    height="44px"
                    style={{ borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-2)' }}
                  />
                  <SkeletonLoader
                    variant="rectangle"
                    width="100%"
                    height="44px"
                    style={{ borderRadius: 'var(--radius-lg)' }}
                  />
                </div>
              </div>
            </div>
          </Col>
        </Row>
      </Container>
    </div>
  );
}

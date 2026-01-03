/**
 * ProfileSkeleton Component
 *
 * Full-page skeleton loader for the Profile view.
 * Displays accurate placeholders for header, tabs, and content grid
 * to prevent layout shifts during initial load.
 */

import { Container, Row, Col } from 'react-bootstrap';
import ProfileHeaderSkeleton from './ProfileHeaderSkeleton';
import { ProfileContentGridSkeleton, ProfileTabsSkeleton } from './ProfileContentGrid';
import styles from '../Profile.module.scss';

export default function ProfileSkeleton({ isOwner = false }) {
  return (
    <div style={{ backgroundColor: 'var(--color-bg-primary)', minHeight: '100vh', padding: 'var(--space-8) 0' }}>
      <Container>
        {/* Profile Header Card Skeleton */}
        <ProfileHeaderSkeleton isOwner={isOwner} />

        {/* Tab Navigation Skeleton */}
        <ProfileTabsSkeleton />

        {/* Content Grid Skeleton */}
        <Row>
          <Col lg={12}>
            <div className={styles.profileGrid}>
              <ProfileContentGridSkeleton type="experiences" count={6} />
            </div>
          </Col>
        </Row>
      </Container>
    </div>
  );
}

/**
 * ProfileView Stories
 *
 * Storybook stories for the Profile view, including loading states,
 * different user types, and responsive layouts.
 */

import React from 'react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { Container, Card, Row, Col } from 'react-bootstrap';
import { FaUser, FaCheckCircle, FaMapMarkerAlt, FaCamera, FaStar } from 'react-icons/fa';
import { ProfileSkeleton, ProfileHeaderSkeleton, ProfileContentGridSkeleton } from '../../views/Profile/components';
import ExperienceCard from '../../components/ExperienceCard/ExperienceCard';
import DestinationCard from '../../components/DestinationCard/DestinationCard';
import { EmptyState } from '../../components/design-system';
import styles from '../../views/Profile/Profile.module.scss';

export default {
  title: 'Views/ProfileView',
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'app-background',
      values: [
        { name: 'app-background', value: 'var(--color-bg-primary)' },
      ],
    },
  },
};

// Mock data
const mockProfile = {
  _id: '507f1f77bcf86cd799439011',
  name: 'Sarah Chen',
  email: 'sarah@example.com',
  emailConfirmed: true,
  location: {
    city: 'San Francisco',
    country: 'USA'
  },
  bio: 'Travel enthusiast and adventure seeker. I love exploring new cultures and sharing my experiences with the community.',
  photos: [
    { _id: 'photo1', url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop' }
  ]
};

const mockCurator = {
  ...mockProfile,
  _id: '507f1f77bcf86cd799439012',
  name: 'Marco Rossi',
  bio: 'Professional travel curator with 10+ years of experience. Specializing in Italian destinations and cultural experiences.',
  feature_flags: [
    { flag: 'curator', enabled: true }
  ],
  links: [
    { type: 'instagram', value: 'marco_travels' },
    { type: 'twitter', value: 'marcorossi' },
    { type: 'website', url: 'https://marcorossi.travel', title: 'My Travel Blog' }
  ]
};

const mockExperiences = [
  {
    _id: 'exp1',
    name: 'Sunset at Golden Gate',
    description: 'Experience the breathtaking sunset views from the Golden Gate Bridge.',
    destination: { _id: 'dest1', name: 'San Francisco', country: 'USA' },
    photos: [{ url: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=400&h=300&fit=crop' }],
    experience_type: ['Scenic', 'Photography'],
    cost_estimate: 50,
    max_planning_days: 1
  },
  {
    _id: 'exp2',
    name: 'Tokyo Street Food Tour',
    description: 'Discover the best street food spots in Tokyo.',
    destination: { _id: 'dest2', name: 'Tokyo', country: 'Japan' },
    photos: [{ url: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=400&h=300&fit=crop' }],
    experience_type: ['Food', 'Culture'],
    cost_estimate: 100,
    max_planning_days: 3
  },
  {
    _id: 'exp3',
    name: 'Hiking the Swiss Alps',
    description: 'A multi-day hiking adventure through the stunning Swiss Alps.',
    destination: { _id: 'dest3', name: 'Zermatt', country: 'Switzerland' },
    photos: [{ url: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=400&h=300&fit=crop' }],
    experience_type: ['Adventure', 'Nature'],
    cost_estimate: 500,
    max_planning_days: 7
  }
];

const mockDestinations = [
  { _id: 'dest1', name: 'San Francisco', country: 'USA', users_favorite: ['507f1f77bcf86cd799439011'] },
  { _id: 'dest2', name: 'Tokyo', country: 'Japan', users_favorite: ['507f1f77bcf86cd799439011'] },
  { _id: 'dest3', name: 'Paris', country: 'France', users_favorite: ['507f1f77bcf86cd799439011'] }
];

// Profile Header Content Component (for stories)
function ProfileHeaderContent({ profile, isOwner = false, isCurator = false }) {
  const hasCuratorFlag = isCurator || profile?.feature_flags?.some(f => f.flag === 'curator' && f.enabled);

  return (
    <div className={styles.profileHeaderFlex}>
      {/* Avatar */}
      <div className={styles.profileAvatarContainer} style={{ cursor: 'default' }}>
        {profile?.photos?.length > 0 ? (
          <img
            src={profile.photos[0].url || profile.photos[0]}
            alt={profile?.name}
            className={styles.profileAvatar}
          />
        ) : (
          <div className={styles.profileAvatarPlaceholder}>
            <FaUser />
          </div>
        )}
        {profile?.photos?.length > 0 && (
          <div className={styles.profileAvatarOverlay}>
            <FaCamera />
          </div>
        )}
      </div>

      {/* Info */}
      <div className={styles.profileInfo}>
        <div className={styles.profileNameRow}>
          <h1 className={styles.profileName}>{profile?.name}</h1>
          {profile?.emailConfirmed && (
            <FaCheckCircle className={styles.verifiedBadge} title="Email Confirmed" />
          )}
        </div>

        {profile?.location && (
          <p className={styles.profileLocation}>
            <FaMapMarkerAlt /> {profile.location.city}, {profile.location.country}
          </p>
        )}

        {profile?.bio && (
          <p className={styles.profileBio}>{profile.bio}</p>
        )}

        {/* Curator Badge */}
        {hasCuratorFlag && (
          <div className={styles.curatorBadge}>
            <FaStar /> Curator
          </div>
        )}

        {/* Metrics Bar */}
        <div className={styles.profileMetricsBar}>
          <span className={styles.profileMetric}>
            <strong>5</strong> Plans
          </span>
          <span className={styles.profileMetricDivider}>·</span>
          <span className={styles.profileMetric}>
            <strong>12</strong> Experiences
          </span>
          <span className={styles.profileMetricDivider}>·</span>
          <span className={styles.profileMetric}>
            <strong>8</strong> Destinations
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className={styles.profileActions}>
        <button
          className="btn btn-outline-secondary"
          style={{ borderRadius: 'var(--radius-full)' }}
        >
          ⋯
        </button>
      </div>
    </div>
  );
}

// Full Profile Presentation Component
function ProfilePresentation({ profile, experiences = [], destinations = [], activeTab = 'experiences', isCurator = false }) {
  return (
    <MemoryRouter>
      <div style={{ backgroundColor: 'var(--color-bg-primary)', minHeight: '100vh', padding: 'var(--space-8) 0' }}>
        <Container>
          {/* Profile Header Card */}
          <Card className={styles.profileHeaderCard}>
            <div className={styles.profileCover} />
            <Card.Body className={styles.profileHeaderBody}>
              <ProfileHeaderContent profile={profile} isCurator={isCurator} />
            </Card.Body>
          </Card>

          {/* Tab Navigation */}
          <div className={styles.profileTabs}>
            <button className={`${styles.profileTab} ${activeTab === 'experiences' ? styles.profileTabActive : ''}`}>
              Planned
            </button>
            <button className={`${styles.profileTab} ${activeTab === 'created' ? styles.profileTabActive : ''}`}>
              Created
            </button>
            <button className={`${styles.profileTab} ${activeTab === 'destinations' ? styles.profileTabActive : ''}`}>
              Destinations
            </button>
          </div>

          {/* Content Grid */}
          <Row>
            <Col lg={12}>
              {activeTab === 'experiences' && (
                <div className={styles.profileGrid}>
                  {experiences.length > 0 ? (
                    experiences.map((exp, index) => (
                      <ExperienceCard key={exp._id || index} experience={exp} />
                    ))
                  ) : (
                    <EmptyState
                      variant="experiences"
                      title="No Planned Experiences"
                      description="Start planning your next adventure by browsing experiences."
                      size="md"
                    />
                  )}
                </div>
              )}
              {activeTab === 'destinations' && (
                <div className={styles.destinationsGrid}>
                  {destinations.length > 0 ? (
                    destinations.map((dest, index) => (
                      <DestinationCard key={dest._id || index} destination={dest} />
                    ))
                  ) : (
                    <EmptyState
                      variant="destinations"
                      title="No Favorite Destinations"
                      description="Explore destinations and add them to your favorites."
                      size="md"
                    />
                  )}
                </div>
              )}
            </Col>
          </Row>
        </Container>
      </div>
    </MemoryRouter>
  );
}

// Stories

/**
 * Default profile view with experiences
 */
export const Default = () => (
  <ProfilePresentation
    profile={mockProfile}
    experiences={mockExperiences}
    destinations={mockDestinations}
    activeTab="experiences"
  />
);

/**
 * Loading state with full-page skeleton
 */
export const Loading = () => (
  <BrowserRouter>
    <ProfileSkeleton />
  </BrowserRouter>
);

/**
 * Just the header skeleton
 */
export const HeaderSkeletonOnly = () => (
  <BrowserRouter>
    <div style={{ backgroundColor: 'var(--color-bg-primary)', minHeight: '100vh', padding: 'var(--space-8) 0' }}>
      <Container>
        <ProfileHeaderSkeleton />
      </Container>
    </div>
  </BrowserRouter>
);

/**
 * Content grid skeleton
 */
export const ContentSkeletonOnly = () => (
  <BrowserRouter>
    <div style={{ backgroundColor: 'var(--color-bg-primary)', minHeight: '100vh', padding: 'var(--space-8) 0' }}>
      <Container>
        <div className={styles.profileGrid}>
          <ProfileContentGridSkeleton type="experiences" count={6} />
        </div>
      </Container>
    </div>
  </BrowserRouter>
);

/**
 * Destinations tab with smaller cards
 */
export const DestinationsTab = () => (
  <ProfilePresentation
    profile={mockProfile}
    experiences={mockExperiences}
    destinations={mockDestinations}
    activeTab="destinations"
  />
);

/**
 * Curator profile with badge and links
 */
export const CuratorProfile = () => (
  <ProfilePresentation
    profile={mockCurator}
    experiences={mockExperiences}
    destinations={mockDestinations}
    activeTab="experiences"
    isCurator={true}
  />
);

/**
 * Empty state - no experiences
 */
export const EmptyExperiences = () => (
  <ProfilePresentation
    profile={mockProfile}
    experiences={[]}
    destinations={mockDestinations}
    activeTab="experiences"
  />
);

/**
 * Empty state - no destinations
 */
export const EmptyDestinations = () => (
  <ProfilePresentation
    profile={mockProfile}
    experiences={mockExperiences}
    destinations={[]}
    activeTab="destinations"
  />
);

/**
 * Profile without avatar
 */
export const NoAvatar = () => (
  <ProfilePresentation
    profile={{ ...mockProfile, photos: [] }}
    experiences={mockExperiences}
    destinations={mockDestinations}
    activeTab="experiences"
  />
);

/**
 * Mobile viewport
 */
export const Mobile = () => (
  <ProfilePresentation
    profile={mockProfile}
    experiences={mockExperiences.slice(0, 2)}
    destinations={mockDestinations}
    activeTab="experiences"
  />
);

Mobile.parameters = {
  viewport: {
    defaultViewport: 'mobile1',
  },
};

/**
 * Tablet viewport
 */
export const Tablet = () => (
  <ProfilePresentation
    profile={mockProfile}
    experiences={mockExperiences}
    destinations={mockDestinations}
    activeTab="experiences"
  />
);

Tablet.parameters = {
  viewport: {
    defaultViewport: 'tablet',
  },
};

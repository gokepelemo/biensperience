/**
 * DestinationDetailView Stories
 *
 * Comprehensive Storybook stories for the Destination Detail View.
 * Due to the complex context dependencies of SingleDestination,
 * these stories use a presentational wrapper that renders the key
 * layout sections with mock data.
 */

import React, { useState } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Container, Row, Col, Card, Breadcrumb } from 'react-bootstrap';
import { FaMapMarkerAlt, FaHeart, FaPlane, FaShare, FaEdit, FaTrash, FaRegImage, FaLightbulb, FaCamera, FaHome } from 'react-icons/fa';
import ExperienceCard from '../../components/ExperienceCard/ExperienceCard';
import TravelTipsList from '../../components/TravelTipsList/TravelTipsList';
import { Button, SkeletonLoader, EntityNotFound, EmptyState } from '../../components/design-system';
import DestinationExperienceGrid from '../../views/SingleDestination/components/DestinationExperienceGrid';
import styles from '../../views/SingleDestination/SingleDestination.module.scss';

export default {
  title: 'Views/DestinationDetailView',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
The Destination Detail View displays comprehensive information about a travel destination:

- Hero section with title, location, and description
- Photo gallery with modal navigation
- Country info and popular experiences
- Travel tips with Schema.org markup
- Grid of experiences with infinite scroll
- Action buttons (favorite, edit, delete)

**Features:**
- Dark mode support
- Responsive design (mobile-first)
- WCAG 2.1 Level AA compliant
- Event-driven updates
        `,
      },
    },
    chromatic: { viewports: [320, 768, 1280] },
  },
  argTypes: {
    destination: { control: 'object' },
    experiences: { control: 'object' },
    isOwner: { control: 'boolean' },
    isFavorite: { control: 'boolean' },
    isLoading: { control: 'boolean' },
  },
};

// ============================================================
// Mock Data
// ============================================================

const mockDestination = {
  _id: 'dest-001',
  name: 'Tokyo',
  country: 'Japan',
  state: 'Kanto',
  overview: 'A vibrant metropolis where ancient temples stand alongside neon-lit skyscrapers. Experience the perfect blend of traditional culture and cutting-edge technology.',
  photos: [
    {
      _id: 'photo-1',
      url: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1200',
      photo_credit: 'Jezael Melgoza',
      photo_credit_url: 'https://unsplash.com/@jezar'
    },
    {
      _id: 'photo-2',
      url: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=1200',
      photo_credit: 'Arto Marttinen',
    }
  ],
  default_photo_id: 'photo-1',
  travel_tips: [
    { type: 'language', value: 'Japanese', notes: 'English widely understood in tourist areas' },
    { type: 'currency', value: 'JPY', exchange_rate: '150 = $1 USD' },
    { type: 'transportation', value: 'JR Pass', notes: 'Best value for rail travel' },
    { type: 'safety', value: 'Very Safe', notes: 'Low crime rate, safe at night' },
    { type: 'custom', value: 'Cash is King', notes: 'Many places don\'t accept cards' }
  ],
  users_favorite: ['user-002', 'user-003'],
  user: 'user-001',
  createdAt: '2024-01-15T00:00:00Z'
};

const mockExperiences = Array.from({ length: 12 }, (_, i) => ({
  _id: `exp-${String(i + 1).padStart(3, '0')}`,
  name: [
    'Shibuya Crossing', 'Senso-ji Temple', 'Meiji Shrine',
    'Tokyo Tower', 'Tsukiji Market', 'Akihabara Electronics',
    'Harajuku Fashion', 'Imperial Palace', 'Shinjuku Nightlife',
    'Ueno Park', 'Ginza Shopping', 'Odaiba Island'
  ][i],
  destination: mockDestination,
  photos: [{ url: `https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=400&sig=${i}` }],
  description: 'An amazing experience in Tokyo...',
  user: { _id: 'user-001', name: 'Demo User' }
}));

const mockUser = {
  _id: 'user-001',
  name: 'John Doe',
  email: 'john@example.com',
  role: 'user'
};

const mockVisitorUser = {
  _id: 'user-002',
  name: 'Jane Smith',
  email: 'jane@example.com',
  role: 'user'
};

// ============================================================
// Presentational Wrapper Component
// ============================================================

/**
 * DestinationDetailPresentation
 * A presentational component that renders the destination detail layout
 * with mock data, without requiring contexts or routing.
 */
const DestinationDetailPresentation = ({
  destination,
  experiences = [],
  user = null,
  isOwner = false,
  isFavorite = false,
  isLoading = false,
  visibleCount = 6,
}) => {
  const [favHover, setFavHover] = useState(false);
  const [currentVisibleCount, setCurrentVisibleCount] = useState(visibleCount);

  // Loading state
  if (isLoading) {
    return (
      <div className={styles.destinationContainer}>
        <Container>
          <SkeletonLoader variant="rectangle" width="100%" height="400px" className={styles.skeletonHero} />
          <Row>
            <Col lg={8}>
              <SkeletonLoader variant="rectangle" width="100%" height="200px" style={{ marginBottom: 'var(--space-6)' }} />
              <SkeletonLoader variant="text" width="40%" height="32px" style={{ marginBottom: 'var(--space-4)' }} />
              <Row>
                <Col md={6}><SkeletonLoader variant="rectangle" width="100%" height="280px" /></Col>
                <Col md={6}><SkeletonLoader variant="rectangle" width="100%" height="280px" /></Col>
              </Row>
            </Col>
            <Col lg={4}>
              <SkeletonLoader variant="rectangle" width="100%" height="200px" />
            </Col>
          </Row>
        </Container>
      </div>
    );
  }

  // Not found state
  if (!destination) {
    return (
      <div className={styles.destinationContainer}>
        <Container>
          <EntityNotFound entityType="destination" />
        </Container>
      </div>
    );
  }

  // Get hero image URL
  const getHeroImageUrl = () => {
    if (!destination?.photos?.length) {
      return 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80';
    }
    return destination.photos[0]?.url;
  };

  // Compute values
  const favoriteCount = destination?.users_favorite?.length || 0;
  const experienceCount = experiences.length;
  const heroPhotos = destination?.photos || [];
  const displayedExperiences = experiences.slice(0, currentVisibleCount);
  const hasMoreExperiences = experiences.length > currentVisibleCount;

  // Format destination title
  const destinationTitle = `${destination.name}, ${!destination.state
    ? destination.country
    : destination.state === destination.name
    ? destination.country
    : destination.state}`;

  return (
    <div className={styles.destinationContainer}>
      <Container>
        {/* Breadcrumb Navigation */}
        <nav className={styles.breadcrumbNav} aria-label="breadcrumb">
          <Breadcrumb>
            <Breadcrumb.Item href="#">
              <FaHome size={12} style={{ marginRight: '4px' }} />
              Home
            </Breadcrumb.Item>
            <Breadcrumb.Item href="#">
              Destinations
            </Breadcrumb.Item>
            <Breadcrumb.Item active>
              {destination.name}
            </Breadcrumb.Item>
          </Breadcrumb>
        </nav>

        {/* Hero Image Section */}
        <div className={styles.heroSection}>
          <img
            src={getHeroImageUrl()}
            alt={destination.name}
            className={styles.heroImage}
          />
          <div className={styles.heroOverlay}>
            <h2 className={styles.heroTitle}>{destinationTitle}</h2>
            <div className={styles.heroMeta}>
              <span><FaMapMarkerAlt /> {destination.country}</span>
            </div>
          </div>
          <button
            type="button"
            className={styles.heroPhotoButton}
            aria-label={heroPhotos.length > 0 ? `View ${heroPhotos.length} photos` : "Add photos"}
          >
            <FaRegImage />
            {heroPhotos.length > 0 && (
              <span className={styles.photoCount}>{heroPhotos.length}</span>
            )}
          </button>
        </div>

        {/* Stats Bar */}
        <div className={styles.statsBar}>
          <div className={styles.statItem}>
            <FaPlane className={styles.statIcon} />
            <span className={styles.statValue}>{experienceCount}</span>
            <span className={styles.statLabel}>{experienceCount === 1 ? 'Experience' : 'Experiences'}</span>
          </div>
          <div className={styles.statItem}>
            <FaHeart className={styles.statIcon} />
            <span className={styles.statValue}>{favoriteCount}</span>
            <span className={styles.statLabel}>{favoriteCount === 1 ? 'Favorite' : 'Favorites'}</span>
          </div>
          {destination.travel_tips?.length > 0 && (
            <div className={styles.statItem}>
              <FaLightbulb className={styles.statIcon} />
              <span className={styles.statValue}>{destination.travel_tips.length}</span>
              <span className={styles.statLabel}>{destination.travel_tips.length === 1 ? 'Travel Tip' : 'Travel Tips'}</span>
            </div>
          )}
          {heroPhotos.length > 0 && (
            <div className={styles.statItem}>
              <FaCamera className={styles.statIcon} />
              <span className={styles.statValue}>{heroPhotos.length}</span>
              <span className={styles.statLabel}>{heroPhotos.length === 1 ? 'Photo' : 'Photos'}</span>
            </div>
          )}
        </div>

        {/* Content Grid */}
        <Row>
          {/* Main Content Column */}
          <Col lg={8}>
            {/* Overview Section */}
            {destination.overview && (
              <Card className={styles.contentCard}>
                <Card.Body className={styles.contentCardBody}>
                  <h3 className={styles.sectionTitle}>Overview</h3>
                  <p className={styles.sectionText}>{destination.overview}</p>
                </Card.Body>
              </Card>
            )}

            {/* Map Section Placeholder */}
            <Card className={styles.contentCard}>
              <Card.Body className={styles.contentCardBody}>
                <h3 className={styles.sectionTitle}>
                  <FaMapMarkerAlt style={{ marginRight: '8px' }} />
                  Location
                </h3>
                <div
                  style={{
                    height: '350px',
                    background: 'var(--color-bg-secondary)',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--color-text-muted)'
                  }}
                >
                  <FaMapMarkerAlt style={{ fontSize: '3rem', opacity: 0.5 }} />
                  <span style={{ marginLeft: '12px' }}>Map of {destination.name}</span>
                </div>
              </Card.Body>
            </Card>

            {/* Travel Tips Section */}
            {destination.travel_tips?.length > 0 && (
              <Card className={styles.contentCard}>
                <Card.Body className={styles.contentCardBody}>
                  <h3 className={styles.sectionTitle}>
                    <span className={styles.sectionIcon} aria-hidden="true">💡</span>
                    Travel Tips & Information
                  </h3>
                  <TravelTipsList tips={destination.travel_tips} hideHeading />
                </Card.Body>
              </Card>
            )}

            {/* Popular Experiences Section */}
            <Card className={styles.contentCard}>
              <Card.Body className={styles.contentCardBody}>
                <DestinationExperienceGrid
                  experiences={experiences}
                  destinationName={destination.name}
                  destinationId={destination._id}
                  destinationCountry={destination.country}
                  visibleCount={currentVisibleCount}
                  hasMore={hasMoreExperiences}
                  onLoadMore={() => setCurrentVisibleCount((prev) => prev + 6)}
                  isLoading={false}
                  userPlans={[]}
                  onOptimisticDelete={() => {}}
                  onAddExperience={() => alert('Add experience clicked')}
                />
              </Card.Body>
            </Card>
          </Col>

          {/* Sidebar Column */}
          <Col lg={4}>
            <div className={styles.sidebar}>
              <h3 className={styles.sidebarTitle}>Quick Actions</h3>
              <div className={styles.sidebarActions}>
                {/* Favorite Button */}
                <Button
                  variant={isFavorite ? (favHover ? "danger" : "outline") : "gradient"}
                  rounded
                  fullWidth
                  onClick={() => alert('Favorite clicked')}
                  onMouseEnter={() => setFavHover(true)}
                  onMouseLeave={() => setFavHover(false)}
                >
                  {isFavorite
                    ? (favHover ? 'Remove Favorite' : 'Favorited')
                    : '+ Favorite'}
                </Button>

                {/* Share Button */}
                <Button
                  variant="outline"
                  rounded
                  fullWidth
                  onClick={() => alert('Share clicked')}
                >
                  <FaShare style={{ marginRight: '8px' }} /> Share Destination
                </Button>

                {/* Owner Actions */}
                {isOwner && (
                  <>
                    <Button
                      variant="outline"
                      rounded
                      fullWidth
                      onClick={() => alert('Edit clicked')}
                    >
                      <FaEdit style={{ marginRight: '8px' }} /> Edit Destination
                    </Button>
                    <Button
                      variant="danger"
                      rounded
                      fullWidth
                      onClick={() => alert('Delete clicked')}
                    >
                      <FaTrash style={{ marginRight: '8px' }} /> Delete Destination
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

// ============================================================
// Story Variants
// ============================================================

/**
 * 1. Default (Owner View)
 * Owner view with edit and delete buttons visible.
 */
export const Default = {
  args: {
    destination: mockDestination,
    experiences: mockExperiences,
    user: mockUser,
    isOwner: true,
    isFavorite: false,
    isLoading: false,
  },
  render: (args) => <DestinationDetailPresentation {...args} />,
  parameters: {
    docs: {
      description: {
        story: 'Owner view with edit and delete buttons visible.',
      },
    },
  },
};

/**
 * 2. Loading State
 * Loading state with skeleton placeholders.
 */
export const Loading = {
  args: {
    destination: null,
    experiences: [],
    user: mockUser,
    isLoading: true,
  },
  render: (args) => <DestinationDetailPresentation {...args} />,
  parameters: {
    docs: {
      description: {
        story: 'Loading state with skeleton placeholders.',
      },
    },
  },
};

/**
 * 3. Not Found
 * Error state when destination doesn't exist.
 */
export const NotFound = {
  args: {
    destination: null,
    experiences: [],
    user: mockUser,
    isLoading: false,
  },
  render: (args) => <DestinationDetailPresentation {...args} />,
  parameters: {
    docs: {
      description: {
        story: 'Error state when destination doesn\'t exist.',
      },
    },
  },
};

/**
 * 4. Visitor View (Non-Owner)
 * Visitor view with only favorite button (no edit/delete).
 */
export const VisitorView = {
  args: {
    destination: mockDestination,
    experiences: mockExperiences,
    user: mockVisitorUser,
    isOwner: false,
    isFavorite: false,
  },
  render: (args) => <DestinationDetailPresentation {...args} />,
  parameters: {
    docs: {
      description: {
        story: 'Visitor view with only favorite button (no edit/delete).',
      },
    },
  },
};

/**
 * 5. Favorited
 * Destination that the user has already favorited.
 */
export const Favorited = {
  args: {
    destination: { ...mockDestination, users_favorite: ['user-002'] },
    experiences: mockExperiences,
    user: mockVisitorUser,
    isOwner: false,
    isFavorite: true,
  },
  render: (args) => <DestinationDetailPresentation {...args} />,
  parameters: {
    docs: {
      description: {
        story: 'Destination that the user has already favorited.',
      },
    },
  },
};

/**
 * 6. No Experiences
 * Empty state with CTA to add first experience.
 */
export const NoExperiences = {
  args: {
    destination: mockDestination,
    experiences: [],
    user: mockUser,
    isOwner: true,
  },
  render: (args) => <DestinationDetailPresentation {...args} />,
  parameters: {
    docs: {
      description: {
        story: 'Empty state with CTA to add first experience.',
      },
    },
  },
};

/**
 * 7. Many Experiences (Infinite Scroll)
 * 50 experiences demonstrating infinite scroll.
 */
export const ManyExperiences = {
  args: {
    destination: mockDestination,
    experiences: Array.from({ length: 50 }, (_, i) => ({
      ...mockExperiences[0],
      _id: `exp-${i}`,
      name: `Experience ${i + 1}`
    })),
    user: mockUser,
    isOwner: true,
  },
  render: (args) => <DestinationDetailPresentation {...args} />,
  parameters: {
    docs: {
      description: {
        story: '50 experiences demonstrating infinite scroll.',
      },
    },
  },
};

/**
 * 8. Dark Mode
 * Default view in dark mode.
 */
export const DarkMode = {
  args: {
    destination: mockDestination,
    experiences: mockExperiences,
    user: mockUser,
    isOwner: true,
    isFavorite: false,
  },
  render: (args) => <DestinationDetailPresentation {...args} />,
  parameters: {
    backgrounds: { default: 'dark' },
    themes: { default: 'dark' },
    docs: {
      description: {
        story: 'Default view rendered in dark mode.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div data-theme="dark" style={{ minHeight: '100vh', background: 'var(--color-bg-primary)' }}>
        <Story />
      </div>
    ),
  ],
};

/**
 * 9. Mobile View
 * Default view optimized for mobile viewport.
 */
export const Mobile = {
  args: {
    destination: mockDestination,
    experiences: mockExperiences.slice(0, 4),
    user: mockUser,
    isOwner: true,
  },
  render: (args) => <DestinationDetailPresentation {...args} />,
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
    chromatic: { viewports: [320] },
    docs: {
      description: {
        story: 'Mobile-optimized layout with stacked columns.',
      },
    },
  },
};

/**
 * 10. Tablet View
 * Default view optimized for tablet viewport.
 */
export const Tablet = {
  args: {
    destination: mockDestination,
    experiences: mockExperiences.slice(0, 6),
    user: mockUser,
    isOwner: true,
  },
  render: (args) => <DestinationDetailPresentation {...args} />,
  parameters: {
    viewport: { defaultViewport: 'tablet' },
    chromatic: { viewports: [768] },
    docs: {
      description: {
        story: 'Tablet-optimized layout.',
      },
    },
  },
};

/**
 * 11. No Travel Tips
 * Destination without any travel tips.
 */
export const NoTravelTips = {
  args: {
    destination: { ...mockDestination, travel_tips: [] },
    experiences: mockExperiences,
    user: mockUser,
    isOwner: true,
  },
  render: (args) => <DestinationDetailPresentation {...args} />,
  parameters: {
    docs: {
      description: {
        story: 'Destination without travel tips section.',
      },
    },
  },
};

/**
 * ExperienceDetailView Stories
 *
 * Comprehensive Storybook stories for the Experience Detail View.
 * Due to the complex context dependencies of SingleExperience,
 * these stories use a presentational wrapper that renders the key
 * layout sections with mock data.
 */

import React, { useState } from 'react';
import { Container, Row, Col, Card, Breadcrumb, Badge } from 'react-bootstrap';
import { FaMapMarkerAlt, FaHeart, FaShare, FaEdit, FaTrash, FaRegImage, FaStar, FaHome, FaCalendarAlt, FaDollarSign, FaClock, FaCheckCircle, FaUserPlus } from 'react-icons/fa';
import { Button, SkeletonLoader, EntityNotFound, EmptyState } from '../../components/design-system';
import PlanningTime from '../../components/PlanningTime/PlanningTime';
import CostEstimate from '../../components/CostEstimate/CostEstimate';
import { StarRating, DifficultyRating } from '../../components/RatingScale/RatingScale';
import styles from '../../views/SingleExperience/SingleExperience.module.scss';

export default {
  title: 'Views/ExperienceDetailView',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
The Experience Detail View displays comprehensive information about a travel experience:

- Hero section with image and photo count
- Tags for experience type, destination, and curator
- Title with destination link
- Overview card with description
- Plan items with tabs for Experience/My Plan views
- Sidebar with details (rating, difficulty, cost, planning time)
- Action buttons (plan, favorite, share, edit, delete)

**Features:**
- Dark mode support
- Responsive design (mobile-first)
- WCAG 2.1 Level AA compliant
- Event-driven updates
- Real-time collaboration support
        `,
      },
    },
    chromatic: { viewports: [320, 768, 1280] },
  },
  argTypes: {
    experience: { control: 'object' },
    isOwner: { control: 'boolean' },
    isFavorite: { control: 'boolean' },
    hasPlanned: { control: 'boolean' },
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
  photos: [
    { _id: 'photo-1', url: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1200' }
  ]
};

const mockExperience = {
  _id: 'exp-001',
  name: 'Tokyo Food Tour',
  description: 'Embark on a culinary journey through Tokyo\'s most famous food districts. From the bustling Tsukiji Market to hidden ramen shops, discover the authentic flavors that make Japanese cuisine world-renowned.',
  destination: mockDestination,
  experience_type: 'Food & Dining',
  photos: [
    { _id: 'exp-photo-1', url: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1200' },
    { _id: 'exp-photo-2', url: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=1200' }
  ],
  plan_items: [
    { _id: 'item-1', content: 'Visit Tsukiji Outer Market', completed: false },
    { _id: 'item-2', content: 'Ramen tasting in Shinjuku', completed: false },
    { _id: 'item-3', content: 'Sake tasting experience', completed: false },
    { _id: 'item-4', content: 'Sushi masterclass', completed: false },
    { _id: 'item-5', content: 'Street food tour in Asakusa', completed: false },
  ],
  rating: 4.8,
  difficulty: 2,
  cost_estimate: 1200,
  max_planning_days: 5,
  permissions: [
    { _id: 'user-001', entity: 'user', type: 'owner' }
  ],
  user: { _id: 'user-001', name: 'Demo User' },
  createdAt: '2024-01-15T00:00:00Z'
};

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

const mockCurator = {
  _id: 'curator-001',
  name: 'Expert Traveler',
  bio: 'Professional food critic and travel writer with 15 years of experience exploring Asian cuisine.',
  feature_flags: [{ flag: 'curator', enabled: true }]
};

// ============================================================
// Presentational Wrapper Component
// ============================================================

/**
 * ExperienceDetailPresentation
 * A presentational component that renders the experience detail layout
 * with mock data, without requiring contexts or routing.
 */
const ExperienceDetailPresentation = ({
  experience,
  destination = null,
  user = null,
  isOwner = false,
  isFavorite = false,
  hasPlanned = false,
  isCurated = false,
  curator = null,
  isLoading = false,
}) => {
  const [favHover, setFavHover] = useState(false);
  const [activeTab, setActiveTab] = useState('experience');

  // Loading state
  if (isLoading) {
    return (
      <div className={styles.experienceDetailContainer}>
        <Container>
          <Row>
            <Col lg={8}>
              <div className={styles.heroSection}>
                <SkeletonLoader variant="rectangle" width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }} />
              </div>
              <div className={styles.tagsSection} style={{ marginTop: 'var(--space-4)' }}>
                <SkeletonLoader variant="rectangle" width="80px" height="28px" style={{ borderRadius: 'var(--radius-full)' }} />
                <SkeletonLoader variant="rectangle" width="100px" height="28px" style={{ borderRadius: 'var(--radius-full)' }} />
              </div>
              <div className={styles.titleSection} style={{ marginTop: 'var(--space-4)' }}>
                <SkeletonLoader variant="text" width="70%" height="40px" />
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
                  <SkeletonLoader variant="circle" width="20px" height="20px" />
                  <SkeletonLoader variant="text" width="200px" height="20px" />
                </div>
              </div>
              <Card className={styles.contentCard} style={{ marginTop: 'var(--space-6)' }}>
                <Card.Body className={styles.cardBody}>
                  <SkeletonLoader variant="text" width="120px" height="24px" style={{ marginBottom: 'var(--space-4)' }} />
                  <SkeletonLoader variant="text" lines={4} />
                </Card.Body>
              </Card>
            </Col>
            <Col lg={4}>
              <div className={styles.sidebar}>
                <div className={styles.sidebarCard}>
                  <SkeletonLoader variant="text" width="140px" height="24px" style={{ marginBottom: 'var(--space-4)' }} />
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} style={{ marginBottom: 'var(--space-3)' }}>
                      <SkeletonLoader variant="text" width="80px" height="14px" style={{ marginBottom: 'var(--space-1)' }} />
                      <SkeletonLoader variant="text" width="120px" height="20px" />
                    </div>
                  ))}
                </div>
              </div>
            </Col>
          </Row>
        </Container>
      </div>
    );
  }

  // Not found state
  if (!experience) {
    return (
      <div className={styles.experienceDetailContainer}>
        <Container>
          <EntityNotFound entityType="experience" />
        </Container>
      </div>
    );
  }

  // Get hero image URL
  const getHeroImageUrl = () => {
    if (experience?.photos?.length > 0) {
      return experience.photos[0]?.url || experience.photos[0];
    }
    if (destination?.photos?.length > 0) {
      return destination.photos[0]?.url || destination.photos[0];
    }
    return 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80';
  };

  const effectiveDestination = destination || experience.destination;
  const photoCount = experience.photos?.length || 0;
  const planItemCount = experience.plan_items?.length || 0;

  return (
    <div className={styles.experienceDetailContainer}>
      <Container>
        {/* Breadcrumb Navigation */}
        <nav className={styles.breadcrumbNav} aria-label="breadcrumb">
          <Breadcrumb>
            <Breadcrumb.Item href="#">
              <FaHome size={12} style={{ marginRight: '4px' }} />
              Home
            </Breadcrumb.Item>
            {effectiveDestination && (
              <Breadcrumb.Item href="#">
                {effectiveDestination.name}
              </Breadcrumb.Item>
            )}
            <Breadcrumb.Item active>
              {experience.name}
            </Breadcrumb.Item>
          </Breadcrumb>
        </nav>

        <Row>
          {/* Main Content Column (8 cols on lg+) */}
          <Col lg={8}>
            {/* Hero Image Section */}
            <div className={styles.heroSection}>
              <img
                src={getHeroImageUrl()}
                alt={experience.name}
              />
              <button
                type="button"
                className={styles.heroPhotoButton}
                onClick={() => alert('Open photo viewer')}
                aria-label={photoCount > 0 ? `View ${photoCount} photos` : "Add photos"}
              >
                <FaRegImage />
                {photoCount > 0 && (
                  <span className={styles.photoCount}>{photoCount}</span>
                )}
              </button>
            </div>

            {/* Tags Section */}
            <div className={styles.tagsSection}>
              {isCurated && curator && (
                <span className={styles.curatorBadge}>
                  <FaStar size={12} />
                  Curated by {curator.name}
                </span>
              )}
              {experience.experience_type && (
                <span className={styles.tag}>{experience.experience_type}</span>
              )}
              {effectiveDestination && (
                <Badge bg="secondary" className={styles.tag}>
                  <FaMapMarkerAlt size={10} style={{ marginRight: '4px' }} />
                  {effectiveDestination.name}
                </Badge>
              )}
            </div>

            {/* Title Section */}
            <div className={styles.titleSection}>
              <h1 className={styles.experienceTitle}>{experience.name}</h1>
              {effectiveDestination && (
                <div className={styles.locationText}>
                  <FaMapMarkerAlt />
                  <span>{effectiveDestination.name}, {effectiveDestination.country}</span>
                </div>
              )}
            </div>

            {/* Stats Bar */}
            <div className={styles.statsBar}>
              <div className={styles.statItem}>
                <FaCalendarAlt className={styles.statIcon} />
                <span className={styles.statValue}>{planItemCount}</span>
                <span className={styles.statLabel}>{planItemCount === 1 ? 'Activity' : 'Activities'}</span>
              </div>
              {photoCount > 0 && (
                <div className={styles.statItem}>
                  <FaRegImage className={styles.statIcon} />
                  <span className={styles.statValue}>{photoCount}</span>
                  <span className={styles.statLabel}>{photoCount === 1 ? 'Photo' : 'Photos'}</span>
                </div>
              )}
              {experience.rating > 0 && (
                <div className={styles.statItem}>
                  <FaStar className={styles.statIcon} />
                  <span className={styles.statValue}>{experience.rating}</span>
                  <span className={styles.statLabel}>Rating</span>
                </div>
              )}
            </div>

            {/* Overview Card */}
            {experience.description && (
              <Card className={styles.contentCard}>
                <Card.Body className={styles.cardBody}>
                  <h3 className={styles.cardTitle}>Overview</h3>
                  <p className={styles.cardDescription}>{experience.description}</p>
                </Card.Body>
              </Card>
            )}

            {/* Plan Items Card */}
            <Card className={styles.contentCard}>
              <Card.Body className={styles.cardBody}>
                {/* Tabs */}
                <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', borderBottom: '1px solid var(--color-border-light)', paddingBottom: 'var(--space-3)' }}>
                  <button
                    type="button"
                    onClick={() => setActiveTab('experience')}
                    style={{
                      padding: 'var(--space-2) var(--space-4)',
                      borderRadius: 'var(--radius-md)',
                      border: 'none',
                      background: activeTab === 'experience' ? 'var(--color-primary)' : 'transparent',
                      color: activeTab === 'experience' ? 'white' : 'var(--color-text-secondary)',
                      fontWeight: 'var(--font-weight-medium)',
                      cursor: 'pointer'
                    }}
                  >
                    Experience ({planItemCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('myplan')}
                    style={{
                      padding: 'var(--space-2) var(--space-4)',
                      borderRadius: 'var(--radius-md)',
                      border: 'none',
                      background: activeTab === 'myplan' ? 'var(--color-primary)' : 'transparent',
                      color: activeTab === 'myplan' ? 'white' : 'var(--color-text-secondary)',
                      fontWeight: 'var(--font-weight-medium)',
                      cursor: 'pointer'
                    }}
                  >
                    My Plan
                  </button>
                </div>

                {/* Plan Items List */}
                {activeTab === 'experience' && experience.plan_items?.length > 0 ? (
                  <div>
                    {experience.plan_items.map((item, index) => (
                      <div
                        key={item._id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--space-3)',
                          padding: 'var(--space-3)',
                          borderBottom: index < experience.plan_items.length - 1 ? '1px solid var(--color-border-light)' : 'none'
                        }}
                      >
                        <div style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          border: '2px solid var(--color-border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--color-text-muted)',
                          fontSize: 'var(--font-size-xs)'
                        }}>
                          {index + 1}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>
                            {item.content}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : activeTab === 'myplan' ? (
                  <EmptyState
                    variant="plans"
                    title="No Plan Yet"
                    description="Plan this experience to track your progress."
                    primaryAction="Plan This Experience"
                    onPrimaryAction={() => alert('Plan experience')}
                    size="sm"
                  />
                ) : (
                  <EmptyState
                    variant="experiences"
                    title="No Activities"
                    description="This experience doesn't have any activities yet."
                    size="sm"
                  />
                )}
              </Card.Body>
            </Card>
          </Col>

          {/* Sidebar Column (4 cols on lg+) */}
          <Col lg={4}>
            <div className={styles.sidebar}>
              <div className={styles.sidebarCard}>
                <h3 className={styles.sidebarTitle}>Experience Details</h3>

                {/* Details List */}
                <div className={styles.detailsList}>
                  {experience.rating > 0 && (
                    <div className={styles.detailItem}>
                      <div className={styles.detailLabel}>Rating</div>
                      <div className={styles.detailValue}>
                        <StarRating rating={experience.rating} size="md" showValue={true} />
                      </div>
                    </div>
                  )}
                  {experience.difficulty > 0 && (
                    <div className={styles.detailItem}>
                      <div className={styles.detailLabel}>Difficulty</div>
                      <div className={styles.detailValue}>
                        <DifficultyRating difficulty={experience.difficulty} size="md" showValue={true} showLabel={true} variant="dots" />
                      </div>
                    </div>
                  )}
                  {experience.cost_estimate > 0 && (
                    <div className={styles.detailItem}>
                      <div className={styles.detailLabel}>Estimated Cost</div>
                      <div className={styles.detailValue}>
                        <CostEstimate cost={experience.cost_estimate} showLabel={false} showTooltip={true} showDollarSigns={true} />
                      </div>
                    </div>
                  )}
                  {experience.max_planning_days > 0 && (
                    <div className={styles.detailItem}>
                      <div className={styles.detailLabel}>Planning Time</div>
                      <div className={styles.detailValue}>
                        <PlanningTime days={experience.max_planning_days} showLabel={false} showTooltip={true} size="md" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className={styles.sidebarActions}>
                  {/* Plan Button */}
                  <Button
                    variant={hasPlanned ? "success" : "gradient"}
                    rounded
                    fullWidth
                    onClick={() => alert('Plan experience')}
                  >
                    {hasPlanned ? (
                      <>
                        <FaCheckCircle style={{ marginRight: '8px' }} />
                        Planned
                      </>
                    ) : (
                      '+ Plan This Experience'
                    )}
                  </Button>

                  {/* Favorite Button */}
                  <Button
                    variant={isFavorite ? (favHover ? "danger" : "outline") : "outline"}
                    rounded
                    fullWidth
                    onClick={() => alert('Favorite clicked')}
                    onMouseEnter={() => setFavHover(true)}
                    onMouseLeave={() => setFavHover(false)}
                  >
                    <FaHeart style={{ marginRight: '8px' }} />
                    {isFavorite ? (favHover ? 'Remove Favorite' : 'Favorited') : 'Favorite'}
                  </Button>

                  {/* Share Button */}
                  <Button
                    variant="outline"
                    rounded
                    fullWidth
                    onClick={() => alert('Share clicked')}
                  >
                    <FaShare style={{ marginRight: '8px' }} /> Share
                  </Button>

                  {/* Owner Actions */}
                  {isOwner && (
                    <>
                      <Button
                        variant="outline"
                        rounded
                        fullWidth
                        onClick={() => alert('Add collaborator')}
                      >
                        <FaUserPlus style={{ marginRight: '8px' }} /> Add Collaborator
                      </Button>
                      <Button
                        variant="outline"
                        rounded
                        fullWidth
                        onClick={() => alert('Edit clicked')}
                      >
                        <FaEdit style={{ marginRight: '8px' }} /> Edit
                      </Button>
                      <Button
                        variant="danger"
                        rounded
                        fullWidth
                        onClick={() => alert('Delete clicked')}
                      >
                        <FaTrash style={{ marginRight: '8px' }} /> Delete
                      </Button>
                    </>
                  )}
                </div>
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
    experience: mockExperience,
    user: mockUser,
    isOwner: true,
    isFavorite: false,
    hasPlanned: false,
    isLoading: false,
  },
  render: (args) => <ExperienceDetailPresentation {...args} />,
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
    experience: null,
    user: mockUser,
    isLoading: true,
  },
  render: (args) => <ExperienceDetailPresentation {...args} />,
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
 * Error state when experience doesn't exist.
 */
export const NotFound = {
  args: {
    experience: null,
    user: mockUser,
    isLoading: false,
  },
  render: (args) => <ExperienceDetailPresentation {...args} />,
  parameters: {
    docs: {
      description: {
        story: 'Error state when experience doesn\'t exist.',
      },
    },
  },
};

/**
 * 4. Visitor View (Non-Owner)
 * Visitor view without edit/delete buttons.
 */
export const VisitorView = {
  args: {
    experience: mockExperience,
    user: mockVisitorUser,
    isOwner: false,
    isFavorite: false,
    hasPlanned: false,
  },
  render: (args) => <ExperienceDetailPresentation {...args} />,
  parameters: {
    docs: {
      description: {
        story: 'Visitor view without edit/delete buttons.',
      },
    },
  },
};

/**
 * 5. Planned Experience
 * Experience that the user has already planned.
 */
export const Planned = {
  args: {
    experience: mockExperience,
    user: mockVisitorUser,
    isOwner: false,
    isFavorite: false,
    hasPlanned: true,
  },
  render: (args) => <ExperienceDetailPresentation {...args} />,
  parameters: {
    docs: {
      description: {
        story: 'Experience that the user has already planned.',
      },
    },
  },
};

/**
 * 6. Favorited
 * Experience that the user has favorited.
 */
export const Favorited = {
  args: {
    experience: mockExperience,
    user: mockVisitorUser,
    isOwner: false,
    isFavorite: true,
    hasPlanned: false,
  },
  render: (args) => <ExperienceDetailPresentation {...args} />,
  parameters: {
    docs: {
      description: {
        story: 'Experience that the user has favorited.',
      },
    },
  },
};

/**
 * 7. Curated Experience
 * Experience created by a curator with badge.
 */
export const Curated = {
  args: {
    experience: mockExperience,
    user: mockVisitorUser,
    isOwner: false,
    isFavorite: false,
    hasPlanned: false,
    isCurated: true,
    curator: mockCurator,
  },
  render: (args) => <ExperienceDetailPresentation {...args} />,
  parameters: {
    docs: {
      description: {
        story: 'Experience created by a curator with badge.',
      },
    },
  },
};

/**
 * 8. No Plan Items
 * Experience without any plan items.
 */
export const NoPlanItems = {
  args: {
    experience: { ...mockExperience, plan_items: [] },
    user: mockUser,
    isOwner: true,
  },
  render: (args) => <ExperienceDetailPresentation {...args} />,
  parameters: {
    docs: {
      description: {
        story: 'Experience without any plan items.',
      },
    },
  },
};

/**
 * 9. Minimal Experience
 * Experience with minimal data (no rating, difficulty, etc.).
 */
export const Minimal = {
  args: {
    experience: {
      ...mockExperience,
      rating: 0,
      difficulty: 0,
      cost_estimate: 0,
      max_planning_days: 0,
      photos: [],
      experience_type: null,
    },
    user: mockUser,
    isOwner: true,
  },
  render: (args) => <ExperienceDetailPresentation {...args} />,
  parameters: {
    docs: {
      description: {
        story: 'Experience with minimal data.',
      },
    },
  },
};

/**
 * 10. Dark Mode
 * Default view in dark mode.
 */
export const DarkMode = {
  args: {
    experience: mockExperience,
    user: mockUser,
    isOwner: true,
    isFavorite: false,
    hasPlanned: false,
  },
  render: (args) => <ExperienceDetailPresentation {...args} />,
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
 * 11. Mobile View
 * Default view optimized for mobile viewport.
 */
export const Mobile = {
  args: {
    experience: mockExperience,
    user: mockUser,
    isOwner: true,
  },
  render: (args) => <ExperienceDetailPresentation {...args} />,
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
 * 12. Tablet View
 * Default view optimized for tablet viewport.
 */
export const Tablet = {
  args: {
    experience: mockExperience,
    user: mockUser,
    isOwner: true,
  },
  render: (args) => <ExperienceDetailPresentation {...args} />,
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

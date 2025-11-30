/**
 * Profile Layouts Stories
 * Storybook stories for profile page layout components and patterns.
 */

import React, { useState } from 'react';
import { FaUser, FaPassport, FaCheckCircle, FaKey, FaEye, FaEdit, FaEnvelope, FaUserShield } from 'react-icons/fa';
import PhotoCard from '../../components/PhotoCard/PhotoCard';
import DestinationCard from '../../components/DestinationCard/DestinationCard';
import ExperienceCard from '../../components/ExperienceCard/ExperienceCard';
import SkeletonLoader from '../../components/SkeletonLoader/SkeletonLoader';
import Alert from '../../components/Alert/Alert';
import Loading from '../../components/Loading/Loading';
import { Button, Container, Heading, EmptyState } from '../../components/design-system';
import TagPill from '../../components/Pill/TagPill';
import Pagination from '../../components/Pagination/Pagination';
import ViewNav from '../../components/ViewNav/ViewNav';
import styles from '../../views/Profile/Profile.module.scss';

export default {
  title: 'Page Layouts/Profile',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Layout components and patterns for user profile pages. Displays user information, experiences, and destinations.',
      },
    },
  },
};

// ============================================================
// Sample Data
// ============================================================

const sampleUser = {
  _id: '507f1f77bcf86cd799439011',
  name: 'Jane Traveler',
  email: 'jane@example.com',
  emailConfirmed: true,
  role: 'regular_user',
  photos: [
    { _id: 'photo1', url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400' },
    { _id: 'photo2', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400' },
  ],
  default_photo_id: 'photo1',
};

const sampleDestinations = [
  { _id: 'd1', name: 'Tokyo', country: 'Japan', users_favorite: ['507f1f77bcf86cd799439011'] },
  { _id: 'd2', name: 'Paris', country: 'France', users_favorite: ['507f1f77bcf86cd799439011'] },
  { _id: 'd3', name: 'Bali', country: 'Indonesia', users_favorite: ['507f1f77bcf86cd799439011'] },
];

const sampleExperiences = [
  {
    _id: 'e1',
    name: 'Tokyo Food Tour',
    description: 'Explore authentic Japanese cuisine',
    experience_type: 'Food,Culture',
    destination: { _id: 'd1', name: 'Tokyo', country: 'Japan' },
    photos: [{ url: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800' }],
    cost_estimate: 1200,
    max_planning_days: 5,
  },
  {
    _id: 'e2',
    name: 'Kyoto Temple Walk',
    description: 'Visit ancient temples and shrines',
    experience_type: 'History,Nature',
    destination: { _id: 'd4', name: 'Kyoto', country: 'Japan' },
    photos: [{ url: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800' }],
    cost_estimate: 800,
    max_planning_days: 3,
  },
  {
    _id: 'e3',
    name: 'Parisian Art & Museums',
    description: 'Explore world-class art museums',
    experience_type: 'Art,Culture',
    destination: { _id: 'd2', name: 'Paris', country: 'France' },
    photos: [{ url: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800' }],
    cost_estimate: 500,
    max_planning_days: 4,
  },
];

const sampleExperienceTypes = ['Food', 'Culture', 'History', 'Nature', 'Art', 'Adventure'];

// ============================================================
// Profile Header Component
// ============================================================

const ProfileHeader = ({ user, isOwner = true, isLoading = false, onEditProfile, onMoreOptions }) => (
  <div className="view-header">
    <div className="row">
      <div className="col-md-6">
        <div className={styles.profileHeadingWrapper}>
          <h1 className="mb-0">
            {isLoading ? (
              <span className="loading-skeleton loading-skeleton-text" style={{ width: '200px', height: '32px', display: 'inline-block' }}></span>
            ) : (
              user?.name || 'User Profile'
            )}
          </h1>
          {!isLoading && user?.emailConfirmed && (
            <FaCheckCircle
              className="text-success ms-2"
              title="Email confirmed"
              aria-label="Email confirmed"
            />
          )}
        </div>
      </div>
      <div className="col-md-6">
        <div className="header-actions">
          {!isLoading && (
            <div className="dropdown">
              <Button
                variant="bootstrap"
                bootstrapVariant="outline-secondary"
                type="button"
                data-bs-toggle="dropdown"
                aria-expanded="false"
                aria-label="Profile actions"
                onClick={onMoreOptions}
              >
                ⋯
              </Button>
              <ul className="dropdown-menu dropdown-menu-end">
                {isOwner && (
                  <li>
                    <button className={`dropdown-item ${styles.dropdownItem}`} onClick={onEditProfile}>
                      <FaEdit className={styles.dropdownIcon} />
                      <span>Update Profile</span>
                    </button>
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
);

// ============================================================
// Profile Detail Card Component
// ============================================================

const ProfileDetailCard = ({
  favoriteDestinations = [],
  experienceTypes = [],
  isLoading = false,
  isOwner = true,
  userName = 'This user',
}) => (
  <div className={`${styles.profileDetailCard} animation-fade-in`}>
    <div className={styles.profileDetailSection}>
      <Heading level={3} className={styles.profileDetailSectionTitle}>
        Favorite Destinations
      </Heading>
      <div className={`${styles.profileDetailContent} ${styles.profileDestinations}`}>
        {isLoading ? (
          <Loading size="md" message="Loading favorite destinations..." />
        ) : favoriteDestinations.length > 0 ? (
          favoriteDestinations.map((destination) => (
            <TagPill key={destination._id} color="light">
              <span className="icon"><FaPassport /></span>
              {destination.name}
            </TagPill>
          ))
        ) : (
          <EmptyState
            variant="favorites"
            icon="🗺️"
            title={isOwner ? "No Favorite Destinations" : "No Favorites Yet"}
            description={isOwner
              ? "You haven't added any destinations to your favorites yet."
              : `${userName} hasn't added any favorite destinations yet.`}
            primaryAction={isOwner ? "Explore Destinations" : null}
            onPrimaryAction={isOwner ? () => console.log('Navigate to destinations') : null}
            size="sm"
            compact
          />
        )}
      </div>
    </div>
    <div className={styles.profileDetailSection}>
      <Heading level={3} className={styles.profileDetailSectionTitle}>
        Preferred Experience Types
      </Heading>
      <div className={styles.profileDetailContent}>
        {isLoading ? (
          <Loading size="md" message="Loading preferred experience types..." />
        ) : experienceTypes.length > 0 ? (
          experienceTypes.map((type) => (
            <TagPill key={type} color="light" size="sm">
              <span className="icon"><FaUser /></span>
              {type}
            </TagPill>
          ))
        ) : (
          <EmptyState
            variant="experiences"
            title={isOwner ? "No Experience Types Yet" : "No Experience Types"}
            description={isOwner
              ? "Plan some experiences to see your preferred types here."
              : `${userName} hasn't planned any experiences yet.`}
            primaryAction={isOwner ? "Discover Experiences" : null}
            onPrimaryAction={isOwner ? () => console.log('Navigate to experiences') : null}
            size="sm"
            compact
          />
        )}
      </div>
    </div>
  </div>
);

// ============================================================
// Profile Navigation Tabs
// ============================================================

const ProfileTabs = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'experiences', label: 'Planned Experiences' },
    { id: 'created', label: 'Created Experiences' },
    { id: 'destinations', label: 'Experience Destinations' },
  ];

  return (
    <ViewNav
      items={tabs.map(tab => ({
        id: tab.id,
        label: tab.label,
        onClick: () => onTabChange(tab.id),
      }))}
      activeId={activeTab}
    />
  );
};

// ============================================================
// Stories
// ============================================================

export const ProfileComplete = {
  name: 'Profile - Complete',
  render: () => {
    const [activeTab, setActiveTab] = useState('experiences');
    const [currentPage, setCurrentPage] = useState(1);

    return (
      <div className="profile-dropdown-view" style={{ padding: '24px' }}>
        <ProfileHeader
          user={sampleUser}
          isOwner={true}
          onEditProfile={() => console.log('Edit profile clicked')}
        />

        <div className="row mb-4 animation-fade-in">
          <div className="col-md-6 p-3 animation-fade-in">
            <PhotoCard
              photos={sampleUser.photos}
              defaultPhotoId={sampleUser.default_photo_id}
              title={sampleUser.name}
            />
          </div>
          <div className="col-md-6 p-3 animation-fade-in">
            <ProfileDetailCard
              favoriteDestinations={sampleDestinations}
              experienceTypes={sampleExperienceTypes}
              isOwner={true}
            />
          </div>
        </div>

        <div className="row my-4 animation-fade-in">
          <ProfileTabs activeTab={activeTab} onTabChange={setActiveTab} />
        </div>

        <div className="row my-4 justify-content-center animation-fade-in">
          <div className={styles.profileCardsReserved} style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'center' }}>
            {activeTab === 'experiences' && sampleExperiences.map((experience) => (
              <ExperienceCard
                key={experience._id}
                experience={experience}
                userPlans={[]}
              />
            ))}
            {activeTab === 'created' && (
              <EmptyState
                variant="experiences"
                icon="✨"
                title="No Created Experiences"
                description="You haven't created any experiences yet. Share your travel knowledge with the community."
                primaryAction="Create Experience"
                onPrimaryAction={() => console.log('Create experience')}
                size="md"
              />
            )}
            {activeTab === 'destinations' && sampleDestinations.map((destination) => (
              <DestinationCard key={destination._id} destination={destination} />
            ))}
          </div>
        </div>

        {activeTab === 'experiences' && sampleExperiences.length > 6 && (
          <Pagination
            currentPage={currentPage}
            totalPages={Math.ceil(sampleExperiences.length / 6)}
            onPageChange={setCurrentPage}
          />
        )}
      </div>
    );
  },
};

export const ProfileLoading = {
  name: 'Profile - Loading State',
  render: () => (
    <div className="profile-dropdown-view" style={{ padding: '24px' }}>
      <ProfileHeader user={null} isLoading={true} />

      <div className="row mb-4 animation-fade-in">
        <div className="col-md-6 p-3 animation-fade-in">
          <div className="photoCard d-flex align-items-center justify-content-center" style={{ minHeight: '400px', background: 'var(--color-bg-secondary)', borderRadius: '12px' }}>
            <Loading size="lg" message="Loading profile..." />
          </div>
        </div>
        <div className="col-md-6 p-3 animation-fade-in">
          <ProfileDetailCard isLoading={true} />
        </div>
      </div>

      <div className="row my-4 animation-fade-in">
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
          {[1, 2, 3].map((i) => (
            <SkeletonLoader key={i} variant="rectangle" width="200px" height="150px" />
          ))}
        </div>
      </div>
    </div>
  ),
};

export const ProfileEmpty = {
  name: 'Profile - Empty States',
  render: () => {
    const [activeTab, setActiveTab] = useState('experiences');

    return (
      <div className="profile-dropdown-view" style={{ padding: '24px' }}>
        <ProfileHeader
          user={{ ...sampleUser, photos: [] }}
          isOwner={true}
        />

        <div className="row mb-4 animation-fade-in">
          <div className="col-md-6 p-3 animation-fade-in">
            <div className="photoCard d-flex align-items-center justify-content-center" style={{ minHeight: '300px', background: 'var(--color-bg-secondary)', borderRadius: '12px' }}>
              <div style={{ textAlign: 'center', padding: '24px' }}>
                <FaUser style={{ fontSize: '48px', color: 'var(--color-text-tertiary)', marginBottom: '16px' }} />
                <p style={{ color: 'var(--color-text-secondary)' }}>No photos yet</p>
                <Button variant="outline" size="sm">Upload Photo</Button>
              </div>
            </div>
          </div>
          <div className="col-md-6 p-3 animation-fade-in">
            <ProfileDetailCard
              favoriteDestinations={[]}
              experienceTypes={[]}
              isOwner={true}
            />
          </div>
        </div>

        <div className="row my-4 animation-fade-in">
          <ProfileTabs activeTab={activeTab} onTabChange={setActiveTab} />
        </div>

        <div className="row my-4 justify-content-center animation-fade-in">
          <EmptyState
            variant="experiences"
            title="No Planned Experiences"
            description="You haven't planned any experiences yet. Start exploring to add experiences to your profile."
            primaryAction="Discover Experiences"
            onPrimaryAction={() => console.log('Navigate to experiences')}
            size="lg"
          />
        </div>
      </div>
    );
  },
};

export const ProfileOtherUser = {
  name: 'Profile - Viewing Other User',
  render: () => {
    const otherUser = {
      ...sampleUser,
      _id: 'other-user-id',
      name: 'Alex Explorer',
      emailConfirmed: false,
    };

    return (
      <div className="profile-dropdown-view" style={{ padding: '24px' }}>
        <ProfileHeader
          user={otherUser}
          isOwner={false}
        />

        <div className="row mb-4 animation-fade-in">
          <div className="col-md-6 p-3 animation-fade-in">
            <PhotoCard
              photos={sampleUser.photos}
              defaultPhotoId={sampleUser.default_photo_id}
              title={otherUser.name}
            />
          </div>
          <div className="col-md-6 p-3 animation-fade-in">
            <ProfileDetailCard
              favoriteDestinations={sampleDestinations.slice(0, 2)}
              experienceTypes={sampleExperienceTypes.slice(0, 3)}
              isOwner={false}
              userName={otherUser.name}
            />
          </div>
        </div>

        <div className="row my-4 animation-fade-in">
          <ViewNav
            items={[
              { id: 'experiences', label: 'Planned Experiences', onClick: () => {} },
              { id: 'created', label: 'Created Experiences', onClick: () => {} },
              { id: 'destinations', label: 'Experience Destinations', onClick: () => {} },
            ]}
            activeId="experiences"
          />
        </div>

        <div className="row my-4 justify-content-center animation-fade-in">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'center' }}>
            {sampleExperiences.slice(0, 2).map((experience) => (
              <ExperienceCard
                key={experience._id}
                experience={experience}
                userPlans={[]}
              />
            ))}
          </div>
        </div>
      </div>
    );
  },
};

export const ProfileNotFound = {
  name: 'Profile - User Not Found',
  render: () => (
    <div className="container my-5">
      <Container className="justify-content-center">
        <div className="col-md-8">
          <Alert
            type="danger"
            title="User Not Found"
          >
            <p>The user profile you're looking for doesn't exist or has been removed.</p>
            <hr />
            <p className="mb-0">
              <a href="/" className="alert-link">Return to Home</a>
            </p>
          </Alert>
        </div>
      </Container>
    </div>
  ),
};

export const ProfileError = {
  name: 'Profile - Error State',
  render: () => (
    <div className="container my-5">
      <div className="row justify-content-center">
        <div className="col-md-8">
          <Alert
            type="warning"
            title="Unable to Load Profile"
          >
            <p>There was an error loading this profile. Please try again.</p>
            <hr />
            <p className="mb-0">
              <Button variant="primary" onClick={() => console.log('Retry')}>Try Again</Button>
            </p>
          </Alert>
        </div>
      </div>
    </div>
  ),
};

export const ProfileSuperAdminView = {
  name: 'Profile - Super Admin View',
  render: () => {
    const [isUpdatingRole, setIsUpdatingRole] = useState(false);

    return (
      <div className="profile-dropdown-view" style={{ padding: '24px' }}>
        <ProfileHeader
          user={sampleUser}
          isOwner={false}
        />

        <div className="row mb-4 animation-fade-in">
          <div className="col-md-6 p-3">
            <PhotoCard
              photos={sampleUser.photos}
              defaultPhotoId={sampleUser.default_photo_id}
              title={sampleUser.name}
            />
          </div>
          <div className="col-md-6 p-3">
            <ProfileDetailCard
              favoriteDestinations={sampleDestinations}
              experienceTypes={sampleExperienceTypes}
              isOwner={false}
              userName={sampleUser.name}
            />
          </div>
        </div>

        {/* Super Admin Permissions Section */}
        <div className="row my-4 animation-fade-in">
          <div className="col-12">
            <div className="card">
              <div className="card-header">
                <h5 className="mb-0">Super Admin Permissions</h5>
              </div>
              <div className="card-body">
                <div className="row align-items-center mb-4">
                  <div className="col-md-6">
                    <p className="mb-2">
                      <strong>Current Role:</strong> Regular User
                    </p>
                    <p className="small mb-0" style={{ color: 'var(--bs-gray-600)' }}>
                      Change this user's role. Super admins have full access to all resources and user management.
                    </p>
                  </div>
                  <div className="col-md-6">
                    <div className="d-flex gap-2">
                      <button
                        className="btn btn-outline-success"
                        disabled={isUpdatingRole}
                        onClick={() => {
                          setIsUpdatingRole(true);
                          setTimeout(() => setIsUpdatingRole(false), 1000);
                        }}
                      >
                        {isUpdatingRole ? 'Updating...' : 'Make Super Admin'}
                      </button>
                      <button
                        className="btn btn-secondary"
                        disabled={true}
                      >
                        Make Regular User
                      </button>
                    </div>
                  </div>
                </div>
                <hr />
                <div className="row align-items-center mt-4">
                  <div className="col-md-6">
                    <p className="mb-2">
                      <strong>Email Status:</strong>{' '}
                      <span className="text-success">
                        <FaCheckCircle className="me-1" />
                        Confirmed
                      </span>
                    </p>
                    <p className="small mb-0" style={{ color: 'var(--bs-gray-600)' }}>
                      Manually confirm or unconfirm this user's email address.
                    </p>
                  </div>
                  <div className="col-md-6">
                    <div className="d-flex gap-2">
                      <button className="btn btn-success" disabled>
                        Confirm Email
                      </button>
                      <button className="btn btn-outline-danger">
                        Unconfirm Email
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  },
};

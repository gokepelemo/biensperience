import styles from "./SingleDestination.module.scss";
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { showDestination } from "../../utilities/destinations-api";
import { useUser } from "../../contexts/UserContext";
import { useData } from "../../contexts/DataContext";
import { useApp } from "../../contexts/AppContext";
import { useToast } from "../../contexts/ToastContext";
import { useExperienceWizard } from "../../contexts/ExperienceWizardContext";
import GoogleMap from "../../components/GoogleMap/GoogleMap";
import ExperienceCard from "../../components/ExperienceCard/ExperienceCard";
import DestinationExperienceGrid from "./components/DestinationExperienceGrid";
import TravelTipsList from "../../components/TravelTipsList/TravelTipsList";
import { logger } from "../../utilities/logger";
import { eventBus } from "../../utilities/event-bus";
import { getExperiences } from "../../utilities/experiences-api";
import Alert from "../../components/Alert/Alert";
import { lang } from "../../lang.constants";
import PageOpenGraph from "../../components/OpenGraph/PageOpenGraph";
import PageSchema from '../../components/PageSchema/PageSchema';
import { buildDestinationSchema } from '../../utilities/schema-utils';
import { isOwner } from "../../utilities/permissions";
import { Container, Button, SkeletonLoader, EntityNotFound, EmptyState } from "../../components/design-system";
import Loading from "../../components/Loading/Loading";
import { toggleUserFavoriteDestination, deleteDestination } from "../../utilities/destinations-api";
import ConfirmModal from "../../components/ConfirmModal/ConfirmModal";
import { FaMapMarkerAlt, FaHeart, FaPlane, FaShare, FaEdit, FaTrash, FaRegImage, FaLightbulb, FaCamera, FaHome } from "react-icons/fa";
import { Row, Col, Card, Breadcrumb } from "react-bootstrap";
import { getDefaultPhoto } from "../../utilities/photo-utils";
import PhotoModal from "../../components/PhotoModal/PhotoModal";
import PhotoUploadModal from "../../components/PhotoUploadModal/PhotoUploadModal";
import { updateDestination } from "../../utilities/destinations-api";

export default function SingleDestination() {
  const { user } = useUser();
  const { experiences, destinations, plans, fetchDestinations } = useData();
  const { registerH1, setPageActionButtons, clearActionButtons, updateShowH1InNavbar } = useApp();
  const { success, error: showError } = useToast();
  const { openExperienceWizard } = useExperienceWizard();
  const { destinationId } = useParams();
  const navigate = useNavigate();
  const [destination, setDestination] = useState(null);
  const [destinationExperiences, setDestinationExperiences] = useState([]);
  const [directDestinationExperiences, setDirectDestinationExperiences] = useState(null);
  const [visibleExperiencesCount, setVisibleExperiencesCount] = useState(6);
  const [isLoading, setIsLoading] = useState(true);
  const h1Ref = useRef(null);

  // Favorite functionality state
  const [favHover, setFavHover] = useState(false);
  const [favLoading, setFavLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [photoViewerIndex, setPhotoViewerIndex] = useState(0);
  const [showPhotoUploadModal, setShowPhotoUploadModal] = useState(false);

  /**
   * Merge helper function to update destination state without full replacement
   * Preserves unchanged data and prevents UI flashing
   * Smart merge: preserves populated arrays when incoming data is unpopulated
   */
  const mergeDestination = useCallback((updates) => {
    setDestination(prev => {
      // Explicit `null` means clear the local destination state
      if (updates === null) return null;

      // First load - use full data
      if (!prev) return updates;
      // No updates - keep existing
      if (!updates) return prev;

      // Smart merge for photos: preserve populated photos if incoming is unpopulated
      const mergedPhotos = (() => {
        if (!updates.photos) return prev.photos; // No photos in update - keep existing
        if (!prev.photos || prev.photos.length === 0) return updates.photos; // No existing photos

        // Check if incoming photos are unpopulated (just ObjectId strings)
        const isUnpopulated = updates.photos.length > 0 &&
          typeof updates.photos[0] === 'string';

        // If incoming is unpopulated but we have populated data, keep existing
        if (isUnpopulated && prev.photos.length > 0 && typeof prev.photos[0] === 'object') {
          return prev.photos;
        }

        return updates.photos;
      })();

      return { ...prev, ...updates, photos: mergedPhotos };
    });
  }, []);

  const getData = useCallback(async () => {
    try {
      setIsLoading(true);
      // Fetch destination data
      const destinationData = await showDestination(destinationId);
      // ✅ Use merge to preserve unchanged data (prevents photo/name flash)
      // If the server returns no data (deleted/missing), ensure we clear local state
      if (!destinationData) {
        mergeDestination(null);
      } else {
        mergeDestination(destinationData);
      }
      // Refresh destinations list in background
      fetchDestinations();
    } catch (error) {
      logger.error('Error fetching destination', { destinationId, error: error.message });
      // If fetch fails (404 or network), clear local destination to avoid showing stale data
      mergeDestination(null);
    } finally {
      setIsLoading(false);
    }
  }, [destinationId, fetchDestinations, mergeDestination]);

  // Handle favorite/unfavorite destination with optimistic UI
  const handleFavorite = useCallback(async () => {
    if (favLoading) return;

    // Store previous state for error recovery
    const previousState = {
      isFavorite: destination.users_favorite?.includes(user._id),
      usersFavorite: [...(destination.users_favorite || [])]
    };

    setFavLoading(true);

    try {
      // Optimistic update: Update local state immediately
      const updatedUsersFavorite = previousState.isFavorite
        ? destination.users_favorite.filter(id => id !== user._id) // Remove user
        : [...destination.users_favorite, user._id]; // Add user

      setDestination(prev => ({
        ...prev,
        users_favorite: updatedUsersFavorite
      }));

      // Make API call
      await toggleUserFavoriteDestination(destination._id, user._id);

      // Update DataContext without full refresh
      if (typeof mergeDestination === 'function') {
        mergeDestination({
          _id: destination._id,
          users_favorite: updatedUsersFavorite
        });
      }
    } catch (error) {
      logger.error('Failed to toggle favorite', { destinationId: destination._id, error: error.message });

      // Rollback to previous state on error
      setDestination(prev => ({
        ...prev,
        users_favorite: previousState.usersFavorite
      }));
    } finally {
      setFavLoading(false);
    }
  }, [favLoading, destination, user, mergeDestination]);

  // Handle delete destination
  const handleDeleteDestination = useCallback(async () => {
    try {
      await deleteDestination(destinationId);
      setShowDeleteModal(false);
      // Navigate to destinations list after successful delete
      navigate('/destinations');
    } catch (error) {
      logger.error('Failed to delete destination', { destinationId, error: error.message });
    }
  }, [destinationId, navigate]);

  // Update local state when global destinations or experiences change
  useEffect(() => {
    const foundDestination = destinations.find((dest) => dest._id === destinationId);
    // If DataContext has the destination, merge/update local state.
    // Do NOT clear local state when it's missing from the global `destinations`
    // (global lists may be paginated and not include this item). Only update
    // when we actually have a populated destination object to merge.
    if (foundDestination) {
      // ✅ Use merge to preserve unchanged data (prevents flash on context update)
      mergeDestination(foundDestination);
    }
  }, [destinations, destinationId, mergeDestination]);

  // Listen for explicit destination deletion events and clear local view
  useEffect(() => {
    const handleDestinationDeleted = (event) => {
      const destinationIdFromEvent = event.destinationId || event.detail?.destinationId;
      if (destinationIdFromEvent && String(destinationIdFromEvent) === String(destinationId)) {
        // Destination deleted -> clear local state so Error / Not Found shows
        mergeDestination(null);
      }
    };

    const unsubscribe = eventBus.subscribe('destination:deleted', handleDestinationDeleted);
    return () => unsubscribe();
  }, [destinationId, mergeDestination]);

  // Listen for destination update events to refresh this specific destination
  useEffect(() => {
    const handleDestinationUpdated = (event) => {
      // Event bus spreads payload at top level
      const updatedDestination = event.destination;
      if (updatedDestination && updatedDestination._id === destinationId) {
        logger.debug('[SingleDestination] Destination updated event received', { id: updatedDestination._id });
        // ✅ Use merge to preserve unchanged data (prevents flash on event update)
        mergeDestination(updatedDestination);
      }
    };

    const unsubscribe = eventBus.subscribe('destination:updated', handleDestinationUpdated);
    return () => unsubscribe();
  }, [destinationId, mergeDestination]);

  // Listen for experience events to update the destination's experience list
  useEffect(() => {
    if (!destinationId) return;

    // Helper to check if experience belongs to this destination
    const isForThisDestination = (experience) => {
      if (!experience) return false;
      const destRef = experience.destination;
      const destId = typeof destRef === 'object' && destRef !== null ? destRef._id : destRef;
      return destId && String(destId) === String(destinationId);
    };

    // Handle experience created - add to list if it's for this destination
    const handleExperienceCreated = (event) => {
      const experience = event.experience;
      if (!isForThisDestination(experience)) return;

      logger.debug('[SingleDestination] Experience created for this destination', { experienceId: experience._id });

      // Update direct experiences list
      setDirectDestinationExperiences(prev => {
        if (prev === null) return [experience];
        // Avoid duplicates
        if (prev.some(e => e._id === experience._id)) return prev;
        return [experience, ...prev];
      });

      // Update derived experiences list
      setDestinationExperiences(prev => {
        if (prev.some(e => e._id === experience._id)) return prev;
        return [experience, ...prev];
      });
    };

    // Handle experience updated - update in list if present
    const handleExperienceUpdated = (event) => {
      const experience = event.experience;
      if (!experience) return;

      // Check if experience was previously for this destination or is now
      const wasForThisDestination = destinationExperiences.some(e => e._id === experience._id) ||
                                    (directDestinationExperiences && directDestinationExperiences.some(e => e._id === experience._id));
      const nowForThisDestination = isForThisDestination(experience);

      // Experience moved away from this destination - remove it
      if (wasForThisDestination && !nowForThisDestination) {
        logger.debug('[SingleDestination] Experience moved to different destination', { experienceId: experience._id });
        setDirectDestinationExperiences(prev => prev ? prev.filter(e => e._id !== experience._id) : prev);
        setDestinationExperiences(prev => prev.filter(e => e._id !== experience._id));
        return;
      }

      // Experience moved to this destination - add it
      if (!wasForThisDestination && nowForThisDestination) {
        logger.debug('[SingleDestination] Experience moved to this destination', { experienceId: experience._id });
        setDirectDestinationExperiences(prev => {
          if (prev === null) return [experience];
          if (prev.some(e => e._id === experience._id)) return prev;
          return [experience, ...prev];
        });
        setDestinationExperiences(prev => {
          if (prev.some(e => e._id === experience._id)) return prev;
          return [experience, ...prev];
        });
        return;
      }

      // Experience updated but still for this destination - update in place
      if (nowForThisDestination) {
        logger.debug('[SingleDestination] Experience updated', { experienceId: experience._id });
        setDirectDestinationExperiences(prev => {
          if (!prev) return prev;
          const index = prev.findIndex(e => e._id === experience._id);
          if (index === -1) return prev;
          const updated = [...prev];
          updated[index] = { ...updated[index], ...experience };
          return updated;
        });
        setDestinationExperiences(prev => {
          const index = prev.findIndex(e => e._id === experience._id);
          if (index === -1) return prev;
          const updated = [...prev];
          updated[index] = { ...updated[index], ...experience };
          return updated;
        });
      }
    };

    // Handle experience deleted - remove from list
    const handleExperienceDeleted = (event) => {
      const experienceId = event.experienceId;
      if (!experienceId) return;

      logger.debug('[SingleDestination] Experience deleted event', { experienceId });

      setDirectDestinationExperiences(prev => {
        if (!prev) return prev;
        const filtered = prev.filter(e => e._id !== experienceId);
        if (filtered.length === prev.length) return prev; // No change
        return filtered;
      });

      setDestinationExperiences(prev => {
        const filtered = prev.filter(e => e._id !== experienceId);
        if (filtered.length === prev.length) return prev; // No change
        return filtered;
      });
    };

    const unsubCreate = eventBus.subscribe('experience:created', handleExperienceCreated);
    const unsubUpdate = eventBus.subscribe('experience:updated', handleExperienceUpdated);
    const unsubDelete = eventBus.subscribe('experience:deleted', handleExperienceDeleted);

    return () => {
      unsubCreate();
      unsubUpdate();
      unsubDelete();
    };
  }, [destinationId, destinationExperiences, directDestinationExperiences]);

  useEffect(() => {
    const filteredExperiences = experiences.filter((experience) => {
      // destination may be an ObjectId string or a populated object
      const destRef = experience?.destination;
      const destId = typeof destRef === 'object' && destRef !== null ? destRef._id : destRef;
      return destId && String(destId) === String(destinationId);
    });
    // Only update the derived destinationExperiences when no direct server
    // response is present. Direct server responses take precedence to avoid
    // being overwritten by timing of global DataContext updates.
    if (directDestinationExperiences === null) {
      setDestinationExperiences(filteredExperiences);
    }
  }, [experiences, destinationId]);

  // Initial data fetch when destinationId changes
  useEffect(() => {
    getData();
  }, [getData]);

  // Ensure experiences for this destination are loaded into local state
  useEffect(() => {
    if (!destinationId) return;
    try {
      // Fetch experiences directly for this view (server-side filter via query params)
      // Reset directDestinationExperiences and fetch
      setDirectDestinationExperiences(null);
      getExperiences({ destination: destinationId }).then((resp) => {
        const data = resp && resp.data ? resp.data : (Array.isArray(resp) ? resp : []);

        // Set local state immediately - DO NOT update DataContext
        // Updating DataContext with view-specific filtered data would pollute
        // the global state and cause other views to lose their fully-populated data
        setDirectDestinationExperiences(data);
      }).catch((err) => {
        logger.error('Failed to fetch experiences directly for destination', { destinationId, error: err?.message || err });
        setDirectDestinationExperiences([]);
      });
    } catch (err) {
      logger.error('Error fetching experiences for destination', { destinationId, error: err?.message || err });
    }
  }, [destinationId]);

  // Register h1 and action buttons for navbar
  // Re-run when destination loads so h1Ref.current is available
  useEffect(() => {
    if (h1Ref.current) {
      registerH1(h1Ref.current);
      // Enable h1 text in navbar - clicking scrolls to top
      updateShowH1InNavbar(true);
    }

    return () => {
      clearActionButtons();
      // Disable h1 in navbar when leaving this view
      updateShowH1InNavbar(false);
    };
  }, [registerH1, clearActionButtons, updateShowH1InNavbar, destination]);

  // Choose which experiences list to display: prefer direct server results when present
  // Normalize possible shapes: legacy array, or paginated { data, meta }
  // Get all experiences for this destination
  const allExperiences = (() => {
    if (directDestinationExperiences !== null) {
      if (Array.isArray(directDestinationExperiences)) return directDestinationExperiences;
      if (directDestinationExperiences && Array.isArray(directDestinationExperiences.data)) return directDestinationExperiences.data;
      // unexpected shape — coerce to empty array
      return [];
    }
    return Array.isArray(destinationExperiences) ? destinationExperiences : [];
  })();

  // Slice to show only visible experiences (for infinite scroll)
  const displayedExperiences = allExperiences.slice(0, visibleExperiencesCount);
  const hasMoreExperiences = allExperiences.length > visibleExperiencesCount;

  // Reset visible count when destination changes
  useEffect(() => {
    setVisibleExperiencesCount(6);
  }, [destinationId]);

  // Get hero image URL
  const getHeroImageUrl = () => {
    if (!destination?.photos?.length) {
      return 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80'; // Fallback
    }
    const defaultPhoto = getDefaultPhoto(destination);
    return defaultPhoto?.url || destination.photos[0]?.url;
  };

  // Normalize destination hero photos for PhotoModal
  const heroPhotos = (() => {
    const src = destination?.photos && destination.photos.length > 0 ? destination.photos : [];
    return src.map(p => (typeof p === 'string' ? { url: p } : p));
  })();

  // Show loading state
  if (isLoading) {
    return (
      <div className={styles.destinationContainer}>
        <Container>
          {/* Breadcrumb skeleton */}
          <div style={{ marginBottom: 'var(--space-4)', display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
            <SkeletonLoader variant="text" width="50px" height="16px" />
            <span style={{ color: 'var(--color-text-muted)' }}>/</span>
            <SkeletonLoader variant="text" width="90px" height="16px" />
            <span style={{ color: 'var(--color-text-muted)' }}>/</span>
            <SkeletonLoader variant="text" width="120px" height="16px" />
          </div>

          {/* Hero section skeleton */}
          <SkeletonLoader variant="rectangle" width="100%" height="450px" className={styles.skeletonHero} />

          {/* Stats bar skeleton */}
          <div style={{
            display: 'flex',
            gap: 'var(--space-6)',
            padding: 'var(--space-4) var(--space-6)',
            background: 'var(--color-bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            marginBottom: 'var(--space-6)',
            flexWrap: 'wrap'
          }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <SkeletonLoader variant="circle" width="24px" height="24px" />
                <SkeletonLoader variant="text" width="30px" height="24px" />
                <SkeletonLoader variant="text" width="70px" height="16px" />
              </div>
            ))}
          </div>

          <Row>
            {/* Main content column */}
            <Col lg={8}>
              {/* Overview card skeleton */}
              <Card className={styles.contentCard}>
                <Card.Body className={styles.contentCardBody}>
                  <SkeletonLoader variant="text" width="120px" height="28px" style={{ marginBottom: 'var(--space-4)' }} />
                  <SkeletonLoader variant="text" width="100%" height="16px" style={{ marginBottom: 'var(--space-2)' }} />
                  <SkeletonLoader variant="text" width="95%" height="16px" style={{ marginBottom: 'var(--space-2)' }} />
                  <SkeletonLoader variant="text" width="80%" height="16px" />
                </Card.Body>
              </Card>

              {/* Map card skeleton */}
              <Card className={styles.contentCard}>
                <Card.Body className={styles.contentCardBody}>
                  <SkeletonLoader variant="text" width="100px" height="28px" style={{ marginBottom: 'var(--space-4)' }} />
                  <SkeletonLoader variant="rectangle" width="100%" height="350px" style={{ borderRadius: 'var(--radius-lg)' }} />
                </Card.Body>
              </Card>

              {/* Travel tips card skeleton */}
              <Card className={styles.contentCard}>
                <Card.Body className={styles.contentCardBody}>
                  <SkeletonLoader variant="text" width="200px" height="28px" style={{ marginBottom: 'var(--space-4)' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    {[1, 2, 3].map((i) => (
                      <div key={i} style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
                        <SkeletonLoader variant="circle" width="32px" height="32px" />
                        <div style={{ flex: 1 }}>
                          <SkeletonLoader variant="text" width="80px" height="14px" style={{ marginBottom: 'var(--space-1)' }} />
                          <SkeletonLoader variant="text" width="90%" height="16px" />
                        </div>
                      </div>
                    ))}
                  </div>
                </Card.Body>
              </Card>

              {/* Experiences card skeleton */}
              <Card className={styles.contentCard}>
                <Card.Body className={styles.contentCardBody}>
                  <SkeletonLoader variant="text" width="180px" height="28px" style={{ marginBottom: 'var(--space-4)' }} />
                  <Row>
                    {[1, 2, 3, 4].map((i) => (
                      <Col md={6} key={i} style={{ marginBottom: 'var(--space-4)' }}>
                        <SkeletonLoader variant="rectangle" width="100%" height="200px" style={{ borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-3)' }} />
                        <SkeletonLoader variant="text" width="85%" height="20px" style={{ marginBottom: 'var(--space-2)' }} />
                        <SkeletonLoader variant="text" width="60%" height="14px" />
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  <SkeletonLoader variant="rectangle" width="100%" height="44px" style={{ borderRadius: 'var(--radius-full)' }} />
                  <SkeletonLoader variant="rectangle" width="100%" height="44px" style={{ borderRadius: 'var(--radius-full)' }} />
                  <SkeletonLoader variant="rectangle" width="100%" height="44px" style={{ borderRadius: 'var(--radius-full)' }} />
                </div>
              </div>
            </Col>
          </Row>
        </Container>
      </div>
    );
  }

  // Show error state if destination not found
  if (!destination) {
    return (
      <div className={styles.destinationContainer}>
        <Container>
          <EntityNotFound entityType="destination" />
        </Container>
      </div>
    );
  }

  // Compute favorite status
  const isUserFavorite = destination?.users_favorite?.includes(user?._id) || false;
  const favoriteCount = destination?.users_favorite?.length || 0;
  const experienceCount = allExperiences.length;

  // Format destination title
  const destinationTitle = `${destination.name}, ${!destination.state
    ? destination.country
    : destination.state === destination.name
    ? destination.country
    : destination.state}`;

  return (
    <>
      <PageOpenGraph
        title={destinationTitle}
        description={`Discover ${destination.name}, ${destination.country}. Explore popular experiences, travel tips, and plan your perfect visit to this amazing destination.${displayedExperiences.length > 0 ? ` Find ${displayedExperiences.length} curated experiences.` : ''}`}
        keywords={`${destination.name}, ${destination.country}, travel destination, tourism${destination.state ? `, ${destination.state}` : ''}, experiences, travel tips`}
        ogTitle={`${destination.name}, ${destination.country}`}
        ogDescription={`${displayedExperiences.length > 0 ? `Explore ${displayedExperiences.length} unique experiences in ${destination.name}. ` : ''}${destination.travel_tips?.length > 0 && typeof destination.travel_tips[0] === 'string' ? destination.travel_tips[0] : destination.travel_tips?.length > 0 && destination.travel_tips[0]?.value ? destination.travel_tips[0].value : `Plan your trip to ${destination.name} today.`}`}
        entity={destination}
        entityType="destination"
        schema={buildDestinationSchema(destination, window?.location?.origin || '')}
      />

      {/* Hidden h1 for screen readers */}
      <h1 ref={h1Ref} className="visually-hidden">{destinationTitle}</h1>

      <div className={styles.destinationContainer}>
        <Container>
          {/* Breadcrumb Navigation */}
          <nav className={styles.breadcrumbNav} aria-label="breadcrumb">
            <Breadcrumb>
              <Breadcrumb.Item linkAs={Link} linkProps={{ to: "/" }}>
                <FaHome size={12} style={{ marginRight: '4px' }} />
                Home
              </Breadcrumb.Item>
              <Breadcrumb.Item linkAs={Link} linkProps={{ to: "/destinations" }}>
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
            {/* Hero photo button - opens upload modal when no photos and user can edit */}
            <button
              type="button"
              className={styles.heroPhotoButton}
              onClick={() => {
                // Check if there are no photos on the destination
                const hasDestinationPhotos = destination.photos && destination.photos.length > 0;
                // Check if user can edit (owner or collaborator)
                const canEdit = destination.permissions?.some(p =>
                  p.entity === 'user' &&
                  (p.type === 'owner' || p.type === 'collaborator') &&
                  p._id?.toString() === user?._id?.toString()
                );

                if (!hasDestinationPhotos && canEdit) {
                  // No photos and user can edit - open upload modal
                  setShowPhotoUploadModal(true);
                } else {
                  // Has photos or user can't edit - open photo viewer
                  setPhotoViewerIndex(0);
                  setShowPhotoViewer(true);
                }
              }}
              aria-label={heroPhotos.length > 0 ? `View ${heroPhotos.length} photo${heroPhotos.length !== 1 ? 's' : ''}` : "Add photos"}
            >
              <FaRegImage />
              {heroPhotos.length > 0 && (
                <span className={styles.photoCount}>{heroPhotos.length}</span>
              )}
            </button>
          </div>

          {/* Stats Bar */}
          <div className={styles.statsBar}>
            <button
              type="button"
              className={`${styles.statItem} ${styles.statItemClickable}`}
              onClick={() => {
                const el = document.getElementById('experiences-section');
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              aria-label={`View ${experienceCount} ${experienceCount === 1 ? 'experience' : 'experiences'}`}
            >
              <FaPlane className={styles.statIcon} />
              <span className={styles.statValue}>{experienceCount}</span>
              <span className={styles.statLabel}>{experienceCount === 1 ? 'Experience' : 'Experiences'}</span>
            </button>
            <div className={styles.statItem}>
              <FaHeart className={styles.statIcon} />
              <span className={styles.statValue}>{favoriteCount}</span>
              <span className={styles.statLabel}>{favoriteCount === 1 ? 'Favorite' : 'Favorites'}</span>
            </div>
            {destination.travel_tips?.length > 0 && (
              <button
                type="button"
                className={`${styles.statItem} ${styles.statItemClickable}`}
                onClick={() => {
                  const el = document.getElementById('travel-tips-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                aria-label={`View ${destination.travel_tips.length} ${destination.travel_tips.length === 1 ? 'travel tip' : 'travel tips'}`}
              >
                <FaLightbulb className={styles.statIcon} />
                <span className={styles.statValue}>{destination.travel_tips.length}</span>
                <span className={styles.statLabel}>{destination.travel_tips.length === 1 ? 'Travel Tip' : 'Travel Tips'}</span>
              </button>
            )}
            {heroPhotos.length > 0 && (
              <button
                type="button"
                className={`${styles.statItem} ${styles.statItemClickable}`}
                onClick={() => {
                  setPhotoViewerIndex(0);
                  setShowPhotoViewer(true);
                }}
                aria-label={`View ${heroPhotos.length} ${heroPhotos.length === 1 ? 'photo' : 'photos'}`}
              >
                <FaCamera className={styles.statIcon} />
                <span className={styles.statValue}>{heroPhotos.length}</span>
                <span className={styles.statLabel}>{heroPhotos.length === 1 ? 'Photo' : 'Photos'}</span>
              </button>
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

              {/* Map Section */}
              <Card className={styles.contentCard}>
                <Card.Body className={styles.contentCardBody}>
                  <h3 className={styles.sectionTitle}>
                    <FaMapMarkerAlt style={{ marginRight: '8px' }} />
                    Location
                  </h3>
                  <GoogleMap
                    location={destination.map_location || `${destination.name}, ${destination.state ? destination.state + ', ' : ''}${destination.country}`}
                    height={350}
                    title={`Map of ${destination.name}`}
                    className={styles.destinationMap}
                  />
                </Card.Body>
              </Card>

              {/* Travel Tips Section */}
              {destination.travel_tips?.length > 0 && (
                <Card className={styles.contentCard}>
                  <Card.Body className={styles.contentCardBody}>
                    <h3 id="travel-tips-section" className={styles.sectionTitle}>
                      <span className={styles.sectionIcon} aria-hidden="true">💡</span>
                      Travel Tips
                    </h3>
                    <TravelTipsList tips={destination.travel_tips} hideHeading />
                  </Card.Body>
                </Card>
              )}

              {/* Popular Experiences Section */}
              <Card className={styles.contentCard}>
                <Card.Body className={styles.contentCardBody}>
                  <DestinationExperienceGrid
                    experiences={allExperiences}
                    destinationName={destination.name}
                    destinationId={destinationId}
                    destinationCountry={destination.country}
                    visibleCount={visibleExperiencesCount}
                    hasMore={hasMoreExperiences}
                    onLoadMore={() => setVisibleExperiencesCount((prev) => prev + 6)}
                    isLoading={isLoading}
                    userPlans={plans}
                    onOptimisticDelete={(id) => {
                      // Remove the experience from directDestinationExperiences immediately
                      setDirectDestinationExperiences((prev) => {
                        if (!prev) return prev;
                        return prev.filter((e) => {
                          const eid = e?._id || e;
                          return String(eid) !== String(id);
                        });
                      });
                    }}
                    onAddExperience={() => openExperienceWizard({ destinationId, destinationName: `${destination?.name}, ${destination?.country}` })}
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
                    variant={isUserFavorite ? (favHover ? "danger" : "outline") : "gradient"}
                    rounded
                    fullWidth
                    onClick={handleFavorite}
                    disabled={favLoading || !user}
                    onMouseEnter={() => setFavHover(true)}
                    onMouseLeave={() => setFavHover(false)}
                  >
                    {favLoading ? (
                      <span className={styles.buttonSpinner} aria-label="Loading" />
                    ) : (
                      isUserFavorite
                        ? (favHover ? lang.current.button.removeFavoriteDest : lang.current.button.favorited)
                        : lang.current.button.addFavoriteDest
                    )}
                  </Button>

                  {/* Share Button */}
                  <Button
                    variant="outline"
                    rounded
                    fullWidth
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({
                          title: destinationTitle,
                          url: window.location.href
                        });
                      } else {
                        navigator.clipboard.writeText(window.location.href);
                      }
                    }}
                  >
                    <FaShare style={{ marginRight: '8px' }} /> Share Destination
                  </Button>

                  {/* Owner Actions */}
                  {user && isOwner(user, destination) && (
                    <>
                      <Button
                        variant="outline"
                        rounded
                        fullWidth
                        onClick={() => navigate(`/destinations/${destinationId}/update`)}
                      >
                        <FaEdit style={{ marginRight: '8px' }} /> Edit Destination
                      </Button>
                      <Button
                        variant="danger"
                        rounded
                        fullWidth
                        onClick={() => setShowDeleteModal(true)}
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

      {/* Delete Destination Confirmation Modal */}
      {showPhotoViewer && (
        <PhotoModal photos={heroPhotos} initialIndex={photoViewerIndex} onClose={() => setShowPhotoViewer(false)} />
      )}
      <ConfirmModal
        show={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteDestination}
        title="Delete Destination?"
        message="You are about to permanently delete"
        itemName={destination?.name}
        additionalInfo={[
          "All associated experiences",
          "Photos and media",
          "Travel tips"
        ]}
        confirmText="Delete Permanently"
        confirmVariant="danger"
      />

      {/* Photo Upload Modal - for adding photos when destination has none */}
      <PhotoUploadModal
        show={showPhotoUploadModal}
        onClose={() => setShowPhotoUploadModal(false)}
        entityType="destination"
        entity={destination}
        photos={destination?.photos_full || destination?.photos || []}
        onSave={async (data) => {
          try {
            // Extract photo IDs for API
            const photoIds = Array.isArray(data.photos)
              ? data.photos.map(p => (typeof p === 'object' ? p._id : p))
              : [];

            // Update destination with new photos
            const updated = await updateDestination(destination._id, {
              photos: photoIds,
              default_photo_id: data.default_photo_id
            });

            // Update local destination state using mergeDestination
            // Use photos_full (full objects with URLs) for immediate display
            if (updated) {
              const fullPhotos = data.photos_full || [];
              mergeDestination({
                // Use full photo objects for display (they have .url)
                photos: fullPhotos.length > 0 ? fullPhotos : (updated.photos || photoIds),
                photos_full: fullPhotos,
                default_photo_id: data.default_photo_id || updated.default_photo_id
              });

              // Refresh destinations in context if available
              if (fetchDestinations) {
                fetchDestinations();
              }

              success('Photos updated successfully');
            }
          } catch (err) {
            logger.error('[SingleDestination] Failed to save photos', { error: err.message });
            showError(err.message || 'Failed to save photos');
            throw err; // Re-throw to let modal handle error state
          }
        }}
      />
    </>
  );
}

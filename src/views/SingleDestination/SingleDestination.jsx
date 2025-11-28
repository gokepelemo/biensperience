import styles from "./SingleDestination.module.scss";
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { showDestination } from "../../utilities/destinations-api";
import { useUser } from "../../contexts/UserContext";
import { useData } from "../../contexts/DataContext";
import { useApp } from "../../contexts/AppContext";
import GoogleMap from "../../components/GoogleMap/GoogleMap";
import ExperienceCard from "../../components/ExperienceCard/ExperienceCard";
import TravelTipsList from "../../components/TravelTipsList/TravelTipsList";
import { logger } from "../../utilities/logger";
import { getExperiences } from "../../utilities/experiences-api";
import Alert from "../../components/Alert/Alert";
import { lang } from "../../lang.constants";
import PageOpenGraph from "../../components/OpenGraph/PageOpenGraph";
import { isOwner } from "../../utilities/permissions";
import { Container, Button, SkeletonLoader } from "../../components/design-system";
import Loading from "../../components/Loading/Loading";
import { toggleUserFavoriteDestination, deleteDestination } from "../../utilities/destinations-api";
import ConfirmModal from "../../components/ConfirmModal/ConfirmModal";
import { FaMapMarkerAlt, FaHeart, FaPlane, FaShare, FaEdit, FaTrash } from "react-icons/fa";
import { Row, Col, Card } from "react-bootstrap";
import { getDefaultPhoto } from "../../utilities/photo-utils";

export default function SingleDestination() {
  const { user } = useUser();
  const { experiences, destinations, plans, fetchDestinations } = useData();
  const { registerH1, setPageActionButtons, clearActionButtons, updateShowH1InNavbar } = useApp();
  const { destinationId } = useParams();
  const navigate = useNavigate();
  const [destination, setDestination] = useState(null);
  const [destinationExperiences, setDestinationExperiences] = useState([]);
  const [directDestinationExperiences, setDirectDestinationExperiences] = useState(null);
  const [visibleExperiencesCount, setVisibleExperiencesCount] = useState(6);
  const [isLoading, setIsLoading] = useState(true);
  const h1Ref = useRef(null);
  const loadMoreRef = useRef(null);

  // Favorite functionality state
  const [favHover, setFavHover] = useState(false);
  const [favLoading, setFavLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  /**
   * Merge helper function to update destination state without full replacement
   * Preserves unchanged data and prevents UI flashing
   */
  const mergeDestination = useCallback((updates) => {
    setDestination(prev => {
      if (!prev) return updates; // First load - use full data
      if (!updates) return prev; // No updates - keep existing
      return { ...prev, ...updates }; // Merge - preserve unchanged data
    });
  }, []);

  const getData = useCallback(async () => {
    try {
      setIsLoading(true);
      // Fetch destination data
      const destinationData = await showDestination(destinationId);
      // ✅ Use merge to preserve unchanged data (prevents photo/name flash)
      mergeDestination(destinationData);
      // Refresh destinations list in background
      fetchDestinations();
    } catch (error) {
      logger.error('Error fetching destination', { destinationId, error: error.message });
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
    if (foundDestination) {
      // ✅ Use merge to preserve unchanged data (prevents flash on context update)
      mergeDestination(foundDestination);
    }
  }, [destinations, destinationId, mergeDestination]);

  // Listen for destination update events to refresh this specific destination
  useEffect(() => {
    const handleDestinationUpdated = (event) => {
      const { destination: updatedDestination } = event.detail || {};
      if (updatedDestination && updatedDestination._id === destinationId) {
        logger.debug('[SingleDestination] Destination updated event received', { id: updatedDestination._id });
        // ✅ Use merge to preserve unchanged data (prevents flash on event update)
        mergeDestination(updatedDestination);
      }
    };

    window.addEventListener('destination:updated', handleDestinationUpdated);
    return () => {
      window.removeEventListener('destination:updated', handleDestinationUpdated);
    };
  }, [destinationId, mergeDestination]);

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

  // Register h1 and action buttons (hidden h1 for screen readers)
  useEffect(() => {
    if (h1Ref.current) {
      registerH1(h1Ref.current);
      // Hide h1 in navbar for this view (title is in hero)
      updateShowH1InNavbar(false);
    }

    return () => {
      clearActionButtons();
      updateShowH1InNavbar(false);
    };
  }, [registerH1, clearActionButtons, updateShowH1InNavbar]);

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

  // Infinite scroll: load more experiences when sentinel comes into view
  useEffect(() => {
    if (!loadMoreRef.current || !hasMoreExperiences) return;

    const currentRef = loadMoreRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          // Load 6 more experiences
          setVisibleExperiencesCount((prev) => prev + 6);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(currentRef);

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [hasMoreExperiences]);

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

  // Show loading state
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

  // Show error state if destination not found
  if (!destination) {
    return (
      <div className={styles.destinationContainer}>
        <Container>
          <Alert type="warning" title="Destination Not Found">
            <p>The destination you're looking for doesn't exist or has been removed.</p>
            <hr />
            <p className="mb-0">
              <Link to="/destinations" className="alert-link">Browse all destinations</Link>
            </p>
          </Alert>
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
      />

      {/* Hidden h1 for screen readers */}
      <h1 ref={h1Ref} className="visually-hidden">{destinationTitle}</h1>

      <div className={styles.destinationContainer}>
        <Container>
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
                <span><FaHeart /> {favoriteCount} {favoriteCount === 1 ? 'favorite' : 'favorites'}</span>
                <span><FaPlane /> {experienceCount} {experienceCount === 1 ? 'experience' : 'experiences'}</span>
              </div>
            </div>
          </div>

          {/* Content Grid */}
          <Row>
            {/* Main Content Column */}
            <Col lg={8}>
              {/* About Section */}
              {destination.description && (
                <Card className={styles.contentCard}>
                  <Card.Body className={styles.contentCardBody}>
                    <h3 className={styles.sectionTitle}>About This Destination</h3>
                    <p className={styles.sectionText}>{destination.description}</p>
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
                  <h3 className={styles.sectionTitle}>
                    {lang.en.heading.experiencesIn.replace('{destinationName}', destination.name)}
                  </h3>
                  {displayedExperiences.length > 0 ? (
                    <>
                      <Row className="justify-content-center">
                        {displayedExperiences.map((experience, index) => (
                          experience ? (
                            <Col md={6} key={experience._id || index} className="d-flex justify-content-center" style={{ marginBottom: 'var(--space-4)' }}>
                              <ExperienceCard
                                experience={experience}
                                userPlans={plans}
                                forcePreload={true}
                              />
                            </Col>
                          ) : (
                            <Col md={6} key={`placeholder-${index}`} className="d-flex justify-content-center" style={{ marginBottom: 'var(--space-4)' }}>
                              <SkeletonLoader variant="rectangle" width="100%" height="280px" />
                            </Col>
                          )
                        ))}
                      </Row>
                      {/* Infinite scroll sentinel - loads more when visible */}
                      {hasMoreExperiences && (
                        <div
                          ref={loadMoreRef}
                          style={{
                            height: '20px',
                            width: '100%',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            padding: '2rem 0'
                          }}
                        >
                          <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
                            Loading more experiences...
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <Alert
                      type="info"
                      className="alert-centered"
                      message={lang.en.alert.noExperiencesInDestination}
                      actions={
                        <Link to="/experiences/new">
                          <Button variant="gradient" size="md">
                            Add Experience
                          </Button>
                        </Link>
                      }
                    />
                  )}
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
                    variant={isUserFavorite ? "outline" : "gradient"}
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
                        ? (favHover ? lang.en.button.removeFavoriteDest : lang.en.button.favorited)
                        : lang.en.button.addFavoriteDest
                    )}
                  </Button>

                  {/* Share Button */}
                  <Button
                    variant="outline-secondary"
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
                        variant="outline-secondary"
                        rounded
                        fullWidth
                        onClick={() => navigate(`/destinations/${destinationId}/update`)}
                      >
                        <FaEdit style={{ marginRight: '8px' }} /> Edit Destination
                      </Button>
                      <Button
                        variant="outline-danger"
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
    </>
  );
}

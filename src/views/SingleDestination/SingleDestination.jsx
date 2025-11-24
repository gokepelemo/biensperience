import styles from "./SingleDestination.module.scss";
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { showDestination } from "../../utilities/destinations-api";
import { useUser } from "../../contexts/UserContext";
import { useData } from "../../contexts/DataContext";
import { useApp } from "../../contexts/AppContext";
import PhotoCard from "../../components/PhotoCard/PhotoCard";
import ExperienceCard from "../../components/ExperienceCard/ExperienceCard";
import FavoriteDestination from "../../components/FavoriteDestination/FavoriteDestination";
import TravelTipsList from "../../components/TravelTipsList/TravelTipsList";
import InfoCard from "../../components/InfoCard/InfoCard";
import { logger } from "../../utilities/logger";
import { getExperiences } from "../../utilities/experiences-api";
import Alert from "../../components/Alert/Alert";
import { lang } from "../../lang.constants";
import PageOpenGraph from "../../components/OpenGraph/PageOpenGraph";
import { isOwner } from "../../utilities/permissions";
import { Container, Button, SkeletonLoader } from "../../components/design-system";
import Loading from "../../components/Loading/Loading";
import ActionButtonsRow from "./components/ActionButtonsRow";
import { toggleUserFavoriteDestination } from "../../utilities/destinations-api";

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

  // Register h1 and action buttons
  useEffect(() => {
    if (h1Ref.current) {
      registerH1(h1Ref.current);

      // Enable h1 text in navbar for this view
      updateShowH1InNavbar(true);

      // Set up action buttons if user is owner or super admin
      if (user && destination && isOwner(user, destination)) {
        setPageActionButtons([
          {
            label: lang.en.button.edit,
            onClick: () => navigate(`/destinations/${destination._id}/update`),
            variant: 'outline-primary',
            icon: '✏️',
            tooltip: 'Edit Destination'
          }
        ]);
      }
    }

    return () => {
      clearActionButtons();
      updateShowH1InNavbar(false);
    };
  }, [registerH1, setPageActionButtons, clearActionButtons, updateShowH1InNavbar, user, destination, navigate]);

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



  // Show loading state
  if (isLoading) {
    return (
      <div className="container my-5">
        <div className="row">
          <div className="col-12 text-center mb-4">
            <SkeletonLoader variant="text" width="60%" height="48px" style={{ margin: '0 auto' }} />
          </div>
        </div>
        <div className="row">
          <div className="col-md-6 p-3">
            <SkeletonLoader variant="rectangle" width="100%" height="400px" />
          </div>
          <div className="col-md-6 p-3">
            <SkeletonLoader variant="rectangle" width="100%" height="400px" />
          </div>
        </div>
        <div className="row my-4">
          <div className="col-12">
            <SkeletonLoader variant="text" width="40%" height="32px" />
            <div className="mt-3">
              <SkeletonLoader variant="text" lines={3} />
            </div>
          </div>
        </div>
        <div className="row my-4">
          <div className="col-12">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
              <SkeletonLoader variant="rectangle" width="100%" height="300px" />
              <SkeletonLoader variant="rectangle" width="100%" height="300px" />
              <SkeletonLoader variant="rectangle" width="100%" height="300px" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show error state if destination not found
  if (!destination) {
    return (
      <div className="container my-5">
        <Alert type="warning" title="Destination Not Found">
          <p>The destination you're looking for doesn't exist or has been removed.</p>
          <hr />
          <p className="mb-0">
            <Link to="/destinations" className="alert-link">Browse all destinations</Link>
          </p>
        </Alert>
      </div>
    );
  }

  // Compute favorite status
  const isUserFavorite = destination?.users_favorite?.includes(user?._id) || false;

  return (
    <>
      <PageOpenGraph
        title={`${destination.name}, ${!destination.state ? destination.country : destination.state === destination.name ? destination.country : destination.state}`}
        description={`Discover ${destination.name}, ${destination.country}. Explore popular experiences, travel tips, and plan your perfect visit to this amazing destination.${displayedExperiences.length > 0 ? ` Find ${displayedExperiences.length} curated experiences.` : ''}`}
        keywords={`${destination.name}, ${destination.country}, travel destination, tourism${destination.state ? `, ${destination.state}` : ''}, experiences, travel tips`}
        ogTitle={`${destination.name}, ${destination.country}`}
        ogDescription={`${displayedExperiences.length > 0 ? `Explore ${displayedExperiences.length} unique experiences in ${destination.name}. ` : ''}${destination.travel_tips?.length > 0 && typeof destination.travel_tips[0] === 'string' ? destination.travel_tips[0] : destination.travel_tips?.length > 0 && destination.travel_tips[0]?.value ? destination.travel_tips[0].value : `Plan your trip to ${destination.name} today.`}`}
        entity={destination}
        entityType="destination"
      />
            <div className={`${styles.singleDestinationHeader}`}>
              {/* Title row - full width, centered on mobile/tablet */}
              <div className="row">
                <div className="col-12 text-center text-md-start">
                  <h1 ref={h1Ref} className="my-4">
                    {destination.name},{" "}
                    {!destination.state
                      ? destination.country
                      : destination.state === destination.name
                      ? destination.country
                      : destination.state}
                  </h1>
                </div>
              </div>

              {/* Description and action buttons row */}
              <div className="row align-items-center">
                {/* Description column */}
                <div className="col-md-6 mb-3 mb-md-0 d-flex align-items-center">
                  <div>
                    {destination.description && (
                      <p className="mb-0">{destination.description}</p>
                    )}
                  </div>
                </div>

                {/* Action buttons column - right-aligned on desktop, centered on mobile */}
                <div className="col-md-6 d-flex align-items-center justify-content-center justify-content-md-end">
                  <ActionButtonsRow
                    user={user}
                    destination={destination}
                    destinationId={destinationId}
                    isUserFavorite={isUserFavorite}
                    loading={favLoading}
                    favHover={favHover}
                    setFavHover={setFavHover}
                    handleFavorite={handleFavorite}
                    setShowDeleteModal={setShowDeleteModal}
                    lang={lang}
                  />
                </div>
              </div>
            </div>
            <div className="row my-4">
              <div className="col-md-6 p-3">
                {/* Display all photos with PhotoCard - it handles thumbnails automatically */}
                <PhotoCard 
                  photos={destination.photos} 
                  defaultPhotoId={destination.default_photo_id}
                  altText={destination.name}
                />
              </div>
              <div className="col-md-6 p-3">
                <InfoCard
                  title={destination.country ? `${lang.en.label.country}: ${destination.country}` : null}
                  sections={[
                    displayedExperiences.length > 0 ? {
                      title: lang.en.heading.popularExperiences,
                      content: displayedExperiences
                        .filter((experience, index) => index < 3)
                        .map((experience, index) => (
                          <Link
                            to={`/experiences/${experience._id}`}
                            className="info-card-link"
                            key={index}
                          >
                            {experience.name}
                          </Link>
                        ))
                    } : null
                  ].filter(Boolean)}
                />
              </div>
            </div>

            {/* Enhanced Travel Tips with Schema.org markup - Full Width Card */}
            {destination.travel_tips?.length > 0 && (
              <div className="row my-4">
                <div className="col-12 p-3">
                  <div className={`${styles.destinationDetailCard} ${styles.travelTipsCard}`}>
                    <TravelTipsList tips={destination.travel_tips} />
                  </div>
                </div>
              </div>
            )}

            <div className="row my-2 p-3 d-flex align-items-center justify-content-center">
              <h2 className="experiencesHeading mb-5">
                {lang.en.heading.experiencesIn.replace('{destinationName}', destination.name)}
              </h2>
              {displayedExperiences.length > 0 ? (
                <>
                  {displayedExperiences.map((experience, index) => (
                    <ExperienceCard
                      key={index}
                      experience={experience}
                      userPlans={plans}
                    />
                  ))}
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
            </div>
    </>
  );
}

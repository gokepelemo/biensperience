import "./SingleDestination.css";
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
import { Container, Mobile, Desktop } from "../../components/design-system";

export default function SingleDestination() {
  const { user } = useUser();
  const { experiences, destinations, plans, fetchDestinations, setExperiencesImmediate } = useData();
  const { registerH1, setPageActionButtons, clearActionButtons, updateShowH1InNavbar } = useApp();
  const { destinationId } = useParams();
  const navigate = useNavigate();
  const [destination, setDestination] = useState(null);
  const [destinationExperiences, setDestinationExperiences] = useState([]);
  const [directDestinationExperiences, setDirectDestinationExperiences] = useState(null);
  const h1Ref = useRef(null);

  const getData = useCallback(async () => {
    try {
      // Fetch destination data
      const destinationData = await showDestination(destinationId);
      setDestination(destinationData);
      // Refresh destinations list in background
      fetchDestinations();
    } catch (error) {
      logger.error('Error fetching destination', { destinationId, error: error.message });
    }
  }, [destinationId, fetchDestinations]);

  // Update local state when global destinations or experiences change
  useEffect(() => {
    const foundDestination = destinations.find((dest) => dest._id === destinationId);
    if (foundDestination) {
      setDestination(foundDestination);
    }
  }, [destinations, destinationId]);

  // Listen for destination update events to refresh this specific destination
  useEffect(() => {
    const handleDestinationUpdated = (event) => {
      const { destination: updatedDestination } = event.detail || {};
      if (updatedDestination && updatedDestination._id === destinationId) {
        logger.debug('[SingleDestination] Destination updated event received', { id: updatedDestination._id });
        setDestination(updatedDestination);
      }
    };

    window.addEventListener('destination:updated', handleDestinationUpdated);
    return () => {
      window.removeEventListener('destination:updated', handleDestinationUpdated);
    };
  }, [destinationId]);

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

  // Ensure experiences for this destination are loaded into DataContext
  useEffect(() => {
    if (!destinationId) return;
    try {
      // Fetch experiences directly for this view (server-side filter via query params)
      // Reset directDestinationExperiences and fetch
      setDirectDestinationExperiences(null);
      getExperiences({ destination: destinationId }).then((resp) => {
        const data = resp && resp.data ? resp.data : (Array.isArray(resp) ? resp : []);
        const meta = resp && resp.meta ? resp.meta : null;

        // Set local state immediately
        setDirectDestinationExperiences(data);

        // Update DataContext with stale-while-revalidate pattern
        // Shows destination-scoped experiences immediately, but marks them as temporary
        // with a special filter flag so other views know this is destination-specific data
        setExperiencesImmediate(data, {
          meta,
          filters: { destination: destinationId, __viewSpecific: 'SingleDestination' },
          backgroundRefresh: false // Don't refresh - this is intentionally destination-scoped
        });
      }).catch((err) => {
        logger.error('Failed to fetch experiences directly for destination', { destinationId, error: err?.message || err });
        setDirectDestinationExperiences([]);
      });
    } catch (err) {
      logger.error('Error fetching experiences for destination', { destinationId, error: err?.message || err });
    }
  }, [destinationId, setExperiencesImmediate]);

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
  const displayedExperiences = (() => {
    if (directDestinationExperiences !== null) {
      if (Array.isArray(directDestinationExperiences)) return directDestinationExperiences;
      if (directDestinationExperiences && Array.isArray(directDestinationExperiences.data)) return directDestinationExperiences.data;
      // unexpected shape — coerce to empty array
      return [];
    }
    return Array.isArray(destinationExperiences) ? destinationExperiences : [];
  })();



  return (
    <>
      {destination && (
        <PageOpenGraph
          title={`${destination.name}, ${!destination.state ? destination.country : destination.state === destination.name ? destination.country : destination.state}`}
          description={`Discover ${destination.name}, ${destination.country}. Explore popular experiences, travel tips, and plan your perfect visit to this amazing destination.${displayedExperiences.length > 0 ? ` Find ${displayedExperiences.length} curated experiences.` : ''}`}
          keywords={`${destination.name}, ${destination.country}, travel destination, tourism${destination.state ? `, ${destination.state}` : ''}, experiences, travel tips`}
          ogTitle={`${destination.name}, ${destination.country}`}
          ogDescription={`${displayedExperiences.length > 0 ? `Explore ${displayedExperiences.length} unique experiences in ${destination.name}. ` : ''}${destination.travel_tips?.length > 0 && typeof destination.travel_tips[0] === 'string' ? destination.travel_tips[0] : destination.travel_tips?.length > 0 && destination.travel_tips[0]?.value ? destination.travel_tips[0].value : `Plan your trip to ${destination.name} today.`}`}
          entity={destination}
          entityType="destination"
        />
      )}
      <>
        {destination && (
          <>
            <div className="row align-items-center single-destination-header">
              <div className="col-md-6">
                <Mobile>
                  <div style={{ textAlign: 'center' }}>
                    <h1 ref={h1Ref} className="my-4 h">
                      {destination.name},{" "}
                      {!destination.state
                        ? destination.country
                        : destination.state === destination.name
                        ? destination.country
                        : destination.state}
                    </h1>
                  </div>
                </Mobile>
                <Desktop>
                  <div style={{ textAlign: 'start' }}>
                    <h1 ref={h1Ref} className="my-4 h">
                      {destination.name},{" "}
                      {!destination.state
                        ? destination.country
                        : destination.state === destination.name
                        ? destination.country
                        : destination.state}
                    </h1>
                  </div>
                </Desktop>
              </div>
              <div className="d-flex col-md-6 justify-content-center justify-content-md-end align-items-center gap-3">
                {user && <FavoriteDestination destination={destination} user={user} getData={getData} />}
                {user && isOwner(user, destination) && (
                  <button
                    className="btn btn-icon my-4"
                    onClick={() => navigate(`/destinations/${destination._id}/update`)}
                    aria-label={lang.en.aria.editDestination}
                    title={lang.en.aria.editDestination}
                  >
                    ✏️
                  </button>
                )}
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
                  <div className="destination-detail-card travel-tips-card">
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
                displayedExperiences.map((experience, index) => (
                  <ExperienceCard
                    key={index}
                    experience={experience}
                    userPlans={plans}
                  />
                ))
              ) : (
                <Alert type="info">
                  {lang.en.alert.noExperiencesInDestination} <Link to="/experiences/new">{lang.en.message.addOneNow}</Link>?
                </Alert>
              )}
            </div>
          </>
        )}
      </>
    </>
  );
}

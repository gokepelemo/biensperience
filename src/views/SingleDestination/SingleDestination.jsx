import "./SingleDestination.css";
import { useState, useEffect, useCallback } from "react";
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
import Alert from "../../components/Alert/Alert";
import { lang } from "../../lang.constants";
import PageMeta from "../../components/PageMeta/PageMeta";
import { isOwner } from "../../utilities/permissions";

export default function SingleDestination() {
  const { user } = useUser();
  const { experiences, destinations, plans, fetchDestinations } = useData();
  const { registerH1, setPageActionButtons, clearActionButtons, updateShowH1InNavbar } = useApp();
  const { destinationId } = useParams();
  const navigate = useNavigate();
  const [destination, setDestination] = useState(null);
  const [destinationExperiences, setDestinationExperiences] = useState([]);

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

  useEffect(() => {
    const filteredExperiences = experiences.filter(
      (experience) => experience.destination._id === destinationId
    );
    setDestinationExperiences(filteredExperiences);
  }, [experiences, destinationId]);

  // Initial data fetch when destinationId changes
  useEffect(() => {
    getData();
  }, [getData]);

  // Register h1 and action buttons
  useEffect(() => {
    const h1 = document.querySelector('h1');
    if (h1) registerH1(h1);

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

    return () => {
      clearActionButtons();
      updateShowH1InNavbar(false);
    };
  }, [registerH1, setPageActionButtons, clearActionButtons, updateShowH1InNavbar, user, destination, navigate]);



  return (
    <>
      {destination && (
        <PageMeta
          title={`${destination.name}, ${!destination.state ? destination.country : destination.state === destination.name ? destination.country : destination.state}`}
          description={`Discover ${destination.name}, ${destination.country}. Explore popular experiences, travel tips, and plan your perfect visit to this amazing destination.${destinationExperiences.length > 0 ? ` Find ${destinationExperiences.length} curated experiences.` : ''}`}
          keywords={`${destination.name}, ${destination.country}, travel destination, tourism${destination.state ? `, ${destination.state}` : ''}, experiences, travel tips`}
          ogTitle={`${destination.name}, ${destination.country}`}
          ogDescription={`${destinationExperiences.length > 0 ? `Explore ${destinationExperiences.length} unique experiences in ${destination.name}. ` : ''}${destination.travel_tips?.length > 0 && typeof destination.travel_tips[0] === 'string' ? destination.travel_tips[0] : destination.travel_tips?.length > 0 && destination.travel_tips[0]?.value ? destination.travel_tips[0].value : `Plan your trip to ${destination.name} today.`}`}
          entity={destination}
          entityType="destination"
        />
      )}
      <>
        {destination && (
          <>
            <div className="row align-items-center">
              <div className="col-md-6">
                <h1 className="my-4 h">
                  {destination.name},{" "}
                  {!destination.state
                    ? destination.country
                    : destination.state === destination.name
                    ? destination.country
                    : destination.state}
                </h1>
              </div>
              <div className="d-flex col-md-6 justify-content-center justify-content-md-end align-items-center gap-3">
                {user && <FavoriteDestination destination={destination} user={user} getData={getData} />}
                {user && isOwner(user, destination) && (
                  <button
                    className="btn btn-icon"
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
                    destinationExperiences.length > 0 ? {
                      title: lang.en.heading.popularExperiences,
                      content: destinationExperiences
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
              {destinationExperiences.length > 0 ? (
                destinationExperiences.map((experience, index) => (
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

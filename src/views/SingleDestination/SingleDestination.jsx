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
      console.error('Error fetching destination:', error);
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
          label: 'Edit',
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

  // Get the default photo to display
  const getDefaultPhoto = () => {
    if (!destination) return null;
    
    // If photos array exists and has items
    if (destination.photos && destination.photos.length > 0) {
      const defaultIndex = destination.default_photo_index || 0;
      return destination.photos[defaultIndex] || destination.photos[0];
    }
    
    // Fallback to legacy photo field
    return destination.photo;
  };

  return (
    <>
      {destination && (
        <PageMeta
          title={`${destination.name}, ${!destination.state ? destination.country : destination.state === destination.name ? destination.country : destination.state}`}
          description={`Discover ${destination.name}, ${destination.country}. Explore popular experiences, travel tips, and plan your perfect visit to this amazing destination.${destinationExperiences.length > 0 ? ` Find ${destinationExperiences.length} curated experiences.` : ''}`}
          keywords={`${destination.name}, ${destination.country}, travel destination, tourism${destination.state ? `, ${destination.state}` : ''}, experiences, travel tips`}
          ogTitle={`${destination.name}, ${destination.country}`}
          ogDescription={`${destinationExperiences.length > 0 ? `Explore ${destinationExperiences.length} unique experiences in ${destination.name}. ` : ''}${destination.travel_tips && destination.travel_tips.length > 0 ? destination.travel_tips[0] : `Plan your trip to ${destination.name} today.`}`}
          ogImage={destination.photo || '/logo.png'}
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
                    aria-label="Edit Destination"
                    title="Edit Destination"
                  >
                    ✏️
                  </button>
                )}
              </div>
            </div>
            <div className="row my-4">
              <div className="col-md-6 p-3">
                {/* Display default photo with click to enlarge (or placeholder if none available) */}
                {/* PhotoCard handles its own modal, no wrapper click needed */}
                <PhotoCard photo={getDefaultPhoto()} title={destination.name} />
                
                {/* Display additional photos in a grid */}
                {destination.photos && destination.photos.length > 1 && (
                  <div className="mt-3">
                    <h5 className="mb-3">More Photos</h5>
                    <div className="row g-2">
                      {destination.photos.map((photo, index) => {
                        // Skip the default photo since it's already shown above
                        if (index === (destination.default_photo_index || 0)) return null;
                        
                        return (
                          <div key={index} className="col-4">
                            <PhotoCard 
                              photo={photo} 
                              title={`${destination.name} - Photo ${index + 1}`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              <div className="col-md-6 p-3">
                <div className="destination-detail-card">
                  {destination.country && (
                    <div className="destination-detail-header">
                      <h4 className="destination-detail-country">
                        {`${lang.en.label.country}: ${destination.country}`}
                      </h4>
                    </div>
                  )}
                  {destinationExperiences.length > 0 && (
                    <div className="destination-detail-section">
                      <h5 className="destination-detail-section-title">
                        {lang.en.heading.popularExperiences}
                      </h5>
                      <div className="destination-detail-content">
                        {destinationExperiences
                          .filter((experience, index) => index < 3)
                          .map((experience, index) => (
                            <Link
                              to={`/experiences/${experience._id}`}
                              className="destination-detail-link"
                              key={index}
                            >
                              {experience.name}
                            </Link>
                          ))}
                      </div>
                    </div>
                  )}
                  {destination.travel_tips.length > 0 && (
                    <div className="destination-detail-section">
                      <h5 className="destination-detail-section-title">
                        {lang.en.heading.travelTips}
                      </h5>
                      <div className="destination-detail-content">
                        {destination.travel_tips.map((tip, idx) => {
                          const colonIndex = tip.indexOf(':');
                          const hasColon = colonIndex > -1;
                          const tipKey = hasColon ? tip.substring(0, colonIndex) : '';
                          const tipValue = hasColon ? tip.substring(colonIndex + 1).trim() : tip;

                          return (
                            <div className="destination-detail-tip" key={idx}>
                              {hasColon ? (
                                <>
                                  <strong className="tip-key">{tipKey}:</strong>
                                  <span className="tip-value"> {tipValue}</span>
                                </>
                              ) : (
                                <span className="tip-value">{tip}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="row my-2 p-3 d-flex align-items-center justify-content-center">
              <h2 className="experiencesHeading mb-5">
                {lang.en.heading.experiencesIn} {destination.name}
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

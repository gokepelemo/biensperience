import "./SingleDestination.css";
import { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { showDestination } from "../../utilities/destinations-api";
import PhotoCard from "../../components/PhotoCard/PhotoCard";
import PhotoModal from "../../components/PhotoModal/PhotoModal";
import ExperienceCard from "../../components/ExperienceCard/ExperienceCard";
import FavoriteDestination from "../../components/FavoriteDestination/FavoriteDestination";
import Alert from "../../components/Alert/Alert";
import { lang } from "../../lang.constants";
import PageMeta from "../../components/PageMeta/PageMeta";

export default function SingleDestination({
  experiences,
  destinations,
  user,
  setUser,
  updateData,
}) {
  const { destinationId } = useParams();
  const navigate = useNavigate();
  const [destination, setDestination] = useState(null);
  const [destinationExperiences, setDestinationExperiences] = useState([]);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);

  const getData = useCallback(async () => {
    try {
      // Fetch destination data and update global state in parallel
      const [destinationData] = await Promise.all([
        showDestination(destinationId),
        updateData()
      ]);
      setDestination(destinationData);
    } catch (error) {
      console.error('Error fetching destination:', error);
    }
  }, [destinationId, updateData]);

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

  const handlePhotoClick = (photo) => {
    setSelectedPhoto(photo);
    setShowPhotoModal(true);
  };

  const closePhotoModal = () => {
    setShowPhotoModal(false);
    setSelectedPhoto(null);
  };

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
                {user && user._id === destination.user && (
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
                <div 
                  onClick={() => getDefaultPhoto() && handlePhotoClick(getDefaultPhoto())}
                  style={{ cursor: getDefaultPhoto() ? 'pointer' : 'default' }}
                  role={getDefaultPhoto() ? "button" : undefined}
                  tabIndex={getDefaultPhoto() ? 0 : undefined}
                  onKeyPress={(e) => {
                    if (getDefaultPhoto() && (e.key === 'Enter' || e.key === ' ')) {
                      handlePhotoClick(getDefaultPhoto());
                    }
                  }}
                  aria-label={getDefaultPhoto() ? "Click to view full size photo" : undefined}
                >
                  <PhotoCard photo={getDefaultPhoto()} title={destination.name} />
                </div>
                
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
                            <div
                              className="photo-thumbnail"
                              onClick={() => handlePhotoClick(photo)}
                              style={{
                                backgroundImage: `url(${photo.url})`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                paddingTop: '100%',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                position: 'relative',
                                overflow: 'hidden'
                              }}
                              role="button"
                              tabIndex={0}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  handlePhotoClick(photo);
                                }
                              }}
                              aria-label={`View photo ${index + 1}`}
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
                    user={user}
                    setUser={setUser}
                    experience={experience}
                    updateData={updateData}
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
      
      {/* Photo Modal */}
      {showPhotoModal && selectedPhoto && (
        <PhotoModal photo={selectedPhoto} onClose={closePhotoModal} />
      )}
    </>
  );
}

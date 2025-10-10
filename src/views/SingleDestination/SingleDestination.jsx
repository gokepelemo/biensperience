import "./SingleDestination.css";
import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { showDestination } from "../../utilities/destinations-api";
import { getExperiences } from "../../utilities/experiences-api";
import PhotoCard from "../../components/PhotoCard/PhotoCard";
import ExperienceCard from "../../components/ExperienceCard/ExperienceCard";
import FavoriteDestination from "../../components/FavoriteDestination/FavoriteDestination";
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
  const [destination, setDestination] = useState(
    destinations.filter((destination) => destination._id === destinationId)[0]
  );
  const [destinationExperiences, setDestinationExperiences] = useState(
    experiences.filter(
      (experience) => experience.destination._id === destinationId
    )
  );
    const getData = useCallback(async () => {
      let destinationData = await showDestination(destinationId);
      let experienceData = await getExperiences();
      setDestination(destinationData);
      setDestinationExperiences(
        experienceData.filter(
          (experience) => experience.destination._id === destinationId
        )
      );
      updateData();
    }, [destinationId, updateData]);
    useEffect(() => {
      if (!destination || !destinationExperiences) {
        getData();
      }
    }, [destination, destinationExperiences, getData]);
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
              <div className="d-flex col-md-6 justify-content-end align-items-center">
                {user && <FavoriteDestination destination={destination} user={user} getData={getData} />}
              </div>
            </div>
            <div className="row my-4">
              <div className="col-md-6 p-3">
                {destination && <PhotoCard photo={destination.photo} title={destination.name} />}
              </div>
              <div className="col-md-6 p-3">
                <div className="destination-detail-card">
                  {destination.country && (
                    <div className="destination-detail-header">
                      <h4 className="destination-detail-country">
                        {`${lang.en.label.country} ${destination.country}`}
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
                <p className="alert alert-info">
                  {lang.en.alert.noExperiencesInDestination}
                  <Link to="/experiences/new">{lang.en.message.addOneNow}</Link>?
                </p>
              )}
            </div>
          </>
        )}
      </>
    </>
  );
}

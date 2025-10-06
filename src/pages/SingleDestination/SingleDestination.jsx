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
            <div className="row">
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
              <div className="d-flex col-md-6 justify-content-end">
                <FavoriteDestination destination={destination} user={user} getData={getData} />
              </div>
            </div>
            <div className="row my-4">
              <div className="col-md-6 p-3">
                {destination && <PhotoCard photo={destination.photo} title={destination.name} />}
              </div>
              <div className="col-md-6 p-3">
                <ul className="list-group destination-detail">
                  {destination.country ? (
                    <li className="list-group-item list-group-item-secondary fw-bold text-center h4">
                      {`${lang.en.label.country} ${destination.country}`}
                    </li>
                  ) : (
                    ""
                  )}
                  {destinationExperiences.length > 0 && (
                    <>
                      <li className="list-group-item list-group-item-secondary fw-bold text-center h5">
                        {lang.en.heading.popularExperiences}
                      </li>
                      <li className="list-group-item list-group-item-secondary">
                        {destinationExperiences
                          .filter((experience, index) => index < 3)
                          .map((experience, index) => (
                            <p className="popularExperiences" key={index}>
                              <Link to={`/experiences/${experience._id}`}>
                                {experience.name}
                              </Link>
                            </p>
                          ))}
                      </li>
                    </>
                  )}
                  {destination.travel_tips.length > 0 && (
                    <>
                      <li className="list-group-item list-group-item-secondary fw-bold text-center h5">
                        {lang.en.heading.travelTips}
                      </li>
                      {destination.travel_tips.map((tip, idx) => (
                        <li
                          className="list-group-item list-group-item-secondary"
                          key={idx}
                        >
                          {tip}
                        </li>
                      ))}
                    </>
                  )}
                </ul>
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

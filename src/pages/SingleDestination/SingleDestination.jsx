import "./SingleDestination.css";
import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { showDestination } from "../../utilities/destinations-api";
import { getExperiences } from "../../utilities/experiences-api";
import PhotoCard from "../../components/PhotoCard/PhotoCard";
import ExperienceCard from "../../components/ExperienceCard/ExperienceCard";
import FavoriteDestination from "../../components/FavoriteDestination/FavoriteDestination";

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
  async function getData() {
    let destinationData = await showDestination(destinationId);
    let experienceData = await getExperiences();
    setDestination(destinationData);
    setDestinationExperiences(
      experienceData.filter(
        (experience) => experience.destination._id === destinationId
      )
    );
    updateData();
  }
  useEffect(() => {
    if (!destination || !destinationExperiences) {
      getData();
    } else {
      document.title = `${destination.name},${" "}
      ${
        !destination.state
          ? destination.country
          : destination.state === destination.name
          ? destination.country
          : destination.state
      } - Biensperience`;
    }
  }, []);
  return (
    <>
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
                {destination && <PhotoCard photo={destination.photo} />}
              </div>
              <div className="col-md-6 p-3">
                <ul className="list-group destination-detail">
                  {destination.country ? (
                    <li className="list-group-item list-group-item-secondary fw-bold text-center h4">
                      {`Country: ${destination.country}`}
                    </li>
                  ) : (
                    ""
                  )}
                  {destinationExperiences.length > 0 && (
                    <>
                      <li className="list-group-item list-group-item-secondary fw-bold text-center h5">
                        Popular Experiences
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
                        Travel Tips
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
            <div className="row my-2 p-3">
              <h2 className="experiencesHeading">
                Experiences in {destination.name}
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
                  There are no experiences in this destination yet.{" "}
                  <Link to="/experiences/new">Add one now</Link>?
                </p>
              )}
            </div>
          </>
        )}
      </>
    </>
  );
}

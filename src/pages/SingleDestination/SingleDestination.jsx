import "./SingleDestination.css";
import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { showDestination } from "../../utilities/destinations-api";
import { getExperiences } from "../../utilities/experiences-api";
import PhotoCard from "../../components/PhotoCard/PhotoCard";
import ExperienceCard from "../../components/ExperienceCard/ExperienceCard";

export default function SingleDestination({
  experiences,
  destinations,
  user,
  setUser,
}) {
  const { destinationId } = useParams();
  const [destination, setDestination] = useState(
    destinations.filter((destination) => destination._id == destinationId)[0]
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
  }
  useEffect(() => {
    if (!destination || !destinationExperiences) getData();
  }, []);
  function handleAddToFavorites(e) {
    getData();
  }
  return (
    <>
      <>
        {destination && (
          <>
            <div className="row destination-detail">
              <div className="col-md-6">
                <h1 className="destinationHeading my-4">
                  {destination.name},{" "}
                  {!destination.state
                    ? destination.country
                    : destination.state === destination.name
                    ? destination.country
                    : destination.state}
                </h1>
              </div>
              <div className="d-flex col-md-6 justify-content-end">
                <button
                  className="btn btn-light my-4 add-to-fav-btn"
                  onClick={handleAddToFavorites}
                >
                  ❤️ Add to Favorites
                </button>
              </div>
            </div>
            <div className="row my-4">
              <div className="col-md-6 p-3">{destination && <PhotoCard />}</div>
              <div className="col-md-6 p-3">
                <ul className="list-group destination-detail">
                  <li className="list-group-item list-group-item-secondary fw-bold text-center h5">
                    Popular Experiences
                  </li>
                  <li className="list-group-item list-group-item-secondary"></li>
                  <>
                    <li className="list-group-item list-group-item-secondary fw-bold text-center h5">
                      Travel Tips
                    </li>
                    <li className="list-group-item list-group-item-secondary"></li>
                  </>
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

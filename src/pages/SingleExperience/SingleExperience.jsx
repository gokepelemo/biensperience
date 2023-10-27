import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import "./SingleExperience.css";
import {
  showExperience,
  userAddExperience,
  userRemoveExperience,
} from "../../utilities/experiences-api";

export default function SingleExperience({ user, setUser, experiences }) {
  const { experienceId } = useParams();
  const [experience, setExperience] = useState({});
  const [userHasExperience, setUserHasExperience] = useState(false);
  useEffect(() => {
    async function getExperience() {
      let experienceData = await showExperience(experienceId);
      setExperience(experienceData);
      if (user.experiences) {
        setUserHasExperience(
          user.experiences
            .map((experience) => experience.experience._id)
            .filter((experience) => experience === experienceId).length > 0
        );
      }
    }
    getExperience();
  }, [user]);
  async function handleExperience() {
    let update;
    if (userHasExperience) {
      update = await userRemoveExperience(user._id, experience._id);
      setUserHasExperience(false);
    } else {
      update = await userAddExperience(user._id, experience._id);
      setUserHasExperience(true);
    }
    setUser(update);
  }
  return (
    <>
      {experience && (
        <>
          <div className="row experience-detail">
            <div className="col-md-6">
              <h1 className="h3 experienceHeading my-4">{experience.name}</h1>
              <h2 className="h5">Estimated Cost: </h2>
            </div>
            <div className="d-flex col-md-6 justify-content-end">
              <button className="btn btn-light my-4" onClick={handleExperience}>
                {userHasExperience ? "-" : "+"}
              </button>
            </div>
          </div>
          <div className="row my-4">
            <div className="col-md-6 p-3">
              <ul className="list-group experience-detail">
                <li className="list-group-item list-group-item-secondary fw-bold text-center h5">
                  Destination
                </li>
                <li className="list-group-item list-group-item-secondary">
                  Primary Language:
                </li>
                <li className="list-group-item list-group-item-secondary">
                  Currency:
                </li>
                <li className="list-group-item list-group-item-secondary">
                  Popular Airport:
                </li>
              </ul>
            </div>
            <div className="col-md-6">
              {experience.destination && (
                <iframe
                  width="100%"
                  height="450"
                  style={{ border: "0" }}
                  loading="lazy"
                  src={`https://www.google.com/maps/embed/v1/place?q=${experience.destination.name}+${experience.destination.country}&key=AIzaSyDqWtvNnjYES1pd6ssnZ7gvddUVHrlNaR0`}
                ></iframe>
              )}
            </div>
          </div>
          <div className="row my-4">
            Plan Items
          </div>
        </>
      )}
    </>
  );
}

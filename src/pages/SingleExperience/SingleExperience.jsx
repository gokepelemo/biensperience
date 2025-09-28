import "./SingleExperience.css";
import { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import NewPlanItem from "../../components/NewPlanItem/NewPlanItem";
import {
  showExperience,
  userAddExperience,
  userRemoveExperience,
  deletePlanItem,
  userPlanItemDone,
  deleteExperience,
} from "../../utilities/experiences-api";

export default function SingleExperience({ user, experiences, updateData }) {
  const { experienceId } = useParams();
  const [experience, setExperience] = useState(null);
  const [formState, setFormState] = useState(1);
  const [formVisible, setFormVisible] = useState(0);
  const [userHasExperience, setUserHasExperience] = useState(false);
  const [planItems, setPlanItems] = useState({});
  const [newPlanItem, setNewPlanItem] = useState({});
  const [travelTips, setTravelTips] = useState([]);
  const [isOwner, setIsOwner] = useState(false);
  let navigate = useNavigate();

  useEffect(() => {
    async function fetchExperience() {
      try {
        const experienceData = await showExperience(experienceId);
        setExperience(experienceData);
        // Set isOwner if current user is the creator
        setIsOwner(experienceData.user && experienceData.user._id === user._id);
        // Set userHasExperience if user is in experience.users
        setUserHasExperience(
          experienceData.users && experienceData.users.some(u => u.user._id === user._id)
        );
        // Set travelTips if present
        setTravelTips(experienceData.travel_tips || []);
        // Set planItems done state for current user
        if (experienceData.users) {
          const userObj = experienceData.users.find(u => u.user._id === user._id);
          if (userObj && userObj.plan) {
            const doneMap = {};
            userObj.plan.forEach(item => {
              doneMap[item._id] = item.done;
            });
            setPlanItems(doneMap);
          }
        }
      } catch (err) {
        setExperience(null);
      }
    }
    fetchExperience();
  }, [experienceId, user._id]);

  // Dummy dollarSigns function for cost display
  function dollarSigns(n) {
    return "$".repeat(n);
  }

  async function handleExperience() {
    if (!experience || !user) return;
    try {
      if (userHasExperience) {
        await userRemoveExperience(user._id, experience._id);
        setUserHasExperience(false);
      } else {
        await userAddExperience(user._id, experience._id);
        setUserHasExperience(true);
      }
      // Optionally refresh experience data
      updateData && updateData();
    } catch (err) {
      // Optionally show error
    }
  }
  function handleDeleteExperience() {}
  function handlePlanEdit() {}
  function handlePlanDelete() {}
  function handlePlanItemDone() {}
  return (
    <>
      {experience ? (
        <div>
          <div className="row experience-detail fade-in">
            <div className="col-md-6 fade-in">
              <h1 className="mt-4 h fade-in">{experience.name}</h1>
              {experience.cost_estimate > 0 && (
                <h2 className="h5 fade-in">
                  Estimated Cost: {" "}
                  <span className="green fade-in">
                    {dollarSigns(Math.ceil(experience.cost_estimate / 1000))}
                  </span>
                  <span className="grey fade-in">
                    {dollarSigns(5 - Math.ceil(experience.cost_estimate / 1000))}
                  </span>
                </h2>
              )}
              {experience.user ? (
                <h3 className="h6 fade-in">
                  Created by {" "}
                  <Link to={`/profile/${experience.user._id}`} title={experience.user.name}>
                    {experience.user.name}
                  </Link>
                </h3>
              ) : null}
            </div>
            <div className="d-flex col-md-6 justify-content-end fade-in">
              <button
                className={`btn btn-light favorite-experience-btn my-4${userHasExperience ? " active" : ""} fade-in`}
                onClick={handleExperience}
                aria-label={userHasExperience ? "Remove from Favorite Experiences" : "Add to Favorite Experiences"}
              >
                {userHasExperience ? "💔 Remove" : "💖 Add"}
              </button>
              {isOwner && (
                <button
                  className="btn btn-light my-4 delete-experience-btn fade-in"
                  onClick={handleDeleteExperience}
                >
                  ❌
                </button>
              )}
            </div>
          </div>
          <div className="row my-4 fade-in">
            <div className="col-md-6 p-3 fade-in">
              <ul className="list-group experience-detail fade-in">
                {experience.destination && (
                  <li className="list-group-item list-group-item-secondary fw-bold text-center h5 fade-in">
                    <Link to={`/destinations/${experience.destination._id}`}>
                      Destination: {experience.destination.name}
                    </Link>
                  </li>
                )}
                {travelTips.map((tip, index) => (
                  <li key={index} className="list-group-item list-group-item-secondary fade-in">
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
            <div className="col-md-6 p-3 fade-in">
              {experience.destination && (
                <iframe
                  width="100%"
                  title="map"
                  height="450"
                  style={{ border: "0" }}
                  loading="lazy"
                  src={`https://www.google.com/maps/embed/v1/place?q=${experience.destination.name}+${experience.destination.country}&key=AIzaSyDqWtvNnjYES1pd6ssnZ7gvddUVHrlNaR0`}
                ></iframe>
              )}
            </div>
          </div>
          {isOwner && (
            <div className="row my-4 p-3 fade-in">
              <NewPlanItem
                formVisible={formVisible}
                setFormVisible={setFormVisible}
                formState={formState}
                setFormState={setFormState}
                experience={experience}
                setExperience={setExperience}
                newPlanItem={newPlanItem}
                setNewPlanItem={setNewPlanItem}
                updateData={updateData}
              />
            </div>
          )}
          <div className="row my-2 p-3 fade-in">
            {experience.plan_items && experience.plan_items.length > 0 ? (
              <ul className="list-group fade-in">
                {experience.plan_items.map((planItem, index) => (
                  <li
                    key={index}
                    className="list-group-item d-flex justify-content-between align-items-center plan-item fade-in"
                  >
                    <div className="p-2 lead fade-in">
                      <p className="planItemTitle fade-in">
                        {planItem.url ? (
                          <Link
                            to={planItem.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {planItem.text}
                          </Link>
                        ) : (
                          <span>{planItem.text}</span>
                        )}
                      </p>
                      {isOwner && (
                        <p className="fade-in">
                          <button
                            className="btn btn-light action-btn fade-in"
                            onClick={handlePlanEdit}
                            data-id={planItem._id}
                            data-idx={index}
                          >
                            ✏️
                          </button>
                          <button
                            className="btn btn-light action-btn fade-in"
                            onClick={handlePlanDelete}
                            data-id={planItem._id}
                          >
                            ❌
                          </button>
                        </p>
                      )}
                    </div>
                    <span className="p-1 fade-in">
                      {userHasExperience && (
                        <div className="form-check fade-in">
                          <button
                            className="btn btn-light done-btn fade-in"
                            type="checkbox"
                            id={planItem._id}
                            onClick={handlePlanItemDone}
                          >
                            {planItems[planItem._id] ? `✅` : `👍 Done`}
                          </button>
                        </div>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="alert alert-info fade-in">
                There are no plan items on this experience yet.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

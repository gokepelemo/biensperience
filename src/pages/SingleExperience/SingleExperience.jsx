import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import "./SingleExperience.css";
import {
  showExperience,
  userAddExperience,
  userRemoveExperience,
  deletePlanItem,
  userPlanItemDone,
} from "../../utilities/experiences-api";
import NewPlanItem from "../../components/NewPlanItem/NewPlanItem";

export default function SingleExperience({ user, setUser, experiences }) {
  const { experienceId } = useParams();
  const [experience, setExperience] = useState({ user: null, plan_items: [] });
  const [formState, setFormState] = useState(1);
  const [formVisible, setFormVisible] = useState(0);
  const [userHasExperience, setUserHasExperience] = useState(true);
  const [userPlanItems, setUserPlanItems] = useState([]);
  const [newPlanItem, setNewPlanItem] = useState({});
  function checkItemsDone(planItemId) {
    let planItem = document.getElementById(`${planItemId}`);
    if (planItem.innerText === "🚫 Not Done") {
      planItem.innerText = "✅ Mark as Done";
    } else {
      planItem.innerText = "🚫 Not Done";
    }
  }
  useEffect(() => {
    async function getExperience() {
      let experienceData = await showExperience(experienceId);
      setExperience(experienceData);
      if (experience.users) {
        setUserHasExperience(
          experience.users.map((expUser) => expUser.user).indexOf(user._id) !==
            -1
        );
        setUserPlanItems(
          experience.users
            .filter((expUser) => expUser.user === user._id)
            .map((expUser) => expUser.plan)
        );
        userPlanItems.forEach((expUserPlanItem) => checkItemsDone(expUserPlanItem));
      }
    }
    getExperience();
  }, [formVisible, experience.user, experienceId]);
  async function handleExperience() {
    let update;
    if (userHasExperience) {
      update = await userRemoveExperience(user._id, experience._id);
      setUserHasExperience(false);
    } else {
      update = await userAddExperience(user._id, experience._id);
      setUserHasExperience(true);
    }
    setExperience(update);
  }
  async function handlePlanEdit(e) {
    e.preventDefault();
    setNewPlanItem(experience.plan_items[e.target.dataset.idx])
    setFormVisible(true);
    setFormState(0);
  }
  async function handlePlanDelete(e) {
    e.preventDefault();
    let updatedExperience = await deletePlanItem(
      experience._id,
      e.target.dataset.id
    );
    setExperience(updatedExperience);
  }
  async function handlePlanItemDone(e) {
    e.preventDefault();
    await userPlanItemDone(
      experience._id,
      e.target.id
    );
    checkItemsDone(e.target.id);
  }
  return (
    <>
      {experience && (
        <>
          <div className="row experience-detail">
            <div className="col-md-6">
              <h1 className="experienceHeading my-4">{experience.name}</h1>
              <h2 className="h5">
                Estimated Cost: ${experience.cost_estimate}
              </h2>
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
            <div className="col-md-6 p-3">
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
          {experience.user === user._id && (
            <div className="row my-4 p-3">
              <NewPlanItem
                formVisible={formVisible}
                setFormVisible={setFormVisible}
                formState={formState}
                setFormState={setFormState}
                experience={experience}
                setExperience={setExperience}
                newPlanItem={newPlanItem}
                setNewPlanItem={setNewPlanItem}
              />
            </div>
          )}
          <div className="row my-2 p-3">
            {experience.plan_items.length ? (
              <ul className="list-group">
                {experience.plan_items.map((planItem, index) => {
                  return (
                    <li
                      key={index}
                      className="list-group-item d-flex justify-content-between align-items-center plan-item"
                    >
                      <div className="p-2 lead">
                        <p>{planItem.text}</p>
                        <p>
                          <button
                            className="btn btn-light action-btn"
                            onClick={handlePlanEdit}
                            data-id={planItem._id}
                            data-idx={index}
                          >
                            ✏️
                          </button>
                          <button
                            className="btn btn-light action-btn"
                            onClick={handlePlanDelete}
                            data-id={planItem._id}
                          >
                            ❌
                          </button>
                        </p>
                      </div>{" "}
                      <span className="p-1">
                        {userHasExperience && (
                          <div className="form-check">
                            <button className="btn btn-light action-btn"
                              type="checkbox"
                              id={planItem._id}
                              onClick={handlePlanItemDone}
                              >✅ Mark as Done</button>
                          </div>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="alert alert-info">
                There are no plan items on this experience yet.
              </p>
            )}
          </div>
        </>
      )}
    </>
  );
}

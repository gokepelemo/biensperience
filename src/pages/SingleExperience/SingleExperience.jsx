import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import "./SingleExperience.css";
import {
  showExperience,
  userAddExperience,
  userRemoveExperience,
  deletePlanItem,
  userPlanItemDone,
  deleteExperience,
} from "../../utilities/experiences-api";
import NewPlanItem from "../../components/NewPlanItem/NewPlanItem";

export default function SingleExperience({ user, experiences, updateData }) {
  const { experienceId } = useParams();
  const [experience, setExperience] = useState(
    Object.assign(
      { user: null, plan_items: [], users: [] },
      experiences.filter((experience) => experience._id === experienceId)[0]
    )
  );
  const [formState, setFormState] = useState(1);
  const [formVisible, setFormVisible] = useState(0);
  const [userHasExperience, setUserHasExperience] = useState(false);
  const [planItems, setPlanItems] = useState({});
  const [newPlanItem, setNewPlanItem] = useState({});
  const [travelTips, setTravelTips] = useState(
    typeof experience.destination === "undefined"
      ? []
      : [...experience.destination.travel_tips]
  );
  const [isOwner, setIsOwner] = useState(experience.user === user._id);
  let navigate = useNavigate();
  function checkItemsDone(planItemId) {
    setPlanItems(
      Object.assign(planItems, { [planItemId]: !planItems[planItemId] })
    );
    setFormState(!formState);
  }
  async function getExperience() {
    let experienceData = await showExperience(experienceId);
    setExperience(Object.assign(experience, experienceData));
    if (experience.users) {
      setUserHasExperience(
        experience.users
          .map((expUser) => expUser.user)
          .filter((expUser) => expUser._id === user._id).length > 0
      );
      let plans = experience.users
        .filter((expUser) => expUser.user._id === user._id)
        .filter((expUser) => expUser.plan.length > 0)
        .map((expPlan) => expPlan.plan)[0];
      if (plans) {
        plans.forEach((planItem) =>
          setPlanItems(Object.assign(planItems, { [planItem]: true }))
        );
      }
      setIsOwner(experience.user === user._id);
      setTravelTips([...experience.destination.travel_tips]);
    }
  }
  useEffect(() => {
    getExperience();
    updateData();
    document.title = `${experience.name} - Biensperience`;
  }, [formVisible, formState, planItems, experience]);
  async function handleExperience() {
    let updatedExperience;
    if (userHasExperience) {
      updatedExperience = await userRemoveExperience(user._id, experience._id);
      setUserHasExperience(false);
    } else {
      updatedExperience = await userAddExperience(user._id, experience._id);
      setUserHasExperience(true);
    }
    setExperience(Object.assign({ ...experience }, updatedExperience));
  }
  async function handlePlanEdit(e) {
    e.preventDefault();
    setNewPlanItem(experience.plan_items[e.target.dataset.idx]);
    setFormVisible(1);
    setFormState(0);
  }
  async function handlePlanDelete(e) {
    e.preventDefault();
    let updatedExperience = await deletePlanItem(
      experience._id,
      e.target.dataset.id
    );
    setFormState(!formState);
    setExperience(Object.assign({ ...experience }, updatedExperience));
  }
  async function handlePlanItemDone(e) {
    e.preventDefault();
    let updatedExperience = await userPlanItemDone(experience._id, e.target.id);
    checkItemsDone(e.target.id);
    setExperience(Object.assign({ ...experience }, updatedExperience));
  }
  function dollarSigns(num) {
    let signs = "";
    for (let i = 0; i < num; i++) {
      if (i > 4) break;
      signs += "$";
    }
    return signs;
  }
  function handleDeleteExperience() {
    deleteExperience(experience._id);
    navigate("/experiences");
  }
  return (
    <>
      {experience && (
        <>
          <div className="row experience-detail">
            <div className="col-md-6">
              <h1 className="mt-4 h">{experience.name}</h1>
              {experience.cost_estimate > 0 && (
                <h2 className="h5">
                  Estimated Cost:{" "}
                  <span className="green">
                    {dollarSigns(Math.ceil(experience.cost_estimate / 1000))}
                  </span>
                  <span className="grey">
                    {dollarSigns(
                      5 - Math.ceil(experience.cost_estimate / 1000)
                    )}
                  </span>
                </h2>
              )}
              {experience.user ? (
                <h3 className="h6">
                  Created by{" "}
                  <Link
                    to={`/profile/${experience.user._id}`}
                    title={experience.user.name}
                  >
                    {experience.user.name}
                  </Link>
                </h3>
              ) : (
                ""
              )}
            </div>
            <div className="d-flex col-md-6 justify-content-end">
              <button className="btn btn-light my-4" onClick={handleExperience}>
                {userHasExperience ? "-" : "+"}
              </button>
              {isOwner && (
                <button
                  className="btn btn-light my-4 delete-experience-btn"
                  onClick={handleDeleteExperience}
                >
                  ❌
                </button>
              )}
            </div>
          </div>
          <div className="row my-4">
            <div className="col-md-6 p-3">
              <ul className="list-group experience-detail">
                {experience.destination && (
                  <li className="list-group-item list-group-item-secondary fw-bold text-center h5">
                    <Link to={`/destinations/${experience.destination._id}`}>
                      Destination: {experience.destination.name}
                    </Link>
                  </li>
                )}

                {travelTips.map((tip, index) => (
                  <li
                    key={index}
                    className="list-group-item list-group-item-secondary"
                  >
                    {tip}
                  </li>
                ))}
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
          {isOwner && (
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
                updateData={updateData}
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
                        <p className="planItemTitle">
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
                        )}
                      </div>{" "}
                      <span className="p-1">
                        {userHasExperience && (
                          <div className="form-check">
                            <button
                              className="btn btn-light done-btn"
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

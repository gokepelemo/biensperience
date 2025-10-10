import "./SingleExperience.css";
import { useState, useEffect, useCallback } from "react";
import { lang } from "../../lang.constants";
import { useParams, Link, useNavigate } from "react-router-dom";
import NewPlanItem from "../../components/NewPlanItem/NewPlanItem";
import ConfirmModal from "../../components/ConfirmModal/ConfirmModal";
import PageMeta from "../../components/PageMeta/PageMeta";
import {
  showExperience,
  userAddExperience,
  userRemoveExperience,
  userPlanItemDone,
  deleteExperience,
  deletePlanItem,
} from "../../utilities/experiences-api";
import { formatDateShort, formatDateForInput, getMinimumPlanningDate, isValidPlannedDate } from "../../utilities/date-utils";
import { handleError } from "../../utilities/error-handler";

export default function SingleExperience({ user, experiences, updateData }) {
  const { experienceId } = useParams();
  const navigate = useNavigate();
  const [experience, setExperience] = useState(null);
  const [formState, setFormState] = useState(1);
  const [formVisible, setFormVisible] = useState(0);
  const [userHasExperience, setUserHasExperience] = useState(false);
  const [planItems, setPlanItems] = useState({});
  const [newPlanItem, setNewPlanItem] = useState({});
  const [travelTips, setTravelTips] = useState([]);
  const [isOwner, setIsOwner] = useState(false);
  const [favHover, setFavHover] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hoveredPlanItem, setHoveredPlanItem] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [plannedDate, setPlannedDate] = useState('');
  const [userPlannedDate, setUserPlannedDate] = useState(null);
  const [expandedParents, setExpandedParents] = useState(new Set());
  const [animatingCollapse, setAnimatingCollapse] = useState(null);
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPlanDeleteModal, setShowPlanDeleteModal] = useState(false);
  const [planItemToDelete, setPlanItemToDelete] = useState(null);

  const toggleExpanded = useCallback((parentId) => {
    setExpandedParents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(parentId)) {
        // collapsing
        setAnimatingCollapse(parentId);
        setTimeout(() => {
          setExpandedParents(prev => {
            const newSet = new Set(prev);
            newSet.delete(parentId);
            return newSet;
          });
          setAnimatingCollapse(null);
        }, 300);
      } else {
        // expanding
        newSet.add(parentId);
      }
      return newSet;
    });
  }, []);

  const fetchExperience = useCallback(async () => {
    try {
      const experienceData = await showExperience(experienceId);
      setExperience(experienceData);
      // Set isOwner if current user is the creator
      setIsOwner(experienceData.user && experienceData.user._id.toString() === user._id);
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
            doneMap[item] = true;
          });
          setPlanItems(doneMap);
        }
        setUserPlannedDate(userObj ? userObj.planned_date : null);
      }
      // Set expanded parents (all parents expanded by default)
      const parentIds = experienceData.plan_items.filter(item => !item.parent).map(item => item._id);
      setExpandedParents(new Set(parentIds));
    } catch (err) {
      setExperience(null);
    }
  }, [experienceId, user._id]);

  useEffect(() => {
    fetchExperience();
  }, [fetchExperience]);

  // Memoized dollarSigns function for cost display
  const dollarSigns = useCallback((n) => {
    return "$".repeat(n);
  }, []);

  const handleExperience = useCallback(async () => {
    if (!experience || !user) return;
    if (!userHasExperience) {
      // Show date picker for new addition
      setIsEditingDate(false);
      setShowDatePicker(true);
      return;
    }
    // Remove experience
    const previousState = userHasExperience;
    try {
      // Optimistically update UI
      setUserHasExperience(false);
      setPlanItems({});
      setUserPlannedDate(null);

      await userRemoveExperience(user._id, experience._id);

      // Refresh experience data
      await fetchExperience();
    } catch (err) {
      // Revert on error
      setUserHasExperience(previousState);
      handleError(err, { context: 'Remove experience' });
    }
  }, [experience, user, userHasExperience, fetchExperience]);

  const handleAddExperience = useCallback(async (data = null) => {
    const addData = data !== null ? data : (plannedDate ? { planned_date: plannedDate } : {});
    const previousState = userHasExperience;
    try {
      // Optimistically update UI
      setUserHasExperience(true);
      setShowDatePicker(false);
      setPlannedDate('');
      setUserPlannedDate(addData.planned_date || null);

      await userAddExperience(user._id, experience._id, addData);

      // Refresh experience data to get latest state
      await fetchExperience();
    } catch (err) {
      // Revert on error
      setUserHasExperience(previousState);
      setShowDatePicker(true);
      handleError(err, { context: 'Add experience' });
    }
  }, [user._id, experience?._id, plannedDate, userHasExperience, fetchExperience]);

  const handleDeleteExperience = useCallback(async () => {
    if (!experience || !isOwner) return;
    try {
      await deleteExperience(experience._id);
      updateData && updateData();
      navigate('/experiences');
    } catch (err) {
      handleError(err, { context: 'Delete experience' });
    }
  }, [experience, isOwner, navigate, updateData]);

  const handlePlanEdit = useCallback((e) => {
    const planItemIdx = parseInt(e.currentTarget.getAttribute('data-idx'));
    const planItem = experience.plan_items[planItemIdx];
    if (planItem) {
      setNewPlanItem({
        _id: planItem._id,
        text: planItem.text,
        url: planItem.url || '',
        cost_estimate: planItem.cost_estimate || 0,
        planning_days: planItem.planning_days || 0,
        parent: planItem.parent || '',
      });
      setFormState(0);
      setFormVisible(true);
    }
  }, [experience]);

  const handlePlanDelete = useCallback(async (planItemId) => {
    if (!experience || !planItemId) return;
    try {
      await deletePlanItem(experience._id, planItemId);
      setExperience(prev => ({
        ...prev,
        plan_items: prev.plan_items.filter(item => item._id !== planItemId)
      }));
      updateData && updateData();
      setShowPlanDeleteModal(false);
    } catch (err) {
      handleError(err, { context: 'Delete plan item' });
    }
  }, [experience, updateData]);

  const handlePlanItemDone = useCallback(async (e) => {
    const planItemId = e.currentTarget.id;
    if (!experience || !user) return;
    try {
      const updatedExperience = await userPlanItemDone(experience._id, planItemId);
      setExperience(updatedExperience);
      // Update userHasExperience if the user was just added to the experience
      setUserHasExperience(
        updatedExperience.users && updatedExperience.users.some(u => u.user._id === user._id)
      );
      // Update plan items state
      const userObj = updatedExperience.users.find(u => u.user._id === user._id);
      if (userObj && userObj.plan) {
        const doneMap = {};
        userObj.plan.forEach(item => {
          doneMap[item] = true;
        });
        setPlanItems(doneMap);
      }
      updateData && updateData();
    } catch (err) {
      handleError(err, { context: 'Update plan item status' });
    }
  }, [experience, user, updateData]);
  return (
    <>
      {experience && (
        <PageMeta
          title={experience.name}
          description={`Plan your ${experience.name} experience${
            experience.destination ? ` in ${experience.destination.name}` : ""
          }. ${
            experience.cost_estimate > 0
              ? `Estimated cost: ${dollarSigns(
                  Math.ceil(experience.cost_estimate / 1000)
                )}/5. `
              : ""
          }${
            experience.max_planning_days > 0
              ? `Planning time: ${experience.max_planning_days} days.`
              : ""
          }`}
          keywords={`${experience.name}, travel, experience, planning${
            experience.destination
              ? `, ${experience.destination.name}, ${experience.destination.country}`
              : ""
          }${
            experience.experience_type ? `, ${experience.experience_type}` : ""
          }`}
          ogTitle={`${experience.name}${
            experience.destination ? ` - ${experience.destination.name}` : ""
          }`}
          ogDescription={`Discover and plan ${experience.name}. ${
            travelTips.length > 0
              ? travelTips[0]
              : "Start planning your perfect travel experience today."
          }`}
        />
      )}
      {experience ? (
        <div>
          <div className="row experience-detail fade-in">
            <div className="col-md-6 fade-in text-center text-md-start">
              <h1 className="mt-4 h fade-in">{experience.name}</h1>
              <div className="my-2">
                {experience.cost_estimate > 0 && (
                  <h2 className="h5 fade-in">
                    {lang.en.heading.estimatedCost}{" "}
                    <span className="green fade-in">
                      {dollarSigns(Math.ceil(experience.cost_estimate / 1000))}
                    </span>
                    <span className="grey fade-in">
                      {dollarSigns(
                        5 - Math.ceil(experience.cost_estimate / 1000)
                      )}
                    </span>
                  </h2>
                )}
                {experience.max_planning_days > 0 && (
                  <h2 className="h5 fade-in">
                    {lang.en.heading.planningTime}{" "}
                    {experience.max_planning_days} days
                  </h2>
                )}
              </div>
              {experience.user ? (
                <h3 className="h6 fade-in">
                  {lang.en.heading.createdBy}{" "}
                  <Link
                    to={`/profile/${experience.user._id}`}
                    title={experience.user.name}
                  >
                    {experience.user.name}
                  </Link>
                </h3>
              ) : null}
            </div>
            <div className="d-flex col-md-6 justify-content-center justify-content-md-end flex-column align-items-center flex-sm-row experience-actions">
              <button
                className={`btn btn-icon my-2 my-sm-4 ${
                  userHasExperience ? "btn-plan-remove" : "btn-plan-add"
                } fade-in`}
                onClick={async () => {
                  if (loading) return;
                  setLoading(true);
                  await handleExperience();
                  setLoading(false);
                }}
                aria-label={
                  userHasExperience
                    ? lang.en.button.removeFavoriteExp
                    : lang.en.button.addFavoriteExp
                }
                aria-pressed={userHasExperience}
                onMouseEnter={() => setFavHover(true)}
                onMouseLeave={() => setFavHover(false)}
                disabled={loading}
                aria-busy={loading}
              >
                {userHasExperience
                  ? favHover
                    ? lang.en.button.removeFavoriteExp
                    : userPlannedDate
                    ? `${lang.en.button.expPlanAdded} for ${formatDateShort(
                        userPlannedDate
                      )}`
                    : lang.en.button.expPlanAdded
                  : lang.en.button.addFavoriteExp}
              </button>
              {userHasExperience && (
                <button
                  className="btn btn-icon my-2 my-sm-4 ms-0 ms-sm-2 fade-in"
                  onClick={() => {
                    if (showDatePicker) {
                      setShowDatePicker(false);
                    } else {
                      setIsEditingDate(true);
                      setPlannedDate(
                        userPlannedDate
                          ? formatDateForInput(userPlannedDate)
                          : ""
                      );
                      setShowDatePicker(true);
                    }
                  }}
                  aria-label={lang.en.button.editDate}
                  title={lang.en.button.editDate}
                >
                  📅
                </button>
              )}
              {isOwner && (
                <>
                  <button
                    className="btn btn-icon my-2 my-sm-4 ms-0 ms-sm-2 fade-in"
                    onClick={() => navigate(`/experiences/${experienceId}/update`)}
                    aria-label={lang.en.button.updateExperience}
                    title={lang.en.button.updateExperience}
                  >
                    ✏️
                  </button>
                  <button
                    className="btn btn-light btn-icon my-2 my-sm-4 ms-0 ms-sm-2 fade-in"
                    onClick={() => setShowDeleteModal(true)}
                    aria-label={lang.en.button.delete}
                    title={lang.en.button.delete}
                  >
                    ❌
                  </button>
                </>
              )}
            </div>
            {showDatePicker && (
              <div className="row mt-3 date-picker-modal">
                <div className="col-12">
                  <div className="alert alert-info">
                    <h3 className="mb-3">
                      {isEditingDate
                        ? lang.en.heading.editPlannedDate
                        : lang.en.heading.planYourExperience}
                    </h3>
                    {experience.max_planning_days > 0 && (
                      <p className="mb-3">
                        {lang.en.helper.requiresDaysToPlan.replace(
                          "{days}",
                          experience.max_planning_days
                        )}
                      </p>
                    )}
                    <div className="mb-3">
                      <label htmlFor="plannedDate" className="form-label h5">
                        {lang.en.label.whenDoYouWantExperience}
                      </label>
                      <input
                        type="date"
                        id="plannedDate"
                        className="form-control"
                        value={plannedDate}
                        onChange={(e) => setPlannedDate(e.target.value)}
                        onClick={(e) => e.target.showPicker && e.target.showPicker()}
                        min={getMinimumPlanningDate(
                          experience.max_planning_days
                        )}
                      />
                      {plannedDate &&
                        !isValidPlannedDate(
                          plannedDate,
                          experience.max_planning_days
                        ) && (
                          <div className="alert alert-warning mt-2">
                            {lang.en.alert.notEnoughTimeWarning}
                          </div>
                        )}
                    </div>
                    <button
                      className="btn btn-primary me-2"
                      onClick={() => handleAddExperience()}
                      disabled={!plannedDate}
                      aria-label={isEditingDate ? lang.en.button.updateDate : lang.en.button.setDateAndAdd}
                    >
                      {isEditingDate
                        ? lang.en.button.updateDate
                        : lang.en.button.setDateAndAdd}
                    </button>
                    {!isEditingDate && (
                      <button
                        className="btn btn-secondary me-2"
                        onClick={() => handleAddExperience({})}
                        aria-label={lang.en.button.skip}
                      >
                        {lang.en.button.skip}
                      </button>
                    )}
                    <button
                      className="btn btn-secondary"
                      onClick={() => {
                        setShowDatePicker(false);
                        setPlannedDate("");
                      }}
                      aria-label={lang.en.button.cancel}
                    >
                      {lang.en.button.cancel}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="row my-4 fade-in">
            <div className="col-md-6 p-3 fade-in">
              <ul className="list-group experience-detail fade-in">
                {experience.destination && (
                  <li className="list-group-item list-group-item-secondary fw-bold text-center h5 fade-in">
                    <Link to={`/destinations/${experience.destination._id}`}>
                      {lang.en.label.destinationLabel}
                      {experience.destination.name}
                    </Link>
                  </li>
                )}
                {travelTips.map((tip, index) => (
                  <li
                    key={index}
                    className="list-group-item list-group-item-secondary fade-in"
                  >
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
            {experience.plan_items && experience.plan_items.length > 0 && (
              <div className="plan-items-container fade-in p-3 p-md-4">
                <h3 className="mb-3 text-center fw-bold text-dark">Plan Items</h3>
                {(() => {
                  // Helper to flatten and mark children
                  const flattenPlanItems = (items) => {
                    const result = [];
                    const addItem = (item, isChild = false) => {
                      const isVisible =
                        !isChild ||
                        (expandedParents.has(item.parent) &&
                          animatingCollapse !== item.parent);
                      result.push({ ...item, isChild, isVisible });
                      items
                        .filter(
                          (sub) =>
                            sub.parent &&
                            sub.parent.toString() === item._id.toString()
                        )
                        .forEach((sub) => addItem(sub, true));
                    };
                    items
                      .filter((item) => !item.parent)
                      .forEach((item) => addItem(item, false));
                    return result;
                  };
                  const flattenedItems = flattenPlanItems(
                    experience.plan_items
                  );
                  const itemsToRender = flattenedItems.filter(
                    (item) =>
                      item.isVisible ||
                      (item.isChild && animatingCollapse === item.parent)
                  );
                  return itemsToRender.map((planItem) => (
                    <div
                      key={planItem._id}
                      className={`plan-item-card mb-3 overflow-hidden ${
                        planItem.isVisible ? "" : "collapsed"
                      }`}
                    >
                      <div className="plan-item-header p-3 p-md-4">
                        <div className="plan-item-tree">
                          {!planItem.isChild ? (
                            (() => {
                              const hasChildren = experience.plan_items.some(
                                (sub) =>
                                  sub.parent &&
                                  sub.parent.toString() ===
                                    planItem._id.toString()
                              );
                              if (hasChildren) {
                                return (
                                  <button
                                    className="btn btn-sm btn-link p-0 expand-toggle"
                                    onClick={() => toggleExpanded(planItem._id)}
                                  >
                                    {expandedParents.has(planItem._id)
                                      ? "▼"
                                      : "▶"}
                                  </button>
                                );
                              } else {
                                return (
                                  <span className="no-child-arrow">•</span>
                                );
                              }
                            })()
                          ) : (
                            <span className="child-arrow">↳</span>
                          )}
                        </div>
                        <div className="plan-item-title flex-grow-1 fw-semibold fs-5">
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
                        </div>
                        <div className="plan-item-actions">
                          {isOwner && (
                            <div className="d-flex gap-1">
                              {!planItem.parent && (
                                <button
                                  className="btn btn-outline-primary btn-sm"
                                  onClick={() => {
                                    setNewPlanItem({ parent: planItem._id });
                                    setFormState(1);
                                    setFormVisible(true);
                                  }}
                                  aria-label={`${lang.en.button.addChild} to ${planItem.text}`}
                                  title={lang.en.button.addChild}
                                >
                                  ✚
                                </button>
                              )}
                              <button
                                className="btn btn-outline-secondary btn-sm"
                                onClick={handlePlanEdit}
                                data-id={planItem._id}
                                data-idx={experience.plan_items.findIndex(
                                  (item) => item._id === planItem._id
                                )}
                                aria-label={`Edit ${planItem.text}`}
                                title="Edit"
                              >
                                ✏️
                              </button>
                              <button
                                className="btn btn-outline-danger btn-sm"
                                onClick={() => {
                                  setPlanItemToDelete(planItem._id);
                                  setShowPlanDeleteModal(true);
                                }}
                                aria-label={`Delete ${planItem.text}`}
                                title="Delete"
                              >
                                ✖️
                              </button>
                            </div>
                          )}
                          {(userHasExperience || isOwner) && (
                            <button
                              className={`btn btn-sm ${
                                planItems[planItem._id]
                                  ? "btn-success"
                                  : "btn-outline-success"
                              }`}
                              type="button"
                              id={planItem._id}
                              onClick={handlePlanItemDone}
                              onMouseEnter={() =>
                                setHoveredPlanItem(planItem._id)
                              }
                              onMouseLeave={() => setHoveredPlanItem(null)}
                              aria-label={
                                planItems[planItem._id]
                                  ? `${lang.en.button.undoComplete} ${planItem.text}`
                                  : `${lang.en.button.markComplete} ${planItem.text}`
                              }
                              aria-pressed={!!planItems[planItem._id]}
                              title={
                                planItems[planItem._id]
                                  ? lang.en.button.undoComplete
                                  : lang.en.button.markComplete
                              }
                            >
                              {planItems[planItem._id]
                                ? hoveredPlanItem === planItem._id
                                  ? lang.en.button.undoComplete
                                  : lang.en.button.done
                                : lang.en.button.markComplete}
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="plan-item-details p-2 p-md-3">
                        {(Number(planItem.cost_estimate) > 0 ||
                          Number(planItem.planning_days) > 0) && (
                          <div className="plan-item-meta">
                            {Number(planItem.cost_estimate) > 0 && (
                              <span className="d-flex align-items-center gap-2">
                                <strong className="text-dark">Cost:</strong> ${planItem.cost_estimate}
                              </span>
                            )}
                            {Number(planItem.planning_days) > 0 && (
                              <span className="d-flex align-items-center gap-2">
                                <strong className="text-dark">Planning Time:</strong>{" "}
                                {planItem.planning_days} days
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>
        </div>
      ) : null}
      <ConfirmModal
        show={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteExperience}
        title={lang.en.modal.confirmDelete}
        message={lang.en.modal.confirmDeleteMessage.replace(
          "{name}",
          experience?.name
        )}
        confirmText={lang.en.button.delete}
        confirmVariant="danger"
      />
      <ConfirmModal
        show={showPlanDeleteModal}
        onClose={() => setShowPlanDeleteModal(false)}
        onConfirm={() => handlePlanDelete(planItemToDelete)}
        title={lang.en.modal.confirmDelete}
        message={lang.en.modal.confirmDeletePlanItem}
        confirmText={lang.en.button.delete}
        confirmVariant="danger"
      />
    </>
  );
}

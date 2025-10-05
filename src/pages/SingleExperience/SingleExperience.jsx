import "./SingleExperience.css";
import { useState, useEffect, useCallback } from "react";
import { lang } from "../../lang.constants";
import { useParams, Link, useNavigate } from "react-router-dom";
import NewPlanItem from "../../components/NewPlanItem/NewPlanItem";
import {
  showExperience,
  userAddExperience,
  userRemoveExperience,
  userPlanItemDone,
  deleteExperience,
  deletePlanItem,
} from "../../utilities/experiences-api";

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

  const toggleExpanded = (parentId) => {
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
  };

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

  // Dummy dollarSigns function for cost display
  function dollarSigns(n) {
    return "$".repeat(n);
  }

  async function handleExperience() {
    if (!experience || !user) return;
    if (!userHasExperience) {
      // Show date picker for new addition
      setIsEditingDate(false);
      setShowDatePicker(true);
      return;
    }
    // Remove experience
    try {
      await userRemoveExperience(user._id, experience._id);
      setUserHasExperience(false);
      setPlanItems({}); // Reset plan items when removed
      setUserPlannedDate(null);
    } catch (err) {
      // Optionally show error
    }
  }

  async function handleAddExperience(data = null) {
    const addData = data !== null ? data : (plannedDate ? { planned_date: plannedDate } : {});
    try {
      await userAddExperience(user._id, experience._id, addData);
      setUserHasExperience(true);
      setPlanItems({}); // Reset plan items when re-added
      setShowDatePicker(false);
      setPlannedDate('');
      setUserPlannedDate(addData.planned_date || null);
    } catch (err) {
      console.error('handleAddExperience error:', err);
    }
  }
  async function handleDeleteExperience() {
    if (!experience || !isOwner) return;
    try {
      await deleteExperience(experience._id);
      navigate('/experiences'); // Navigate to experiences list after deletion
    } catch (err) {
      console.error('Failed to delete experience:', err);
    }
  }

  function handlePlanEdit(e) {
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
      setFormState(0); // Edit mode
      setFormVisible(true);
    }
  }

  async function handlePlanDelete(e) {
    const planItemId = e.currentTarget.getAttribute('data-id');
    if (!experience || !planItemId) return;
    try {
      await deletePlanItem(experience._id, planItemId);
      // Update local state to remove the plan item
      setExperience(prev => ({
        ...prev,
        plan_items: prev.plan_items.filter(item => item._id !== planItemId)
      }));
      updateData && updateData();
    } catch (err) {
      console.error('Failed to delete plan item:', err);
    }
  }
  async function handlePlanItemDone(e) {
    const planItemId = e.currentTarget.id;
    if (!experience || !user) return;
    try {
      await userPlanItemDone(experience._id, planItemId);
      // Optimistically toggle done state
      setPlanItems(prev => ({
        ...prev,
        [planItemId]: !prev[planItemId]
      }));
      updateData && updateData();
    } catch (err) {
      // Optionally show error
    }
  }
  return (
    <>
      {experience ? (
        <div>
          <div className="row experience-detail fade-in">
            <div className="col-md-6 fade-in text-center text-md-start">
              <h1 className="mt-4 h fade-in">{experience.name}</h1>
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
                  {lang.en.heading.planningTime} {experience.max_planning_days} days
                </h2>
              )}
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
            <div className="d-flex col-md-6 justify-content-center justify-content-md-end flex-column align-items-center flex-sm-row">
              <button
                className={`btn btn-light favorite-experience-btn my-2 my-sm-4 p-2${
                  userHasExperience ? " active" : ""
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
                onMouseEnter={() => setFavHover(true)}
                onMouseLeave={() => setFavHover(false)}
                disabled={loading}
                aria-busy={loading}
              >
                {userHasExperience
                  ? favHover
                    ? lang.en.button.removeFavoriteExp
                    : userPlannedDate ? `${lang.en.button.expPlanAdded} for ${new Date(userPlannedDate).toLocaleDateString()}` : lang.en.button.expPlanAdded
                  : lang.en.button.addFavoriteExp}
              </button>
              {userHasExperience && (
                <button
                  className="btn btn-light my-2 my-sm-4 ms-0 ms-sm-2 edit-date-btn p-2 fade-in"
                  onClick={() => {
                    if (showDatePicker) {
                      setShowDatePicker(false);
                    } else {
                      setIsEditingDate(true);
                      setPlannedDate(userPlannedDate ? new Date(userPlannedDate).toISOString().split('T')[0] : '');
                      setShowDatePicker(true);
                    }
                  }}
                  title={lang.en.button.editDate}
                >
                  📅
                </button>
              )}
              {isOwner && (
                <button
                  className="btn btn-light my-2 my-sm-4 ms-0 ms-sm-2 delete-experience-btn p-2 fade-in"
                  onClick={() => setShowDeleteModal(true)}
                >
                  ❌
                </button>
              )}
            </div>
            {showDatePicker && (
              <div className="row mt-3 fade-in">
                <div className="col-12">
                  <div className="alert alert-info">
                    <h5>{isEditingDate ? lang.en.heading.editPlannedDate : lang.en.heading.planYourExperience}</h5>
                    <p>{lang.en.helper.requiresDaysToPlan.replace('{days}', experience.max_planning_days)}</p>
                    <div className="mb-3">
                      <label htmlFor="plannedDate" className="form-label">
                        {lang.en.label.whenDoYouWantExperience}
                      </label>
                      <input
                        type="date"
                        id="plannedDate"
                        className="form-control"
                        value={plannedDate}
                        onChange={(e) => setPlannedDate(e.target.value)}
                        min={new Date(Date.now() + experience.max_planning_days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                      />
                      {plannedDate && new Date(plannedDate) < new Date(Date.now() + experience.max_planning_days * 24 * 60 * 60 * 1000) && (
                        <div className="alert alert-warning mt-2">
                          {lang.en.alert.notEnoughTimeWarning}
                        </div>
                      )}
                    </div>
                    <button
                      className="btn btn-primary me-2"
                      onClick={() => handleAddExperience()}
                      disabled={!plannedDate}
                    >
                      {isEditingDate ? lang.en.button.updateDate : lang.en.button.setDateAndAdd}
                    </button>
                    {!isEditingDate && (
                      <button
                        className="btn btn-outline-secondary me-2"
                        onClick={() => handleAddExperience({})}
                      >
                        {lang.en.button.skip}
                      </button>
                    )}
                    <button
                      className="btn btn-secondary"
                      onClick={() => {
                        setShowDatePicker(false);
                        setPlannedDate('');
                      }}
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
                      {lang.en.label.destinationLabel}{experience.destination.name}
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
              <div className="table-responsive fade-in">
                <table className="table align-middle plan-items-table">
                  <caption>Plan Items for {experience.name}</caption>
                  <thead>
                    <tr>
                      <th scope="col" style={{width: '40px'}}></th>
                      <th scope="col">{lang.en.table.title}</th>
                      <th scope="col">{lang.en.table.costEstimate}</th>
                      <th scope="col">{lang.en.table.planningDays}</th>
                      <th scope="col">{lang.en.table.actions}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      // Helper to flatten and mark children
                      const flattenPlanItems = (items) => {
                        const result = [];
                        const addItem = (item, isChild = false) => {
                          const isVisible = !isChild || (expandedParents.has(item.parent) && animatingCollapse !== item.parent);
                          result.push({ ...item, isChild, isVisible });
                          items.filter(sub => sub.parent && sub.parent.toString() === item._id.toString()).forEach(sub => addItem(sub, true));
                        };
                        items.filter(item => !item.parent).forEach(item => addItem(item, false));
                        return result;
                      };
                      const flattenedItems = flattenPlanItems(experience.plan_items);
                      const itemsToRender = flattenedItems.filter(item => item.isVisible || (item.isChild && animatingCollapse === item.parent));
                      return itemsToRender.map(planItem => (
                        <tr key={planItem._id} className={`plan-item-row ${planItem.isVisible ? '' : 'collapsed'}`}>
                          <td className="plan-item-tree">
                            {!planItem.isChild ? (() => {
                              const hasChildren = experience.plan_items.some(sub => sub.parent && sub.parent.toString() === planItem._id.toString());
                              if (hasChildren) {
                                return (
                                  <button
                                    className="btn btn-sm btn-link p-0"
                                    onClick={() => toggleExpanded(planItem._id)}
                                    style={{ fontSize: '16px', lineHeight: 1, textDecoration: 'none' }}
                                  >
                                    {expandedParents.has(planItem._id) ? '▼' : '▶'}
                                  </button>
                                );
                              } else {
                                return <span style={{ fontSize: '16px' }}>▶</span>;
                              }
                            })() : (
                              <span style={{borderLeft: '2px solid #ccc', height: '32px', display: 'inline-block', marginRight: '8px', verticalAlign: 'middle'}}></span>
                            )}
                          </td>
                          <td className="planItemTitle">
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
                          </td>
                          <td>{planItem.cost_estimate ? `$${planItem.cost_estimate}` : ''}</td>
                          <td>{planItem.planning_days || ''}</td>
                          <td style={{ textAlign: 'right' }}>
                            {isOwner && (
                              <div className="d-flex flex-column flex-sm-row justify-content-end">
                                {!planItem.parent && (
                                  <button
                                    className="btn btn-light btn-sm action-btn p-2 mb-1 mb-sm-0"
                                    style={{ height: '32px' }}
                                    onClick={() => {
                                      setNewPlanItem({ parent: planItem._id });
                                      setFormState(1);
                                      setFormVisible(true);
                                    }}
                                    title={lang.en.button.addChild}
                                  >
                                    +
                                  </button>
                                )}
                                <button
                                  className="btn btn-light btn-sm action-btn p-2 mb-1 mb-sm-0 ms-0 ms-sm-2"
                                  style={{ height: '32px' }}
                                  onClick={handlePlanEdit}
                                  data-id={planItem._id}
                                  data-idx={experience.plan_items.findIndex(item => item._id === planItem._id)}
                                  title="Edit"
                                >
                                  ✏️
                                </button>
                                <button
                                  className="btn btn-light btn-sm action-btn p-2 mb-1 mb-sm-0 ms-0 ms-sm-2"
                                  style={{ height: '32px' }}
                                  onClick={() => {
                                    setPlanItemToDelete(planItem._id);
                                    setShowPlanDeleteModal(true);
                                  }}
                                  data-id={planItem._id}
                                  title="Delete"
                                >
                                  ❌
                                </button>
                              </div>
                            )}
                            {userHasExperience && (
                              <button
                                className={`btn btn-light btn-sm done-btn p-2 ${planItems[planItem._id] ? "done" : ""}`}
                                type="checkbox"
                                id={planItem._id}
                                onClick={handlePlanItemDone}
                                onMouseEnter={() => setHoveredPlanItem(planItem._id)}
                                onMouseLeave={() => setHoveredPlanItem(null)}
                                title={planItems[planItem._id] ? lang.en.button.undoComplete : lang.en.button.markComplete}
                              >
                                {planItems[planItem._id]
                                  ? hoveredPlanItem === planItem._id
                                    ? lang.en.button.undoComplete
                                    : lang.en.button.done
                                  : lang.en.button.markComplete}
                              </button>
                            )}
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}
      {showDeleteModal && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{lang.en.modal.confirmDelete}</h5>
                <button type="button" className="btn-close" onClick={() => setShowDeleteModal(false)}></button>
              </div>
              <div className="modal-body">
                <p>{lang.en.modal.confirmDeleteMessage.replace('{name}', experience?.name)}</p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>{lang.en.button.cancel}</button>
                <button type="button" className="btn btn-danger" onClick={handleDeleteExperience}>{lang.en.button.delete}</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showPlanDeleteModal && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{lang.en.modal.confirmDelete}</h5>
                <button type="button" className="btn-close" onClick={() => setShowPlanDeleteModal(false)}></button>
              </div>
              <div className="modal-body">
                <p>{lang.en.modal.confirmDeletePlanItem}</p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowPlanDeleteModal(false)}>{lang.en.button.cancel}</button>
                <button type="button" className="btn btn-danger" onClick={() => {
                  handlePlanDelete({ currentTarget: { getAttribute: () => planItemToDelete } });
                  setShowPlanDeleteModal(false);
                }}>{lang.en.button.delete}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

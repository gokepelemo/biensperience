import "./NewPlanItem.css";
import { useCallback } from "react";
import { addPlanItem, updatePlanItem } from "../../utilities/experiences-api";
import { lang } from "../../lang.constants";
import { handleError } from "../../utilities/error-handler";
import { createUrlSlug } from "../../utilities/url-utils";

export default function NewPlanItem({
  experience,
  setExperience,
  formState,
  setFormState,
  formVisible,
  setFormVisible,
  newPlanItem,
  setNewPlanItem,
  updateData,
}) {
  const handleChange = useCallback((e) => {
    let planItem = { ...newPlanItem };
    const value = e.target.name === 'url' ? createUrlSlug(e.target.value) : e.target.value;
    setNewPlanItem(
      Object.assign(planItem, { [e.target.name]: value })
    );
  }, [newPlanItem, setNewPlanItem]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    try {
      if (formState) {
        let updatedExperience = await addPlanItem(experience._id, newPlanItem);
        setExperience(updatedExperience);
      } else {
        let updatedExperience = await updatePlanItem(
          experience._id,
          newPlanItem
        );
        setExperience(updatedExperience);
      }
      setFormVisible(!formVisible);
      setNewPlanItem({});
      updateData();
    } catch (err) {
      handleError(err, { context: formState ? 'Add plan item' : 'Update plan item' });
    }
  }, [formState, experience._id, newPlanItem, setExperience, setFormVisible, formVisible, setNewPlanItem, updateData]);

  const handleVisibility = useCallback((e) => {
    e.preventDefault();
    if (formVisible) setNewPlanItem({});
    setFormVisible(!formVisible);
    setFormState(1);
  }, [formVisible, setNewPlanItem, setFormVisible, setFormState]);
  return (
    <>
      <button
        className="planItemVisibility btn btn-light"
        onClick={handleVisibility}
      >
        {formVisible ? lang.en.button.cancel : lang.en.button.addPlanItem}
      </button>
      {formVisible ? (
        <>
          <h5 className="lead mt-3">
            {formState ? (newPlanItem.parent ? lang.en.button.addChild : lang.en.button.add) : (newPlanItem.parent ? lang.en.button.updateChild : lang.en.button.update)} {lang.en.label.title}
          </h5>
          <form onSubmit={handleSubmit} className="newPlanItem">
            <label htmlFor="text">{lang.en.label.title}</label>
            <input
              type="text"
              name="text"
              id="text"
              onChange={handleChange}
              className="form-control"
              placeholder={lang.en.placeholder.planItem}
              value={newPlanItem.text}
            />
            <label htmlFor="cost_estimate">{lang.en.label.costEstimate}</label>
            <input
              type="number"
              name="cost_estimate"
              id="cost_estimate"
              onChange={handleChange}
              className="form-control"
              placeholder={lang.en.placeholder.costEstimate}
              value={newPlanItem.cost_estimate}
            />
            <label htmlFor="planning_days">{lang.en.label.planningDays}</label>
            <input
              type="number"
              name="planning_days"
              id="planning_days"
              onChange={handleChange}
              className="form-control"
              placeholder={lang.en.placeholder.planningDays}
              value={newPlanItem.planning_days}
            />
            <label htmlFor="parent">{lang.en.label.parentPlanItem}</label>
            <select
              name="parent"
              id="parent"
              onChange={handleChange}
              className="form-control"
              value={newPlanItem.parent || ''}
            >
              <option value="">{lang.en.helper.noneTopLevel}</option>
              {experience.plan_items.filter(item => !item.parent).map(item => (
                <option key={item._id} value={item._id}>{item.text}</option>
              ))}
            </select>
            <label htmlFor="url">{lang.en.label.url}</label>
            <input
              type="text"
              name="url"
              id="url"
              onChange={handleChange}
              className="form-control"
              placeholder={lang.en.placeholder.url}
              value={newPlanItem.url}
            />
            <button type="submit" className="btn btn-light">
              {formState ? lang.en.button.add : lang.en.button.update}
            </button>
          </form>
        </>
      ) : (
        <div></div>
      )}
    </>
  );
}

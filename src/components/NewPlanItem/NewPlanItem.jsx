import "./NewPlanItem.css";
import { addPlanItem, updatePlanItem } from "../../utilities/experiences-api";

export default function NewPlanItem({ experience, setExperience, formState, setFormState, formVisible, setFormVisible, newPlanItem, setNewPlanItem }) {
  function handleChange(e) {
    let planItem = { ...newPlanItem };
    setNewPlanItem(
      Object.assign(planItem, { [e.target.name]: e.target.value })
    );
  }
  async function handleSubmit(e) {
    e.preventDefault();
    try {
      if (formState) {
        let updatedExperience = await addPlanItem(experience._id, newPlanItem);
        setExperience(updatedExperience);
      } else {
        let updatedExperience = await updatePlanItem(experience._id, newPlanItem);
        setExperience(updatedExperience);
      }
      setFormVisible(!formVisible)
      setNewPlanItem({})
    } catch (err) {
      console.error(err);
    }
  }
  function handleVisibility (e) {
    e.preventDefault();
    if(formVisible) setNewPlanItem({})
    setFormVisible(!formVisible)
    setFormState(1)
  }
  return (
    <>
    <button className="planItemVisibility btn btn-light" onClick={handleVisibility}>{formVisible ? "Cancel" : "+ Add Plan Item"}</button>
    {formVisible ?
    <>
      <h5 className="lead mt-3">{formState ? "Add" : "Update"} Plan Item</h5>
      <form onSubmit={handleSubmit} className="newPlanItem">
        <input
          type="text"
          name="text"
          id="text"
          onChange={handleChange}
          className="form-control"
          placeholder="Title (ex. Book a ticket on Skyscanner)"
          value={newPlanItem.text}
        />
        <input
          type="number"
          name="cost_estimate"
          id="cost_estimate"
          onChange={handleChange}
          className="form-control"
          placeholder="Cost (ex. $350)"
          value={newPlanItem.cost_estimate}
        />
        <input
          type="text"
          name="url"
          id="url"
          onChange={handleChange}
          className="form-control"
          placeholder="URL (ex. https://www.tripadvisor.com/fun-adventure)"
          value={newPlanItem.url}
        />
        <button type="submit" className="btn btn-light">
          {formState ? "Add" : "Update"}
        </button>
      </form>
      </> : <div></div>
      }
    </>
  );
}

import "./NewDestination.css";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createDestination } from "../../utilities/destinations-api";

export default function NewDestination({ render, setRender}) {
  const [newDestination, setNewDestination] = useState({});
  const [travelTips, setTravelTips] = useState([]);
  const navigate = useNavigate();
  function handleChange(e) {
    let destination = { ...newDestination };
    setNewDestination(
      Object.assign(destination, { [e.target.name]: e.target.value })
    );
  }
  async function handleSubmit(e) {
    e.preventDefault();
    try {
      if (travelTips.length) Object.assign(newDestination, { 'travel_tips': travelTips });
      let destination = await createDestination(newDestination);
      navigate(`/destinations/${destination._id}`)
    } catch (err) {
      console.error(err);
    }
    setRender(!render)
  }
  function addTravelTip(text) {
    setTravelTips([...travelTips, text]);
  }
  function deleteTravelTip(id) {
    let newTravelTips = [...travelTips];
    newTravelTips.splice(id, 1);
    setTravelTips([...newTravelTips]);
  }
  return (
    <>
      <h1>New Destination</h1>
      <form onSubmit={handleSubmit} className="newDestination">
        <label>Name</label>
        <input
          type="text"
          name="name"
          id="name"
          onChange={handleChange}
          className="form-control"
        />
        <label>State<small>(optional)</small></label>
        <input
          type="text"
          name="state"
          id="state"
          onChange={handleChange}
          className="form-control"
        />
        <label>Country</label>
        <input
          type="text"
          name="country"
          id="country"
          onChange={handleChange}
          className="form-control"
        />
        <label>Travel Tips</label>
        {travelTips.length ? (
          travelTips.map((travelTip, idx) => {
            return (
              <>
                <li key={idx}>{travelTip}</li>
              </>
            );
          })
        ) : (
          <p>No travel tips added yet.</p>
        )}
        <label>Photo</label>
        <input type="file" name="photo" id="photo" className="form-control" />
        <button type="submit" className="btn btn-light">
          Add
        </button>
      </form>
    </>
  );
}

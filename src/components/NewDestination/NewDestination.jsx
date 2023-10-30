import "./NewDestination.css";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createDestination } from "../../utilities/destinations-api";
import ImageUpload from "../ImageUpload/ImageUpload";

export default function NewDestination({ updateData }) {
  const [newDestination, setNewDestination] = useState({});
  const [travelTips, setTravelTips] = useState([]);
  const [newTravelTip, setNewTravelTip] = useState({});
  const navigate = useNavigate();
  useEffect(() => {
    document.title = `New Destination - Biensperience`;
  }, []);
  function handleChange(e) {
    setNewDestination({ ...newDestination, [e.target.name]: e.target.value });
  }
  async function handleSubmit(e) {
    e.preventDefault();
    try {
      let destination = await createDestination(
        Object.assign({ ...newDestination }, { travel_tips: travelTips })
      );
      updateData();
      navigate(`/experiences/new`);
    } catch (err) {
      console.error(err);
    }
  }
  function addTravelTip(text) {
    setTravelTips([...travelTips, text]);
  }
  function deleteTravelTip(id) {
    let newTravelTips = [...travelTips];
    newTravelTips.splice(id, 1);
    setTravelTips([...newTravelTips]);
  }
  function handleAddTravelTip(e) {
    if (newTravelTip.tipkey.length && newTravelTip.tipvalue.length) {
      addTravelTip(`${newTravelTip.tipkey}: ${newTravelTip.tipvalue}`);
    }
    setNewTravelTip({ tipkey: "", tipvalue: "" });
  }
  function handleTravelTipChange(e) {
    setNewTravelTip({ ...newTravelTip, [e.target.name]: e.target.value });
  }
  return (
    <>
      <h1>New Destination</h1>
      <form onSubmit={handleSubmit} className="newDestination">
        <span>
          <input
            type="text"
            name="name"
            id="name"
            onChange={handleChange}
            className="form-control"
            value={newDestination.name}
            placeholder="e.g. London"
          />
          <small>City (required)</small>
        </span>
        <span>
          <input
            type="text"
            name="state"
            id="state"
            onChange={handleChange}
            className="form-control"
            value={newDestination.state}
            placeholder="e.g. United Kingdom"
          />
          <small>State/Province (required)</small>
        </span>
        <span>
          <input
            type="text"
            name="country"
            id="country"
            onChange={handleChange}
            className="form-control"
            value={newDestination.country}
            placeholder="e.g. England"
          />
          <small>Country (required)</small>
        </span>
        <span>
        <ImageUpload data={newDestination} setData={setNewDestination} />
        <small>Photo (optional)</small>
        </span>
        <span>
          <h5 className="mt-2">Travel Tips</h5>
          <span className="addTravelTipPane">
            <div
              className="btn btn-light action-btn"
              onClick={handleAddTravelTip}
            >
              +
            </div>
            <input
              type="text"
              name="tipkey"
              className="form-control addTravelTips"
              placeholder="e.g. Language"
              onChange={(e) => handleTravelTipChange(e)}
              value={newTravelTip.tipkey}
              autoComplete="off"
            />
            <input
              type="text"
              name="tipvalue"
              className="form-control addTravelTips tipDescription"
              placeholder="e.g. Spanish"
              onChange={(e) => handleTravelTipChange(e)}
              value={newTravelTip.tipvalue}
              autoComplete="off"
            />
          </span>
          <ul className="list-group">
            {travelTips.length ? (
              travelTips.map((travelTip, idx) => {
                return (
                  <li key={idx} className="travelTips list-group-item">
                    <div
                      className="btn btn-light action-btn"
                      onClick={() => deleteTravelTip(idx)}
                    >
                      ❌
                    </div>
                    {travelTip}
                  </li>
                );
              })
            ) : (
              <p>No travel tips added yet.</p>
            )}
          </ul>
        </span>
        <div className="form-btns">
          <button type="submit" className="btn btn-light">
            Create New Experience
          </button>
        </div>
      </form>
    </>
  );
}

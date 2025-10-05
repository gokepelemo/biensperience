import "./NewDestination.css";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { lang } from "../../lang.constants";
import { createDestination } from "../../utilities/destinations-api";
import ImageUpload from "../ImageUpload/ImageUpload";

export default function NewDestination({ updateData }) {
  const [newDestination, setNewDestination] = useState({});
  const [travelTips, setTravelTips] = useState([]);
  const [newTravelTip, setNewTravelTip] = useState({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [tipToDelete, setTipToDelete] = useState(null);
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
        await createDestination(
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
      <h1>{lang.en.heading.newDestination}</h1>
      <form onSubmit={handleSubmit} className="newDestination">
        <span>
          <input
            type="text"
            name="name"
            id="name"
            onChange={handleChange}
            className="form-control"
            value={newDestination.name}
            placeholder={lang.en.placeholder.city}
          />
          <small>{lang.en.helper.cityRequired}</small>
        </span>
        <span>
          <input
            type="text"
            name="state"
            id="state"
            onChange={handleChange}
            className="form-control"
            value={newDestination.state}
            placeholder={lang.en.placeholder.stateProvince}
          />
          <small>{lang.en.helper.stateProvinceRequired}</small>
        </span>
        <span>
          <input
            type="text"
            name="country"
            id="country"
            onChange={handleChange}
            className="form-control"
            value={newDestination.country}
            placeholder={lang.en.placeholder.country}
          />
          <small>{lang.en.helper.countryRequired}</small>
        </span>
        <span>
        <ImageUpload data={newDestination} setData={setNewDestination} />
        <small>{lang.en.helper.photoOptional}</small>
        </span>
        <span>
          <h5 className="mt-2">{lang.en.heading.travelTips}</h5>
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
              placeholder={lang.en.placeholder.language}
              onChange={(e) => handleTravelTipChange(e)}
              value={newTravelTip.tipkey}
              autoComplete="off"
            />
            <input
              type="text"
              name="tipvalue"
              className="form-control addTravelTips tipDescription"
              placeholder={lang.en.placeholder.spanish}
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
                      onClick={() => {
                        setTipToDelete(idx);
                        setShowDeleteModal(true);
                      }}
                    >
                      ❌
                    </div>
                    {travelTip}
                  </li>
                );
              })
            ) : (
              <p>{lang.en.alert.noTravelTips}</p>
            )}
          </ul>
        </span>
        <div className="form-btns">
          <button type="submit" className="btn btn-light">
            {lang.en.button.addDestinationCreateExperience}
          </button>
        </div>
      </form>
      {showDeleteModal && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{lang.en.modal.confirmDelete}</h5>
                <button type="button" className="btn-close" onClick={() => setShowDeleteModal(false)}></button>
              </div>
              <div className="modal-body">
                <p>{lang.en.modal.confirmDeleteTravelTip}</p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>{lang.en.button.cancel}</button>
                <button type="button" className="btn btn-danger" onClick={() => {
                  deleteTravelTip(tipToDelete);
                  setShowDeleteModal(false);
                }}>{lang.en.button.delete}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

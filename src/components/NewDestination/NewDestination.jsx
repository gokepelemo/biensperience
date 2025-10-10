import "./NewDestination.css";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { lang } from "../../lang.constants";
import { createDestination, getDestinations } from "../../utilities/destinations-api";
import ImageUpload from "../ImageUpload/ImageUpload";
import { handleError } from "../../utilities/error-handler";
import { deduplicateByMultipleFields } from "../../utilities/deduplication";

export default function NewDestination({ updateData }) {
  const [newDestination, setNewDestination] = useState({});
  const [destinations, setDestinations] = useState([]);
  const [travelTips, setTravelTips] = useState([]);
  const [newTravelTip, setNewTravelTip] = useState({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [tipToDelete, setTipToDelete] = useState(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  useEffect(() => {
    async function fetchDestinations() {
      const destinationData = await getDestinations();
      setDestinations(destinationData);
      document.title = `New Destination - Biensperience`;
    }
    fetchDestinations();
  }, []);
  function handleChange(e) {
    setNewDestination({ ...newDestination, [e.target.name]: e.target.value });
  }
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    // Frontend duplicate check (case-insensitive name and country combination)
    if (newDestination.name && newDestination.country) {
      const duplicate = destinations.find(dest =>
        dest.name.toLowerCase().trim() === newDestination.name.toLowerCase().trim() &&
        dest.country.toLowerCase().trim() === newDestination.country.toLowerCase().trim()
      );

      if (duplicate) {
        setError(`A destination named "${newDestination.name}, ${newDestination.country}" already exists. Please choose a different destination.`);
        return;
      }
    }

    try {
        await createDestination(
        Object.assign({ ...newDestination }, { travel_tips: travelTips })
      );
      updateData();
      navigate(`/experiences/new`);
    } catch (err) {
      const errorMsg = handleError(err, { context: 'Create destination' });
      // Check if it's a duplicate error from backend
      if (err.message && err.message.includes('already exists')) {
        setError(err.message);
      } else {
        setError(errorMsg);
      }
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
      <div className="row fade-in">
        <div className="col-md-6 fade-in">
          <h1 className="my-4 h fade-in">{lang.en.heading.createDestination}</h1>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger mb-4" role="alert">
          {error}
        </div>
      )}

      <div className="row my-4 fade-in">
        <div className="col-12">
          <form onSubmit={handleSubmit} className="new-experience-form">
            <div className="mb-4">
              <label htmlFor="name" className="form-label">
                City Name
              </label>
              <input
                type="text"
                name="name"
                id="name"
                onChange={handleChange}
                className="form-control"
                value={newDestination.name || ''}
                placeholder={lang.en.placeholder.city}
                required
              />
              <small className="form-text text-muted">
                {lang.en.helper.cityRequired}
              </small>
            </div>

            <div className="row mb-4">
              <div className="col-md-6 mb-3 mb-md-0">
                <label htmlFor="state" className="form-label">
                  State / Province
                </label>
                <input
                  type="text"
                  name="state"
                  id="state"
                  onChange={handleChange}
                  className="form-control"
                  value={newDestination.state || ''}
                  placeholder={lang.en.placeholder.stateProvince}
                />
                <small className="form-text text-muted">
                  {lang.en.helper.stateProvinceRequired}
                </small>
              </div>

              <div className="col-md-6">
                <label htmlFor="country" className="form-label">
                  Country
                </label>
                <input
                  type="text"
                  name="country"
                  id="country"
                  onChange={handleChange}
                  className="form-control"
                  value={newDestination.country || ''}
                  placeholder={lang.en.placeholder.country}
                  required
                />
                <small className="form-text text-muted">
                  {lang.en.helper.countryRequired}
                </small>
              </div>
            </div>

            <div className="mb-4">
              <label className="form-label">
                Photo
              </label>
              <ImageUpload data={newDestination} setData={setNewDestination} />
              <small className="form-text text-muted">
                {lang.en.helper.photoOptional}
              </small>
            </div>

            <div className="mb-4">
              <label className="form-label">
                {lang.en.heading.travelTips}
              </label>

              <div className="input-group mb-3">
                <input
                  type="text"
                  name="tipkey"
                  className="form-control"
                  placeholder={lang.en.placeholder.language}
                  onChange={(e) => handleTravelTipChange(e)}
                  value={newTravelTip.tipkey || ''}
                  autoComplete="off"
                />
                <input
                  type="text"
                  name="tipvalue"
                  className="form-control"
                  placeholder={lang.en.placeholder.spanish}
                  onChange={(e) => handleTravelTipChange(e)}
                  value={newTravelTip.tipvalue || ''}
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="btn btn-outline-primary"
                  onClick={handleAddTravelTip}
                >
                  Add Tip
                </button>
              </div>

              <small className="form-text text-muted d-block mb-2">
                Add helpful travel tips for this destination (optional)
              </small>

              {travelTips.length > 0 && (
                <ul className="list-group">
                  {travelTips.map((travelTip, idx) => (
                    <li key={idx} className="list-group-item d-flex justify-content-between align-items-center">
                      <span>{travelTip}</span>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => {
                          setTipToDelete(idx);
                          setShowDeleteModal(true);
                        }}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {travelTips.length === 0 && (
                <div className="alert alert-info">
                  {lang.en.alert.noTravelTips}
                </div>
              )}
            </div>

            <div className="d-flex justify-content-end mt-4">
              <button
                type="submit"
                className="btn btn-primary btn-lg"
                aria-label="Create destination and continue to experience"
              >
                Create Destination
              </button>
            </div>
          </form>
        </div>
      </div>
      {showDeleteModal && (
        <div className="modal fade show d-block" tabIndex="-1">
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

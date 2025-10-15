import "./NewDestination.css";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { lang } from "../../lang.constants";
import { createDestination, getDestinations } from "../../utilities/destinations-api";
import ImageUpload from "../ImageUpload/ImageUpload";
import Alert from "../Alert/Alert";
import { handleError } from "../../utilities/error-handler";
import { Tooltip } from "bootstrap";
import ConfirmModal from "../ConfirmModal/ConfirmModal";

export default function NewDestination({ updateData }) {
  const [newDestination, setNewDestination] = useState({});
  const [destinations, setDestinations] = useState([]);
  const [travelTips, setTravelTips] = useState([]);
  const [newTravelTip, setNewTravelTip] = useState({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [tipToDelete, setTipToDelete] = useState(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  
  // Initialize Bootstrap tooltips
  useEffect(() => {
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new Tooltip(tooltipTriggerEl));
    
    return () => {
      tooltipList.forEach(tooltip => tooltip.dispose());
    };
  }, []);
  
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
        <Alert
          type="danger"
          message={error}
          className="mb-4"
        />
      )}

      <div className="row my-4 fade-in">
        <div className="col-12">
          <form onSubmit={handleSubmit} className="new-experience-form">
                        <div className="mb-4">
              <label htmlFor="name" className="form-label">
                City / Town
                <span 
                  className="ms-2 text-info" 
                  data-bs-toggle="tooltip" 
                  data-bs-placement="top" 
                  title={lang.en.helper.cityRequired}
                  style={{ cursor: 'help' }}
                >
                  ℹ️
                </span>
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
            </div>

            <div className="row mb-4">
              <div className="col-md-6 mb-3 mb-md-0">
                <label htmlFor="state" className="form-label">
                  State / Province
                  <span 
                    className="ms-2 text-info" 
                    data-bs-toggle="tooltip" 
                    data-bs-placement="top" 
                    title={lang.en.helper.stateProvinceRequired}
                    style={{ cursor: 'help' }}
                  >
                    ℹ️
                  </span>
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
              </div>

              <div className="col-md-6">
                <label htmlFor="country" className="form-label">
                  Country
                  <span 
                    className="ms-2 text-info" 
                    data-bs-toggle="tooltip" 
                    data-bs-placement="top" 
                    title={lang.en.helper.countryRequired}
                    style={{ cursor: 'help' }}
                  >
                    ℹ️
                  </span>
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
              </div>
            </div>

            <div className="mb-4">
              <label className="form-label">
                Photos
                <span 
                  className="ms-2 text-info" 
                  data-bs-toggle="tooltip" 
                  data-bs-placement="top" 
                  title={lang.en.helper.destinationPhoto}
                  style={{ cursor: 'help' }}
                >
                  ℹ️
                </span>
              </label>
              <ImageUpload data={newDestination} setData={setNewDestination} />
            </div>

            <div className="mb-4">
              <label className="form-label">
                {lang.en.heading.travelTips}
                <span 
                  className="ms-2 text-info" 
                  data-bs-toggle="tooltip" 
                  data-bs-placement="top" 
                  title="Share insider tips that'll help travelers make the most of this destination! 💡"
                  style={{ cursor: 'help' }}
                >
                  ℹ️
                </span>
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
                  style={{ padding: '1rem' }}
                />
                <input
                  type="text"
                  name="tipvalue"
                  className="form-control rounded-end"
                  placeholder={lang.en.placeholder.spanish}
                  onChange={(e) => handleTravelTipChange(e)}
                  value={newTravelTip.tipvalue || ''}
                  autoComplete="off"
                  style={{ padding: '1rem' }}
                />
                <button
                  type="button"
                  className="btn btn-outline-primary"
                  onClick={handleAddTravelTip}
                >
                  Add Tip
                </button>
              </div>

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
                <Alert
                  type="info"
                  message={lang.en.alert.noTravelTips}
                />
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
      
      <ConfirmModal
        show={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={() => {
          deleteTravelTip(tipToDelete);
          setShowDeleteModal(false);
        }}
        title={lang.en.modal.confirmDelete}
        message={lang.en.modal.confirmDeleteTravelTip}
        confirmText={lang.en.button.delete}
        confirmVariant="danger"
        cancelText={lang.en.button.cancel}
      />
    </>
  );
}

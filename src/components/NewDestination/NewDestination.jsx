import "./NewDestination.css";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { lang } from "../../lang.constants";
import { createDestination } from "../../utilities/destinations-api";
import { useData } from "../../contexts/DataContext";
import { useToast } from "../../contexts/ToastContext";
import ImageUpload from "../ImageUpload/ImageUpload";
import Alert from "../Alert/Alert";
import { handleError } from "../../utilities/error-handler";
import ConfirmModal from "../ConfirmModal/ConfirmModal";
import FormField from "../FormField/FormField";
import { FormTooltip } from "../Tooltip/Tooltip";
import { Form } from "react-bootstrap";
import { useFormPersistence } from "../../hooks/useFormPersistence";

export default function NewDestination() {
  const { destinations: destData, addDestination } = useData();
  const { success } = useToast();
  const [newDestination, setNewDestination] = useState({});
  const [destinations, setDestinations] = useState([]);
  const [travelTips, setTravelTips] = useState([]);
  const [newTravelTip, setNewTravelTip] = useState({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [tipToDelete, setTipToDelete] = useState(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // Form persistence - combines newDestination and travelTips
  const formData = { ...newDestination, travel_tips: travelTips };
  const setFormData = (data) => {
    const { travel_tips, ...destData } = data;
    setNewDestination(destData);
    if (travel_tips) {
      setTravelTips(travel_tips);
    }
  };

  const persistence = useFormPersistence(
    'new-destination-form',
    formData,
    setFormData,
    {
      enabled: true,
      ttl: 24 * 60 * 60 * 1000, // 24 hours
      debounceMs: 1000, // Save after 1 second of inactivity
      excludeFields: [], // Save all fields
      onRestore: (savedData, age) => {
        // Show toast notification
        success(
          `Form data restored from ${Math.floor(age / 60000)} minutes ago. ` +
          `You can continue editing or clear the form to start fresh.`,
          { duration: 8000 }
        );
      }
    }
  );
  
  useEffect(() => {
    if (destData) setDestinations(destData);
    document.title = `New Destination - Biensperience`;
  }, [destData]);
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
      const destination = await createDestination(
        Object.assign({ ...newDestination }, { travel_tips: travelTips })
      );
      addDestination(destination); // Instant UI update!

      // Clear saved form data on success
      persistence.clear();

      success('Destination created!');
      navigate(`/experiences/new`);
    } catch (err) {
      const errorMsg = handleError(err, { context: 'Create destination' });
      // Check if it's an email verification error
      if (err.response?.data?.code === 'EMAIL_NOT_VERIFIED') {
        setError(err.response.data.error || lang.en.alert.emailNotVerifiedMessage);
      }
      // Check if it's a duplicate error from backend
      else if (err.message && err.message.includes('already exists')) {
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
          className="mb-4"
        >
          <div>
            {error}
            {error.includes('verify your email') && (
              <div className="mt-2">
                <a href="/resend-confirmation" className="btn btn-sm btn-outline-primary">
                  Resend Verification Email
                </a>
              </div>
            )}
          </div>
        </Alert>
      )}

      <div className="row my-4 fade-in">
        <div className="col-12">
          <Form onSubmit={handleSubmit} className="new-experience-form">
            <FormField
              name="name"
              label="City / Town"
              type="text"
              value={newDestination.name || ''}
              onChange={handleChange}
              placeholder={lang.en.placeholder.city}
              required
              tooltip={lang.en.helper.cityRequired}
              tooltipPlacement="top"
            />

            <div className="row mb-4">
              <div className="col-md-6 mb-3 mb-md-0">
                <FormField
                  name="state"
                  label="State / Province"
                  type="text"
                  value={newDestination.state || ''}
                  onChange={handleChange}
                  placeholder={lang.en.placeholder.stateProvince}
                  tooltip={lang.en.helper.stateProvinceRequired}
                  tooltipPlacement="top"
                  className="mb-0"
                />
              </div>

              <div className="col-md-6">
                <FormField
                  name="country"
                  label="Country"
                  type="text"
                  value={newDestination.country || ''}
                  onChange={handleChange}
                  placeholder={lang.en.placeholder.country}
                  required
                  tooltip={lang.en.helper.countryRequired}
                  tooltipPlacement="top"
                  className="mb-0"
                />
              </div>
            </div>

            <div className="mb-4">
              <Form.Label>
                Photos
                <FormTooltip content={lang.en.helper.destinationPhoto} placement="top" />
              </Form.Label>
              <ImageUpload data={newDestination} setData={setNewDestination} />
            </div>

            <div className="mb-4">
              <Form.Label>
                {lang.en.heading.travelTips}
                <FormTooltip 
                  content="Share insider tips that'll help travelers make the most of this destination! 💡" 
                  placement="top" 
                />
              </Form.Label>

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
          </Form>
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

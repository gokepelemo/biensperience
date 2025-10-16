import "./UpdateDestination.css";
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { updateDestination, showDestination } from "../../utilities/destinations-api";
import { lang } from "../../lang.constants";
import ImageUpload from "../../components/ImageUpload/ImageUpload";
import Alert from "../Alert/Alert";
import { handleError } from "../../utilities/error-handler";
import Modal from "../Modal/Modal";
import FormField from "../FormField/FormField";
import { Form } from "react-bootstrap";

export default function UpdateDestination({ user, updateData }) {
  const { destinationId } = useParams();
  const [destination, setDestination] = useState(null);
  const [travelTips, setTravelTips] = useState([]);
  const [newTravelTip, setNewTravelTip] = useState({});
  const [originalDestination, setOriginalDestination] = useState(null);
  const [changes, setChanges] = useState({});
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Convert snake_case to Title Case
  function formatFieldName(fieldName) {
    return fieldName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  useEffect(() => {
    async function fetchData() {
      try {
        const destinationData = await showDestination(destinationId);

        // Check if user is the owner
        if (!destinationData.user || destinationData.user._id !== user._id) {
          setError("You are not authorized to update this destination.");
          setLoading(false);
          return;
        }

        setDestination(destinationData);
        setOriginalDestination(destinationData);
        setTravelTips(destinationData.travel_tips || []);
        setLoading(false);
      } catch (err) {
        const errorMessage = handleError(err, { context: 'Loading destination for update' });
        setError(errorMessage || "Failed to load destination. Please try again.");
        setLoading(false);
      }
    }

    if (user && destinationId) {
      fetchData();
    }
  }, [destinationId, user]);

  // Track photo changes
  useEffect(() => {
    if (!destination || !originalDestination) return;

    const newChanges = { ...changes };
    
    // Check if photos array changed
    const originalPhotos = originalDestination.photos || [];
    const currentPhotos = destination.photos || [];
    
    const photosChanged = JSON.stringify(originalPhotos) !== JSON.stringify(currentPhotos);
    
    if (photosChanged) {
      const fromText = originalPhotos.length === 0 ? 'No photos' : `${originalPhotos.length} photo${originalPhotos.length > 1 ? 's' : ''}`;
      const toText = currentPhotos.length === 0 ? 'No photos' : `${currentPhotos.length} photo${currentPhotos.length > 1 ? 's' : ''}`;
      
      newChanges.photos = {
        from: fromText,
        to: toText
      };
    } else {
      delete newChanges.photos;
    }
    
    // Check if default photo index changed
    const originalIndex = originalDestination.default_photo_index || 0;
    const currentIndex = destination.default_photo_index || 0;
    
    if (originalIndex !== currentIndex && currentPhotos.length > 0) {
      newChanges.default_photo_index = {
        from: `Photo #${originalIndex + 1}`,
        to: `Photo #${currentIndex + 1}`
      };
    } else {
      delete newChanges.default_photo_index;
    }
    
    // Only update if changes actually differ
    if (JSON.stringify(newChanges) !== JSON.stringify(changes)) {
      setChanges(newChanges);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination, originalDestination]);

  function handleChange(e) {
    const { name, value } = e.target;
    const updatedDestination = { ...destination, [name]: value };

    // Track changes
    const newChanges = { ...changes };
    if (originalDestination && originalDestination[name] !== value) {
      newChanges[name] = { from: originalDestination[name], to: value };
    } else {
      delete newChanges[name];
    }

    setDestination(updatedDestination);
    setChanges(newChanges);
  }

  function addTravelTip(text) {
    const newTips = [...travelTips, text];
    setTravelTips(newTips);
    // Track changes for travel tips
    if (JSON.stringify(newTips) !== JSON.stringify(originalDestination.travel_tips)) {
      setChanges({ ...changes, travel_tips: { from: originalDestination.travel_tips, to: newTips } });
    }
  }

  function deleteTravelTip(id) {
    let newTravelTips = [...travelTips];
    newTravelTips.splice(id, 1);
    setTravelTips([...newTravelTips]);
    // Track changes for travel tips
    if (JSON.stringify(newTravelTips) !== JSON.stringify(originalDestination.travel_tips)) {
      setChanges({ ...changes, travel_tips: { from: originalDestination.travel_tips, to: newTravelTips } });
    }
  }

  function handleAddTravelTip(e) {
    e.preventDefault();
    if (newTravelTip.tipkey && newTravelTip.tipkey.length && newTravelTip.tipvalue && newTravelTip.tipvalue.length) {
      addTravelTip(`${newTravelTip.tipkey}: ${newTravelTip.tipvalue}`);
    }
    setNewTravelTip({ tipkey: "", tipvalue: "" });
  }

  function handleTravelTipChange(e) {
    setNewTravelTip({ ...newTravelTip, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    try {
      const dataToUpdate = {
        ...destination,
        travel_tips: travelTips
      };

      await updateDestination(destinationId, dataToUpdate);
      updateData && updateData();
      navigate(`/destinations/${destinationId}`);
    } catch (err) {
      const errorMsg = handleError(err, { context: 'Update destination' });
      if (err.message && err.message.includes('already exists')) {
        setError(err.message);
      } else {
        setError(errorMsg);
      }
    }
  }

  function handleConfirmUpdate() {
    setShowConfirmModal(true);
  }

  async function confirmUpdate() {
    await handleSubmit({ preventDefault: () => {} });
  }

  if (loading) {
    return (
      <div className="container my-5">
        <div className="text-center">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error && !destination) {
    return (
      <div className="container my-5">
        <Alert
          type="danger"
          message={error}
        />
      </div>
    );
  }

  return (
    <>
      <div className="row fade-in">
        <div className="col-md-6 fade-in">
          <h1 className="my-4 h fade-in">{lang.en.heading.updateDestination || 'Update Destination'}</h1>
        </div>
      </div>

      {error && (
        <Alert
          type="danger"
          message={error}
          className="mb-4"
        />
      )}

      {Object.keys(changes).length > 0 && (
        <Alert
          type="info"
          className="mb-4"
        >
          <strong>Changes detected:</strong>
          <ul className="mb-0 mt-2">
            {Object.keys(changes).map((field, idx) => (
              <li key={idx}>
                <strong>{formatFieldName(field)}:</strong> {changes[field].from || '(empty)'} → {changes[field].to || '(empty)'}
              </li>
            ))}
          </ul>
        </Alert>
      )}

      <div className="row my-4 fade-in">
        <div className="col-12">
          <Form onSubmit={handleSubmit} className="new-experience-form">
            <FormField
              name="name"
              label="City Name"
              type="text"
              value={destination?.name || ''}
              onChange={handleChange}
              placeholder={lang.en.placeholder.city}
              required
            />

            <div className="row mb-4">
              <div className="col-md-6 mb-3 mb-md-0">
                <FormField
                  name="state"
                  label="State / Province"
                  type="text"
                  value={destination?.state || ''}
                  onChange={handleChange}
                  placeholder={lang.en.placeholder.stateProvince}
                />
              </div>

              <div className="col-md-6">
                <FormField
                  name="country"
                  label="Country"
                  type="text"
                  value={destination?.country || ''}
                  onChange={handleChange}
                  placeholder={lang.en.placeholder.country}
                  required
                />
              </div>
            </div>

            <div className="mb-4">
              <Form.Label>
                Photos
              </Form.Label>
              <ImageUpload data={destination} setData={setDestination} />
              <small className="form-text text-muted">
                Upload photo(s) to this destination (optional)
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

              <small className="form-text text-muted d-block mb-2">
                Add helpful travel tips for this destination (optional)
              </small>

              {travelTips.length > 0 && (
                <ul className="list-group">
                  {travelTips.map((tip, index) => (
                    <li key={index} className="list-group-item d-flex justify-content-between align-items-center">
                      {tip}
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        onClick={() => deleteTravelTip(index)}
                      >
                        Delete
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={handleConfirmUpdate}
              disabled={Object.keys(changes).length === 0}
              aria-label={lang.en.button.confirmUpdate || 'Confirm Update'}
              aria-disabled={Object.keys(changes).length === 0}
            >
              {lang.en.button.confirmUpdate || 'Confirm Update'}
            </button>
          </Form>
        </div>
      </div>

      <Modal
        show={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onSubmit={confirmUpdate}
        title={lang.en.modal.confirmDestinationUpdate || 'Confirm Destination Update'}
        submitText={lang.en.button.updateDestination || 'Update Destination'}
        submitVariant="primary"
        cancelText={lang.en.button.cancel}
      >
        <p>{lang.en.modal.confirmUpdateReview || 'Please review your changes before updating:'}</p>
        <ul className="list-group">
          {Object.entries(changes).map(([field, change]) => (
            <li key={field} className="list-group-item">
              <strong>{formatFieldName(field)}:</strong>{' '}
              {typeof change.from === 'object' ? JSON.stringify(change.from) : (change.from || 'None')}{' '}
              →{' '}
              {typeof change.to === 'object' ? JSON.stringify(change.to) : (change.to || 'None')}
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}

import "./UpdateDestination.css";
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { updateDestination as updateDestAPI, showDestination } from "../../utilities/destinations-api";
import { useUser } from "../../contexts/UserContext";
import { useData } from "../../contexts/DataContext";
import { useToast } from "../../contexts/ToastContext";
import { lang } from "../../lang.constants";
import ImageUpload from "../../components/ImageUpload/ImageUpload";
import Alert from "../Alert/Alert";
import { handleError } from "../../utilities/error-handler";
import { formatChanges } from "../../utilities/change-formatter";
import Modal from "../Modal/Modal";
import FormField from "../FormField/FormField";
import TravelTipsManager from "../TravelTipsManager/TravelTipsManager";
import { Form } from "react-bootstrap";
import { isOwner } from "../../utilities/permissions";
import { isSuperAdmin } from "../../utilities/permissions";

// Custom hooks
import { useChangeTrackingHandler } from "../../hooks/useFormChangeHandler";
import { useTravelTipsManager } from "../../hooks/useTravelTipsManager";
import { useFormErrorHandling } from "../../hooks/useFormErrorHandling";

export default function UpdateDestination() {
  const { user } = useUser();
  const { updateDestination } = useData();
  const { success, error: showError } = useToast();
  const { destinationId } = useParams();
  const [destination, setDestination] = useState(null);
  const [originalDestination, setOriginalDestination] = useState(null);
  const [changes, setChanges] = useState({});
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Use custom hooks
  const handleChange = useChangeTrackingHandler(
    destination,
    setDestination,
    originalDestination,
    changes,
    setChanges
  );

  const {
    travelTips,
    newTravelTip,
    setTravelTips,
    addTravelTip: addTip,
    deleteTravelTip,
    handleNewTipChange,
    handleNewTipKeyPress,
    // Structured tip management
    tipMode,
    setTipMode,
    structuredTip,
    addStructuredTip,
    updateStructuredTipField,
    updateCallToAction
  } = useTravelTipsManager([]);

  const handleFormError = useFormErrorHandling(setError, {
    onEmailNotVerified: (data) => {
      const verifyError = data.error || lang.en.alert.emailNotVerifiedMessage;
      setError(verifyError);
      showError(verifyError);
    },
    onDuplicateError: (err) => {
      const message = err.message;
      setError(message);
      showError(message);
    }
  });

  useEffect(() => {
    async function fetchData() {
      try {
        const destinationData = await showDestination(destinationId);

        // Check if user is the owner or Super Admin
        const canEdit = isOwner(user, destinationData) || isSuperAdmin(user);

        if (!canEdit) {
          setError(lang.en.alert.notAuthorizedToUpdateDestination);
          setLoading(false);
          return;
        }

        setDestination(destinationData);
        setOriginalDestination(destinationData);
        setTravelTips(destinationData.travel_tips || []);
        setLoading(false);
      } catch (err) {
        const errorMessage = handleError(err, { context: 'Loading destination for update' });
        setError(errorMessage || lang.en.alert.failedToLoadResource);
        setLoading(false);
      }
    }

    if (user && destinationId) {
      fetchData();
    }
  }, [destinationId, user, setTravelTips]);

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

  // Track travel tips changes
  useEffect(() => {
    if (!originalDestination) return;

    const newChanges = { ...changes };

    if (JSON.stringify(travelTips) !== JSON.stringify(originalDestination.travel_tips || [])) {
      newChanges.travel_tips = {
        from: originalDestination.travel_tips || [],
        to: travelTips
      };
    } else {
      delete newChanges.travel_tips;
    }

    if (JSON.stringify(newChanges) !== JSON.stringify(changes)) {
      setChanges(newChanges);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [travelTips, originalDestination]);

  function handleAddTravelTip() {
    if (newTravelTip.trim()) {
      addTip();
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    try {
      const dataToUpdate = {
        ...destination,
        travel_tips: travelTips
      };

      const updated = await updateDestAPI(destinationId, dataToUpdate);
      updateDestination(updated); // Instant UI update!
      success(lang.en.success.destinationUpdated);
      navigate(`/destinations/${destinationId}`);
    } catch (err) {
      handleFormError(err, { context: 'Update destination' });
      showError(handleError(err, { context: 'Update destination' }));
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
        <div className="col-md-12 fade-in">
          <h1 className="my-4 h fade-in text-center">{lang.en.heading.updateDestination || 'Update Destination'}</h1>
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
              <li key={idx} style={{ whiteSpace: 'pre-line' }}>
                {formatChanges(field, changes[field], 'destination')}
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

            <TravelTipsManager
              tips={travelTips}
              newTip={newTravelTip}
              onNewTipChange={handleNewTipChange}
              onNewTipKeyPress={handleNewTipKeyPress}
              onAddTip={handleAddTravelTip}
              onDeleteTip={deleteTravelTip}
              label={lang.en.heading.travelTips}
              placeholder="Share an insider tip..."
              addButtonText="Add Tip"
              deleteButtonText="Delete"
              // Enhanced props for structured tips
              mode={tipMode}
              onModeChange={setTipMode}
              structuredTip={structuredTip}
              onStructuredTipFieldChange={updateStructuredTipField}
              onCallToActionChange={updateCallToAction}
              onAddStructuredTip={addStructuredTip}
            />

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
              <div style={{ whiteSpace: 'pre-line' }}>
                {formatChanges(field, change, 'destination')}
              </div>
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}

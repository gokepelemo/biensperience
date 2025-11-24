import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { updateDestination as updateDestAPI, showDestination } from "../../utilities/destinations-api";
import { useUser } from "../../contexts/UserContext";
import { useData } from "../../contexts/DataContext";
import { useToast } from "../../contexts/ToastContext";
import { lang } from "../../lang.constants";
import ImageUpload from "../../components/ImageUpload/ImageUpload";
import Alert from "../Alert/Alert";
import Loading from "../Loading/Loading";
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
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isMediaSettled, setIsMediaSettled] = useState(false);
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
    reorderTravelTips,
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
        setOriginalDestination({
          ...destinationData,
          photos: (destinationData.photos || []).map(photo => 
            photo._id ? photo._id : photo
          ) // Normalize original photos to IDs for consistent comparison
        });
        setTravelTips(destinationData.travel_tips || []);
        setLoading(false);
        // Mark initial load complete after a short delay to ensure all state is set
        setTimeout(() => setIsInitialLoad(false), 100);
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

  // Determine when media state is stable to avoid transient diff
  useEffect(() => {
    if (!destination || !originalDestination) return;

    const getId = (p) => {
      if (!p) return null;
      if (typeof p === 'string') return p;
      if (p._id) return String(p._id);
      return String(p);
    };
    const normalizePhotos = (arr = []) => arr.map(getId).filter(Boolean).sort();

    const originalPhotoIds = normalizePhotos(originalDestination.photos || []);
    const currentPhotoIds = normalizePhotos(destination.photos || []);

    const originalDefault = originalDestination.default_photo_id
      ? String(getId(originalDestination.default_photo_id))
      : (originalPhotoIds[0] || null);
    let currentDefault = destination.default_photo_id
      ? String(getId(destination.default_photo_id))
      : (currentPhotoIds[0] || null);
    if (currentPhotoIds.length === 0) currentDefault = null;

    const photosEqual = JSON.stringify(originalPhotoIds) === JSON.stringify(currentPhotoIds);
    const defaultsEqual = originalDefault === currentDefault;
    setIsMediaSettled(photosEqual && defaultsEqual);
  }, [destination, originalDestination]);

  // Track photo changes (robust: compare by stable IDs, ignore order)
  useEffect(() => {
    if (!destination || !originalDestination || isInitialLoad || !isMediaSettled) return;

    const newChanges = { ...changes };

    // Normalize photos by ID and ignore order
    const getId = (p) => {
      if (!p) return null;
      if (typeof p === 'string') return p;
      if (p._id) return String(p._id);
      return String(p);
    };
    const normalizePhotos = (arr = []) => arr.map(getId).filter(Boolean).sort();

    const originalPhotos = originalDestination.photos || [];
    const currentPhotos = destination.photos || [];

    const originalPhotoIds = normalizePhotos(originalPhotos);
    const currentPhotoIds = normalizePhotos(currentPhotos);

    const photosChanged = JSON.stringify(originalPhotoIds) !== JSON.stringify(currentPhotoIds);

    if (photosChanged) {
      const fromText = originalPhotoIds.length === 0 ? 'No photos' : `${originalPhotoIds.length} photo${originalPhotoIds.length > 1 ? 's' : ''}`;
      const toText = currentPhotoIds.length === 0 ? 'No photos' : `${currentPhotoIds.length} photo${currentPhotoIds.length > 1 ? 's' : ''}`;

      newChanges.photos = { from: fromText, to: toText };
    } else {
      delete newChanges.photos;
    }

    // Check if default photo changed by ID (fallback to first photo when unset)
    const originalDefaultId = originalDestination.default_photo_id;
    const currentDefaultId = destination.default_photo_id;

    const normalizedOriginalDefault = originalDefaultId
      ? String(getId(originalDefaultId))
      : (originalPhotoIds[0] || null);
    let normalizedCurrentDefault = currentDefaultId
      ? String(getId(currentDefaultId))
      : (currentPhotoIds[0] || null);

    // If there are no current photos, treat default as null
    if (currentPhotoIds.length === 0) normalizedCurrentDefault = null;

    if (
      normalizedOriginalDefault !== normalizedCurrentDefault &&
      currentPhotoIds.length > 0
    ) {
      const originalIndex = normalizedOriginalDefault
        ? originalPhotoIds.indexOf(normalizedOriginalDefault)
        : -1;
      const currentIndex = normalizedCurrentDefault
        ? currentPhotoIds.indexOf(normalizedCurrentDefault)
        : -1;

      newChanges.default_photo = {
        from: originalIndex >= 0 ? `Photo #${originalIndex + 1}` : 'None',
        to: currentIndex >= 0 ? `Photo #${currentIndex + 1}` : 'None'
      };
    } else {
      delete newChanges.default_photo;
    }

    // Only update if changes actually differ
    if (JSON.stringify(newChanges) !== JSON.stringify(changes)) {
      setChanges(newChanges);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination, originalDestination, isInitialLoad, isMediaSettled]);

  // Track travel tips changes
  useEffect(() => {
    if (!originalDestination || isInitialLoad) return;

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
      // Extract only the fields that should be updated
      // Convert populated photos to ObjectIds if needed
      const photosToSend = destination.photos.map(photo =>
        typeof photo === 'object' && photo._id ? photo._id : photo
      );

      const dataToUpdate = {
        name: destination.name,
        country: destination.country,
        state: destination.state,
        description: destination.description,
        photos: photosToSend,
        default_photo_id: destination.default_photo_id,
        travel_tips: travelTips,
        tags: destination.tags
      };

      const updated = await updateDestAPI(destinationId, dataToUpdate);
      updateDestination(updated); // Instant UI update!
      const message = lang.en.notification?.destination?.updated?.replace('{name}', updated.name) || `Your changes to ${updated.name} have been saved.`;
      success(message);
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
        <Loading size="lg" message="Loading destination..." />
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
      <div className="row animation-fade_in">
        <div className="col-12">
          <h1 className="form-title">{lang.en.heading.updateDestination || 'Update Destination'}</h1>
        </div>
      </div>

      {error && (
        <Alert
          type="danger"
          message={error}
          className="mb-4"
        />
      )}

      {!isInitialLoad && isMediaSettled && Object.keys(changes).length > 0 && (
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

      <div className="row my-4 animation-fade_in">
        <div className="col-12">
          <Form onSubmit={handleSubmit} className="form-unified">
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

            <FormField
              name="description"
              label="Description"
              type="textarea"
              value={destination?.description || ''}
              onChange={handleChange}
              placeholder={lang.en.placeholder.destinationDescription}
              rows={4}
              tooltip={lang.en.helper.descriptionOptional}
              tooltipPlacement="top"
            />

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
              onReorder={reorderTravelTips}
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

            <div className="d-flex justify-content-between mt-4">
              <Link
                to={`/destinations/${destination._id}`}
                className="btn btn-secondary btn-lg"
                aria-label={lang.en.button.cancel}
              >
                {lang.en.button.cancel}
              </Link>
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
            </div>
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

import "./UpdateExperience.css";
import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { updateExperience as updateExpAPI, showExperience } from "../../utilities/experiences-api";
import { useUser } from "../../contexts/UserContext";
import { useData } from "../../contexts/DataContext";
import { useToast } from "../../contexts/ToastContext";
import { lang } from "../../lang.constants";
import ImageUpload from "../../components/ImageUpload/ImageUpload";
import TagInput from "../../components/TagInput/TagInput";
import Alert from "../Alert/Alert";
import Loading from "../Loading/Loading";
import { handleError } from "../../utilities/error-handler";
import { formatChanges } from "../../utilities/change-formatter";
import Modal from "../Modal/Modal";
import FormField from "../FormField/FormField";
import { isOwner } from "../../utilities/permissions";
import { Form } from "react-bootstrap";
import { isSuperAdmin } from "../../utilities/permissions";
import NewDestinationModal from "../NewDestinationModal/NewDestinationModal";

// Custom hooks
import { useChangeTrackingHandler } from "../../hooks/useFormChangeHandler";
import { useFormErrorHandling } from "../../hooks/useFormErrorHandling";

export default function UpdateExperience() {
  const { user } = useUser();
  const { destinations: destData, updateExperience } = useData();
  const { success, error: showError } = useToast();
  const { experienceId } = useParams();
  const [experience, setExperience] = useState(null);
  const [destinations, setDestinations] = useState([]);
  const [tags, setTags] = useState([]);
  const [originalExperience, setOriginalExperience] = useState(null);
  const [changes, setChanges] = useState({});
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDestinationModal, setShowDestinationModal] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Custom hooks
  const handleChange = useChangeTrackingHandler(
    experience,
    setExperience,
    originalExperience,
    changes,
    setChanges
  );

  const handleFormError = useFormErrorHandling(setError, {
    onEmailNotVerified: (data) => {
      showError(data.error || lang.en.alert.emailNotVerifiedMessage);
    }
  });

  useEffect(() => {
    async function fetchData() {
      try {
        const experienceData = await showExperience(experienceId);

        // Check if user is the owner or Super Admin
        const canEdit = isOwner(user, experienceData) || isSuperAdmin(user);

        if (!canEdit) {
          setError(lang.en.alert.notAuthorizedToUpdateExperience);
          setLoading(false);
          return;
        }

        // Normalize destination to ID for easier handling
        const normalizedExperience = {
          ...experienceData,
          destination: typeof experienceData.destination === 'object'
            ? experienceData.destination._id
            : experienceData.destination
        };

        setExperience(normalizedExperience);
        setOriginalExperience(experienceData);
        if (destData) setDestinations(destData);

        // Set tags from experience_type
        if (experienceData.experience_type) {
          let experienceTags = [];
          if (Array.isArray(experienceData.experience_type)) {
            experienceTags = experienceData.experience_type;
          } else if (typeof experienceData.experience_type === 'string') {
            experienceTags = experienceData.experience_type.split(',').map(tag => tag.trim());
          }
          setTags(experienceTags);
        }

        setLoading(false);
      } catch (err) {
        const errorMessage = handleError(err, { context: 'Loading experience for update' });
        setError(errorMessage || lang.en.alert.failedToLoadResource);
        setLoading(false);
      }
    }

    if (user && experienceId) {
      fetchData();
    }
  }, [experienceId, user, navigate, destData]);

  // Track photo changes
  useEffect(() => {
    if (!experience || !originalExperience) return;

    const newChanges = { ...changes };

    // Check if photos array changed
    const originalPhotos = originalExperience.photos || [];
    const currentPhotos = experience.photos || [];

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
    const originalIndex = originalExperience.default_photo_index || 0;
    const currentIndex = experience.default_photo_index || 0;

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
  }, [experience, originalExperience]);

  // Track tags changes
  useEffect(() => {
    if (!originalExperience) return;

    const newChanges = { ...changes };
    const originalTags = Array.isArray(originalExperience?.experience_type)
      ? originalExperience.experience_type
      : [];
    const tagsChanged = JSON.stringify(originalTags.sort()) !== JSON.stringify([...tags].sort());

    if (tagsChanged) {
      newChanges.experience_type = { from: originalTags.join(', '), to: tags.join(', ') };
    } else {
      delete newChanges.experience_type;
    }

    if (JSON.stringify(newChanges) !== JSON.stringify(changes)) {
      setChanges(newChanges);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tags, originalExperience]);

  function handleTagsChange(newTags) {
    setTags(newTags);
    const updatedExperience = { ...experience, experience_type: newTags };
    setExperience(updatedExperience);
  }

  function handleDestinationChange(selectedDestination) {
    // Check if user selected "Create New Destination"
    if (selectedDestination === '+ Create New Destination') {
      setShowDestinationModal(true);
      return;
    }

    const destination = destinations.find(d => d.name === selectedDestination.split(", ")[0]);
    if (destination) {
      const updatedExperience = { ...experience, destination: destination._id };

      // Track changes with readable destination names
      const newChanges = { ...changes };
      const originalDestId = typeof originalExperience?.destination === 'object'
        ? originalExperience.destination._id
        : originalExperience?.destination;
      const originalDestName = typeof originalExperience?.destination === 'object'
        ? `${originalExperience.destination.name}, ${originalExperience.destination.country}`
        : destinations.find(d => d._id === originalDestId)?.name || 'Unknown';

      if (originalExperience && originalDestId !== destination._id) {
        newChanges.destination = {
          from: originalDestName,
          to: `${destination.name}, ${destination.country}`
        };
      } else {
        delete newChanges.destination;
      }

      setExperience(updatedExperience);
      setChanges(newChanges);
    }
  }

  function handleDestinationCreated(newDestination) {
    // Add to local destinations list
    setDestinations(prev => [...prev, newDestination]);

    // Set as selected destination and track change
    const updatedExperience = { ...experience, destination: newDestination._id };

    const newChanges = { ...changes };
    const originalDestId = typeof originalExperience?.destination === 'object'
      ? originalExperience.destination._id
      : originalExperience?.destination;
    const originalDestName = typeof originalExperience?.destination === 'object'
      ? `${originalExperience.destination.name}, ${originalExperience.destination.country}`
      : destinations.find(d => d._id === originalDestId)?.name || 'Unknown';

    newChanges.destination = {
      from: originalDestName,
      to: `${newDestination.name}, ${newDestination.country}`
    };

    setExperience(updatedExperience);
    setChanges(newChanges);
  }

  function handleCreateDestinationClick(e) {
    e.preventDefault();
    setShowDestinationModal(true);
  }

  // Get current destination display value for prefilling modal
  const getCurrentDestinationValue = () => {
    const dest = destinations.find(d => d._id === experience.destination);
    return dest ? dest.name : ''; // Just the city name, not the full "City, Country" format
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (Object.keys(changes).length === 0) {
      setError(lang.en.alert.noChangesDetected);
      return;
    }

    try {
      // Extract only the fields that should be updated
      // Convert populated references to ObjectIds
      const photosToSend = experience.photos.map(photo =>
        typeof photo === 'object' && photo._id ? photo._id : photo
      );

      const destinationToSend = typeof experience.destination === 'object' && experience.destination._id
        ? experience.destination._id
        : experience.destination;

      const dataToUpdate = {
        name: experience.name,
        destination: destinationToSend,
        map_location: experience.map_location,
        experience_type: experience.experience_type,
        plan_items: experience.plan_items,
        photos: photosToSend,
        default_photo_id: experience.default_photo_id,
        visibility: experience.visibility
      };

      const updated = await updateExpAPI(experienceId, dataToUpdate);
      updateExperience(updated); // Instant UI update!
      success(lang.en.success.experienceUpdated);
      navigate(`/experiences/${experienceId}`);
    } catch (err) {
      handleFormError(err, { context: 'Update experience' });
      showError(handleError(err, { context: 'Update experience' }));
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
      <div className="container mt-5">
        <Loading variant="centered" size="lg" message="Loading experience..." />
      </div>
    );
  }

  if (error || !experience) {
    return (
      <div className="container mt-5">
        <div className="row justify-content-center">
          <div className="col-md-8">
            <Alert
              type="danger"
              title={lang.en.modal.unableToUpdateExperience}
            >
              <p>{error || lang.en.modal.experienceNotFoundOrNoPermission}</p>
              <hr />
              <p className="mb-0">Please check that you have the correct permissions and try again.</p>
            </Alert>
            <div className="text-center mt-3">
              {experienceId && !error.includes('not authorized') && (
                <Link to={`/experiences/${experienceId}`} className="btn btn-primary me-2">
                  {lang.en.button.backToExperience}
                </Link>
              )}
              <Link to="/experiences" className="btn btn-secondary">
                {lang.en.button.viewAllExperiences}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="row fade-in">
        <div className="col-md-12 fade-in">
          <h1 className="my-4 h fade-in text-center">{lang.en.heading.updateExperience}</h1>
        </div>
      </div>

      {Object.keys(changes).length > 0 && (
        <Alert
          type="info"
          className="mb-4 fade-in"
        >
          <strong>Changes detected:</strong>
          <ul className="mb-0 mt-2">
            {Object.keys(changes).map((field, idx) => (
              <li key={idx} style={{ whiteSpace: 'pre-line' }}>
                {formatChanges(field, changes[field], 'experience')}
              </li>
            ))}
          </ul>
        </Alert>
      )}

      <div className="row my-4 fade-in">
        <div className="col-12">
          <Form onSubmit={handleSubmit} className="update-experience-form">
            <FormField
              name="name"
              label={lang.en.label.title}
              type="text"
              value={experience.name || ''}
              onChange={handleChange}
              placeholder={lang.en.placeholder.experienceName}
              required
              tooltip={lang.en.helper.nameRequired}
              tooltipPlacement="top"
            />

            <div className="mb-4">
              <Form.Label htmlFor="destination">
                {lang.en.label.destinationLabel}
              </Form.Label>
              <Form.Select
                id="destination"
                name="destination"
                label={lang.en.label.destinationLabel}
                tooltip={`${lang.en.helper.destinationRequired}${lang.en.helper.createNewDestination}`}
                value={(() => {
                  const dest = destinations.find(d => d._id === experience.destination);
                  return dest ? `${dest.name}, ${dest.country}` : '';
                })()}
                onChange={(e) => handleDestinationChange(e.target.value)}
                required
              >
                <option value="">{lang.en.placeholder.destination}</option>
                {destinations.map(destination => (
                  <option key={destination._id} value={`${destination.name}, ${destination.country}`}>
                    {destination.name}, {destination.country}
                  </option>
                ))}
                <option value="+ Create New Destination">+ Create New Destination</option>
              </Form.Select>
              <small className="form-text text-muted">
                {lang.en.helper.destinationRequired}
                <button
                  type="button"
                  onClick={handleCreateDestinationClick}
                  className="btn btn-link p-0 ms-1 align-baseline"
                  style={{ textDecoration: 'none' }}
                >
                  {lang.en.helper.createNewDestination}
                </button>
              </small>
            </div>

            <div className="mb-4">
              <Form.Label htmlFor="experience_type">
                {lang.en.label.experienceTypes}
              </Form.Label>
              <TagInput
                tags={tags}
                label={lang.en.label.experienceTypes}
                onChange={handleTagsChange}
                placeholder={lang.en.placeholder.experienceType}
              />
              <small className="form-text text-muted">
                {lang.en.helper.experienceTypesOptional}
              </small>
            </div>

            <FormField
              name="map_location"
              label={lang.en.label.address}
              type="text"
              value={experience.map_location || ''}
              onChange={handleChange}
              placeholder={lang.en.placeholder.address}
              tooltip={lang.en.helper.addressOptional}
              tooltipPlacement="top"
            />

            <div className="row mb-4">
              <div className="col-md-6 mb-3 mb-md-0">
                <FormField
                  name="max_planning_days"
                  label={lang.en.label.planningDays}
                  type="number"
                  value={experience.max_planning_days || ''}
                  onChange={handleChange}
                  placeholder={lang.en.placeholder.planningDays}
                  min="1"
                  append="days"
                  tooltip={lang.en.helper.planningDaysOptional}
                  tooltipPlacement="top"
                />
              </div>

              <div className="col-md-6">
                <FormField
                  name="cost_estimate"
                  label={lang.en.label.costEstimate}
                  type="number"
                  value={experience.cost_estimate || ''}
                  onChange={handleChange}
                  placeholder={lang.en.placeholder.costEstimate}
                  min="0"
                  prepend="$"
                  tooltip={lang.en.helper.costEstimateOptional}
                  tooltipPlacement="top"
                />
              </div>
            </div>

            <div className="mb-4">
              <Form.Label>
                Photos
              </Form.Label>
              <ImageUpload
                data={experience}
                setData={setExperience}
              />
              <small className="form-text text-muted">
                Upload multiple photos for this experience (optional)
              </small>
            </div>

            {error && (
              <Alert
                type="danger"
                message={error}
                className="mb-4"
              />
            )}

            <div className="d-flex justify-content-between mt-4">
              <Link
                to={`/experiences/${experienceId}`}
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
                aria-label={lang.en.button.confirmUpdate}
                aria-disabled={Object.keys(changes).length === 0}
              >
                {lang.en.button.confirmUpdate}
              </button>
            </div>
          </Form>
        </div>
      </div>

      <Modal
        show={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onSubmit={confirmUpdate}
        title={lang.en.modal.confirmExperienceUpdate}
        submitText={lang.en.button.updateExperience}
        submitVariant="primary"
        cancelText={lang.en.button.cancel}
      >
        <p>{lang.en.modal.confirmUpdateReview}</p>
        <ul className="list-group">
          {Object.entries(changes).map(([field, change]) => (
            <li key={field} className="list-group-item">
              <div style={{ whiteSpace: 'pre-line' }}>
                {formatChanges(field, change, 'experience')}
              </div>
            </li>
          ))}
        </ul>
      </Modal>

      <NewDestinationModal
        show={showDestinationModal}
        onClose={() => setShowDestinationModal(false)}
        onDestinationCreated={handleDestinationCreated}
        prefillName={getCurrentDestinationValue()}
      />
    </>
  );
}

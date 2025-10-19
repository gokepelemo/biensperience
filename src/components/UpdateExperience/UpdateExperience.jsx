import "./UpdateExperience.css";
import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { updateExperience, showExperience } from "../../utilities/experiences-api";
import { getDestinations } from "../../utilities/destinations-api";
import { lang } from "../../lang.constants";
import ImageUpload from "../../components/ImageUpload/ImageUpload";
import TagInput from "../../components/TagInput/TagInput";
import Alert from "../Alert/Alert";
import { handleError } from "../../utilities/error-handler";
import Modal from "../Modal/Modal";
import FormField from "../FormField/FormField";
import { Form } from "react-bootstrap";
import { isSuperAdmin } from "../../utilities/permissions";

export default function UpdateExperience({ user, updateData }) {
  const { experienceId } = useParams();
  const [experience, setExperience] = useState(null);
  const [destinations, setDestinations] = useState([]);
  const [tags, setTags] = useState([]);
  const [originalExperience, setOriginalExperience] = useState(null);
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
        const [experienceData, destinationsData] = await Promise.all([
          showExperience(experienceId),
          getDestinations()
        ]);

        // Check if user is the owner or Super Admin
        const isOwner = experienceData.user && experienceData.user._id === user._id;
        const canEdit = isOwner || isSuperAdmin(user);

        if (!canEdit) {
          setError("You are not authorized to update this experience.");
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
        setDestinations(destinationsData);

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
        setError(errorMessage || "Failed to load experience. Please try again.");
        setLoading(false);
      }
    }

    if (user && experienceId) {
      fetchData();
    }
  }, [experienceId, user, navigate]);

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

  function handleChange(e) {
    const { name, value } = e.target;
    const updatedExperience = { ...experience, [name]: value };

    // Track changes
    const newChanges = { ...changes };
    if (originalExperience && originalExperience[name] !== value) {
      newChanges[name] = { from: originalExperience[name], to: value };
    } else {
      delete newChanges[name];
    }

    setExperience(updatedExperience);
    setChanges(newChanges);
  }

  function handleTagsChange(newTags) {
    setTags(newTags);
    // Store as array, not comma-separated string
    const updatedExperience = { ...experience, experience_type: newTags };

    // Track changes (compare arrays properly)
    const newChanges = { ...changes };
    const originalTags = Array.isArray(originalExperience?.experience_type)
      ? originalExperience.experience_type
      : [];
    const tagsChanged = JSON.stringify(originalTags.sort()) !== JSON.stringify([...newTags].sort());

    if (originalExperience && tagsChanged) {
      newChanges.experience_type = { from: originalTags.join(', '), to: newTags.join(', ') };
    } else {
      delete newChanges.experience_type;
    }

    setExperience(updatedExperience);
    setChanges(newChanges);
  }

  function handleDestinationChange(selectedDestination) {
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

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (Object.keys(changes).length === 0) {
      setError("No changes detected.");
      return;
    }

    try {
      await updateExperience(experienceId, experience);
      updateData && updateData();
      navigate(`/experiences/${experienceId}`);
    } catch (err) {
      handleError(err, { context: 'Update experience' });
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
        <div className="row justify-content-center">
          <div className="col-md-6 text-center">
            <div className="spinner-border" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        </div>
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
              title="Unable to Update Experience"
            >
              <p>{error || "Experience not found or you don't have permission to update it."}</p>
              <hr />
              <p className="mb-0">Please check that you have the correct permissions and try again.</p>
            </Alert>
            <div className="text-center mt-3">
              {experienceId && !error.includes('not authorized') && (
                <Link to={`/experiences/${experienceId}`} className="btn btn-primary me-2">
                  Back to Experience
                </Link>
              )}
              <Link to="/experiences" className="btn btn-secondary">
                View All Experiences
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
        <div className="col-md-6 fade-in">
          <h1 className="my-4 h fade-in">{lang.en.heading.updateExperience}</h1>
        </div>
      </div>

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
              </Form.Select>
              <small className="form-text text-muted">
                {lang.en.helper.destinationRequired}
                <Link to="/destinations/new" className="ms-1">
                  {lang.en.helper.createNewDestination}
                </Link>
              </small>
            </div>

            <div className="mb-4">
              <Form.Label htmlFor="experience_type">
                {lang.en.label.experienceTypes}
              </Form.Label>
              <TagInput
                tags={tags}
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
                  append={<span className="input-group-text">days</span>}
                  helpText="Minimum days needed to plan in advance (optional)"
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
                  prepend={<span className="input-group-text">$</span>}
                  helpText="Estimated cost in dollars (optional)"
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
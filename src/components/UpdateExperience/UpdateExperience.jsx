import "./UpdateExperience.module.scss";
import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { createFilter } from "../../utilities/trie";
import { updateExperience as updateExpAPI, showExperience } from "../../utilities/experiences-api";
import { useUser } from "../../contexts/UserContext";
import { useData } from "../../contexts/DataContext";
import { useToast } from "../../contexts/ToastContext";
import { lang } from "../../lang.constants";
import ImageUpload from "../../components/ImageUpload/ImageUpload";
import TagInput from "../../components/TagInput/TagInput";
import Autocomplete from "../../components/Autocomplete/Autocomplete";
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
  const { destinations: destData, experiences: expData, updateExperience } = useData();
  const { success, error: showError } = useToast();
  const { experienceId } = useParams();
  const [experience, setExperience] = useState(null);
  const [destinations, setDestinations] = useState([]);
  const [destinationSearchTerm, setDestinationSearchTerm] = useState('');
  const [tags, setTags] = useState([]);
  const [originalExperience, setOriginalExperience] = useState(null);
  const [changes, setChanges] = useState({});
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isMediaSettled, setIsMediaSettled] = useState(false);
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

  // Build trie index for fast destination search
  const destinationTrieFilter = useMemo(() => {
    if (!destinations || destinations.length === 0) return null;
    const destItems = destinations.map(dest => ({
      id: dest._id,
      name: dest.name,
      country: dest.country,
      flag: dest.flag,
      experienceCount: expData.filter(exp =>
        (typeof exp.destination === 'object' ? exp.destination._id : exp.destination) === dest._id
      ).length
    }));
    return createFilter({
      fields: [
        { path: 'name', score: 100 },
        { path: 'country', score: 50 },
      ]
    }).buildIndex(destItems);
  }, [destinations, expData]);

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
        setOriginalExperience({
          ...experienceData,
          photos: (experienceData.photos || []).map(photo => 
            photo._id ? photo._id : photo
          ) // Normalize original photos to IDs for consistent comparison
        });
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
        // Mark initial load complete after a short delay to ensure all state is set
        setTimeout(() => setIsInitialLoad(false), 100);
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

  // Determine when photos/default are fully normalized and aligned with original
  useEffect(() => {
    if (!experience || !originalExperience) return;

    const getId = (p) => {
      if (!p) return null;
      if (typeof p === 'string') return p;
      if (p._id) return String(p._id);
      return String(p);
    };
    const normalizePhotos = (arr = []) => arr.map(getId).filter(Boolean).sort();

    const originalPhotoIds = normalizePhotos(originalExperience.photos || []);
    const currentPhotoIds = normalizePhotos(experience.photos || []);

    const originalDefault = originalExperience.default_photo_id
      ? String(getId(originalExperience.default_photo_id))
      : (originalPhotoIds[0] || null);
    let currentDefault = experience.default_photo_id
      ? String(getId(experience.default_photo_id))
      : (currentPhotoIds[0] || null);
    if (currentPhotoIds.length === 0) currentDefault = null;

    const photosEqual = JSON.stringify(originalPhotoIds) === JSON.stringify(currentPhotoIds);
    const defaultsEqual = originalDefault === currentDefault;
    setIsMediaSettled(photosEqual && defaultsEqual);
  }, [experience, originalExperience]);

  // Track photo changes (robust: compare by stable IDs, ignore order)
  useEffect(() => {
    if (!experience || !originalExperience || isInitialLoad || !isMediaSettled) return;

    const newChanges = { ...changes };

    // Normalize photos by ID and ignore order
    const getId = (p) => {
      if (!p) return null;
      if (typeof p === 'string') return p;
      if (p._id) return String(p._id);
      return String(p);
    };
    const normalizePhotos = (arr = []) => arr.map(getId).filter(Boolean).sort();

    const originalPhotos = originalExperience.photos || [];
    const currentPhotos = experience.photos || [];

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
    const originalDefaultId = originalExperience.default_photo_id;
    const currentDefaultId = experience.default_photo_id;

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
  }, [experience, originalExperience, isInitialLoad, isMediaSettled]);

  // Track tags changes
  useEffect(() => {
    if (!experience || !originalExperience || isInitialLoad) return;

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
        overview: experience.overview,
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
      const message = lang.en.notification?.experience?.updated?.replace('{name}', updated.name) || `Your changes to ${updated.name} have been saved.`;
      success(message);
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
      <div className="row animation-fade_in">
        <div className="col-12">
          <h1 className="form-title">{lang.en.heading.updateExperience}</h1>
        </div>
      </div>

      {!isInitialLoad && isMediaSettled && Object.keys(changes).length > 0 && (
        <Alert
          type="info"
          className="mb-4 animation-fade_in"
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

      <div className="row my-4 animation-fade_in">
        <div className="col-12">
          <Form onSubmit={handleSubmit} className="form-unified">
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
              <Form.Group>
                <Form.Label>
                  {lang.en.label.overview}
                </Form.Label>
                <Form.Control
                  as="textarea"
                  name="overview"
                  rows={4}
                  value={experience.overview || ''}
                  onChange={handleChange}
                  placeholder={lang.en.placeholder.overview}
                />
                <small className="form-text text-muted">
                  {lang.en.helper.overviewOptional}
                </small>
              </Form.Group>
            </div>

            <div className="mb-4">
              <Form.Group>
                <Form.Label>
                  {lang.en.label.destinationLabel}
                  {' '}
                  <span className="text-danger">*</span>
                </Form.Label>
                <Autocomplete
                  placeholder={lang.en.placeholder.destination}
                  entityType="destination"
                  items={(() => {
                    // Use trie filtering for O(m) performance
                    let filteredDestItems;
                    if (destinationSearchTerm && destinationSearchTerm.trim() && destinationTrieFilter) {
                      filteredDestItems = destinationTrieFilter.filter(destinationSearchTerm, { rankResults: true });
                    } else if (destinationSearchTerm && destinationSearchTerm.trim()) {
                      // Fallback to linear search if trie not available
                      const allDestItems = destinations.map(dest => ({
                        id: dest._id,
                        name: dest.name,
                        country: dest.country,
                        flag: dest.flag,
                        experienceCount: expData.filter(exp =>
                          (typeof exp.destination === 'object' ? exp.destination._id : exp.destination) === dest._id
                        ).length
                      }));
                      const searchLower = destinationSearchTerm.toLowerCase();
                      filteredDestItems = allDestItems.filter(dest => {
                        const searchableText = [dest.name, dest.country].filter(Boolean).join(' ').toLowerCase();
                        return searchableText.includes(searchLower);
                      });
                    } else {
                      // No search term - return all destinations
                      filteredDestItems = destinations.map(dest => ({
                        id: dest._id,
                        name: dest.name,
                        country: dest.country,
                        flag: dest.flag,
                        experienceCount: expData.filter(exp =>
                          (typeof exp.destination === 'object' ? exp.destination._id : exp.destination) === dest._id
                        ).length
                      }));
                    }

                    // If search term exists (2+ chars) and no matching destinations, add "Create New" option
                    if (destinationSearchTerm && destinationSearchTerm.length >= 2 && filteredDestItems.length === 0) {
                      return [{
                        id: 'create-new',
                        name: `✚ Create "${destinationSearchTerm}"`,
                        country: 'New Destination',
                        flag: '🌍',
                        experienceCount: 0,
                        isCreateOption: true
                      }];
                    }

                    return filteredDestItems;
                  })()}
                  value={(() => {
                    const dest = destinations.find(d => d._id === experience.destination);
                    return dest ? `${dest.name}, ${dest.country}` : '';
                  })()}
                  onSelect={(destination) => {
                    // Check if it's the "Create New" option
                    if (destination.isCreateOption) {
                      handleCreateDestinationClick(new Event('click'));
                      return;
                    }
                    
                    const prevDestination = destinations.find(d => d._id === experience.destination);
                    const destId = destination._id || destination.id;
                    
                    // Track change
                    setExperience({
                      ...experience,
                      destination: destId
                    });
                    
                    // Update changes tracking
                    const newChanges = { ...changes };
                    if (originalExperience.destination !== destId) {
                      const newDest = destinations.find(d => d._id === destId);
                      newChanges.destination = {
                        from: prevDestination ? `${prevDestination.name}, ${prevDestination.country}` : 'None',
                        to: newDest ? `${newDest.name}, ${newDest.country}` : 'Unknown'
                      };
                    } else {
                      delete newChanges.destination;
                    }
                    setChanges(newChanges);
                  }}
                  onSearch={(query) => {
                    // Update search term for filtering and "Create New Destination" button
                    setDestinationSearchTerm(query);
                  }}
                  size="md"
                  emptyMessage="Type to search for destinations..."
                  disableFilter={true}
                />
                <small className="form-text text-muted mt-2 d-block">
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
              </Form.Group>
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
                maxTags={4}
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
                  tooltip={lang.en.helper.planningTimeTooltip}
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

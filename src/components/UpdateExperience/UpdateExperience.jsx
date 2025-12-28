import { FormTooltip } from '../Tooltip/Tooltip';
import "./UpdateExperience.module.scss";
import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { createFilter } from "../../utilities/trie";
import { updateExperience as updateExpAPI, showExperience } from "../../utilities/experiences-api";
import { useUser } from "../../contexts/UserContext";
import { useData } from "../../contexts/DataContext";
import { useToast } from "../../contexts/ToastContext";
import { lang } from "../../lang.constants";
import PhotoUpload from "../../components/PhotoUpload/PhotoUpload";
import TagInput from "../../components/TagInput/TagInput";
import Autocomplete from "../../components/Autocomplete/Autocomplete";
import Banner from "../Banner/Banner";
import Alert from "../Alert/Alert";
import Loading from "../Loading/Loading";
import { handleError } from "../../utilities/error-handler";
import { formatChanges } from "../../utilities/change-formatter";
import Modal from "../Modal/Modal";
import FormField from "../FormField/FormField";
import { isOwner, isSuperAdmin } from "../../utilities/permissions";
import { Form } from "react-bootstrap";
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
  const [hasCalculatedChanges, setHasCalculatedChanges] = useState(false);
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
      showError(data.error || lang.current.alert.emailNotVerifiedMessage);
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
          setError(lang.current.alert.notAuthorizedToUpdateExperience);
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
        // Delay marking as loaded to prevent change detection during hydration
        // Use requestAnimationFrame to sync with browser render cycle
        requestAnimationFrame(() => {
          setTimeout(() => {
            setIsInitialLoad(false);
            setHasCalculatedChanges(true);
          }, 150);
        });
      } catch (err) {
        const errorMessage = handleError(err, { context: 'Loading experience for update' });
        setError(errorMessage || lang.current.alert.failedToLoadResource);
        setLoading(false);
      }
    }

    if (user && experienceId) {
      fetchData();
    }
  }, [experienceId, user, navigate, destData]);

  // Track photo changes (robust: compare by stable IDs, ignore order)
  useEffect(() => {
    if (!experience || !originalExperience || isInitialLoad) return;

    // Debounce change detection to prevent flashing during rapid updates
    const timeoutId = setTimeout(() => {
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

      const defaultPhotoChanged = normalizedOriginalDefault !== normalizedCurrentDefault && currentPhotoIds.length > 0;

      // Use functional update to avoid stale closure issues with changes
      setChanges(prevChanges => {
        const newChanges = { ...prevChanges };

        if (photosChanged) {
          const fromText = originalPhotoIds.length === 0 ? 'No photos' : `${originalPhotoIds.length} photo${originalPhotoIds.length > 1 ? 's' : ''}`;
          const toText = currentPhotoIds.length === 0 ? 'No photos' : `${currentPhotoIds.length} photo${currentPhotoIds.length > 1 ? 's' : ''}`;
          newChanges.photos = { from: fromText, to: toText };
        } else {
          delete newChanges.photos;
        }

        if (defaultPhotoChanged) {
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

        // Only return new object if changes actually differ
        if (JSON.stringify(newChanges) !== JSON.stringify(prevChanges)) {
          return newChanges;
        }
        return prevChanges;
      });
    }, 100); // 100ms debounce

    return () => clearTimeout(timeoutId);
  }, [experience, originalExperience, isInitialLoad]);

  // Track tags changes
  useEffect(() => {
    if (!experience || !originalExperience || isInitialLoad) return;

    // Debounce change detection to prevent flashing
    const timeoutId = setTimeout(() => {
      const originalTags = Array.isArray(originalExperience?.experience_type)
        ? originalExperience.experience_type
        : [];
      const tagsChanged = JSON.stringify(originalTags.sort()) !== JSON.stringify([...tags].sort());

      // Use functional update to avoid stale closure issues with changes
      setChanges(prevChanges => {
        const newChanges = { ...prevChanges };

        if (tagsChanged) {
          newChanges.experience_type = { from: originalTags.join(', '), to: tags.join(', ') };
        } else {
          delete newChanges.experience_type;
        }

        // Only return new object if changes actually differ
        if (JSON.stringify(newChanges) !== JSON.stringify(prevChanges)) {
          return newChanges;
        }
        return prevChanges;
      });
    }, 100); // 100ms debounce

    return () => clearTimeout(timeoutId);
  }, [tags, originalExperience, isInitialLoad]);

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
      setError(lang.current.alert.noChangesDetected);
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
      const message = lang.current.notification?.experience?.updated?.replace('{name}', updated.name) || `Your changes to ${updated.name} have been saved.`;
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
              title={lang.current.modal.unableToUpdateExperience}
            >
              <p>{error || lang.current.modal.experienceNotFoundOrNoPermission}</p>
              <hr />
              <p className="mb-0">Please check that you have the correct permissions and try again.</p>
            </Alert>
            <div className="text-center mt-3">
              {experienceId && !error.includes('not authorized') && (
                <Link to={`/experiences/${experienceId}`} className="btn btn-primary me-2">
                  {lang.current.button.backToExperience}
                </Link>
              )}
              <Link to="/experiences" className="btn btn-secondary">
                {lang.current.button.viewAllExperiences}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="row animation-fade-in">
        <div className="col-12">
          <h1 className="form-title">{lang.current.heading.updateExperience}</h1>
        </div>
      </div>

      {hasCalculatedChanges && !isInitialLoad && Object.keys(changes).length > 0 && (
        <Banner
          type="info"
          variant="bordered"
          title={lang.current.alert.changesDetected}
          className="mb-4"
          showIcon={true}
        >
          <ul className="mb-0 mt-2" style={{ paddingLeft: '1.5rem' }}>
            {Object.keys(changes).map((field, idx) => (
              <li key={idx} style={{ whiteSpace: 'pre-line' }}>
                {formatChanges(field, changes[field], 'experience')}
              </li>
            ))}
          </ul>
        </Banner>
      )}

      <div className="row my-4 animation-fade-in">
        <div className="col-12">
          <Form onSubmit={handleSubmit} className="form-unified">
            <FormField
                name="name"
                label={lang.current.label.title}
                type="text"
                value={experience.name || ''}
                onChange={handleChange}
                placeholder={lang.current.placeholder.experienceName}
                required
                tooltip={lang.current.tooltip.experienceName}
                tooltipPlacement="top"
              />

            <div className="mb-4">
              <Form.Group>
                <Form.Label>
                  {lang.current.label.overview}
                  {' '}
                  <FormTooltip content={lang.current.tooltip.overview} placement="top" />
                </Form.Label>
                <FormField
                  name="overview"
                  type="textarea"
                  value={experience.overview || ''}
                  onChange={handleChange}
                  placeholder={lang.current.placeholder.overview}
                  rows={4}
                  showCounter
                  maxLength={300}
                />
                <small className="form-text text-muted">
                  {lang.current.helper.overviewOptional}
                </small>
              </Form.Group>
            </div>

            <div className="mb-4">
              <Form.Group>
                <Form.Label htmlFor="destination-autocomplete">
                  {lang.current.label.destinationLabel}
                  {' '}
                  <span className="text-danger">*</span>
                  {' '}
                  <FormTooltip
                    content={lang.current.tooltip.destination}
                    placement="top"
                  />
                </Form.Label>
                <Autocomplete
                  inputId="destination-autocomplete"
                  placeholder={lang.current.placeholder.destination}
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
                  {lang.current.helper.destinationRequired}
                  <button
                    type="button"
                    onClick={handleCreateDestinationClick}
                    className="btn btn-link p-0 ms-1 align-baseline"
                    style={{ textDecoration: 'none' }}
                  >
                    {lang.current.helper.createNewDestination}
                  </button>
                </small>
              </Form.Group>
            </div>

            <div className="mb-4">
              <Form.Label htmlFor="experience_type">
                {lang.current.label.experienceTypes}
                {' '}
                <FormTooltip
                  content={lang.current.tooltip.experienceTypes}
                  placement="top"
                />
              </Form.Label>
              <TagInput
                tags={tags}
                label={lang.current.label.experienceTypes}
                onChange={handleTagsChange}
                placeholder={lang.current.placeholder.experienceType}
                maxTags={4}
              />
              <small className="form-text text-muted">
                {lang.current.helper.experienceTypesOptional}
              </small>
            </div>

            <FormField
              name="map_location"
              label={lang.current.label.address}
              type="text"
              value={experience.map_location || ''}
              onChange={handleChange}
              placeholder={lang.current.placeholder.address}
              tooltip={lang.current.helper.addressOptional}
              tooltipPlacement="top"
            />

            {/* Planning days and cost estimate removed from update form — computed from plan items (virtuals). */}

            <div className="mb-4">
              <Form.Label>
                Photos
                {' '}
                <FormTooltip
                  content={lang.current.tooltip.photos}
                  placement="top"
                />
              </Form.Label>
                <PhotoUpload
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
                aria-label={lang.current.button.cancel}
              >
                {lang.current.button.cancel}
              </Link>
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={handleConfirmUpdate}
                disabled={Object.keys(changes).length === 0}
                aria-label={lang.current.button.confirmUpdate}
                aria-disabled={Object.keys(changes).length === 0}
              >
                {lang.current.button.confirmUpdate}
              </button>
            </div>
          </Form>
        </div>
      </div>

      <Modal
        show={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onSubmit={confirmUpdate}
        title={lang.current.modal.confirmExperienceUpdate}
        submitText={lang.current.button.updateExperience}
        submitVariant="primary"
        cancelText={lang.current.button.cancel}
      >
        <p>{lang.current.modal.confirmUpdateReview}</p>
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

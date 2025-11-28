import "./NewExperience.module.scss";
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "../../contexts/DataContext";
import { useUser } from "../../contexts/UserContext";
import { useToast } from "../../contexts/ToastContext";
import { createExperience } from "../../utilities/experiences-api";
import { lang } from "../../lang.constants";
import ImageUpload from "../../components/ImageUpload/ImageUpload";
import TagInput from "../../components/TagInput/TagInput";
import Autocomplete from "../../components/Autocomplete/Autocomplete";
import Alert from "../Alert/Alert";
import { handleError } from "../../utilities/error-handler";
import { isDuplicateName } from "../../utilities/deduplication";
import FormField from "../FormField/FormField";
import { FormTooltip } from "../Tooltip/Tooltip";
import { Form } from "react-bootstrap";
import { useFormPersistence } from "../../hooks/useFormPersistence";
import { formatRestorationMessage } from "../../utilities/time-format";
import NewDestinationModal from "../NewDestinationModal/NewDestinationModal";
import SuccessModal from "../SuccessModal/SuccessModal";
import { createFilter } from "../../utilities/trie";

// Custom hooks
import { useFormChangeHandler } from "../../hooks/useFormChangeHandler";
import { useDestinationManagement } from "../../hooks/useDestinationManagement";
import { useFormErrorHandling } from "../../hooks/useFormErrorHandling";

export default function NewExperience() {
  const { destinations: destData, experiences: expData, addExperience } = useData();
  const { user } = useUser();
  const { success } = useToast();
  const [newExperience, setNewExperience] = useState({});
  const [destinations, setDestinations] = useState([]);
  const [experiences, setExperiences] = useState([]);
  const [destinationSearchTerm, setDestinationSearchTerm] = useState('');
  const [tags, setTags] = useState([]);
  const [error, setError] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdExperience, setCreatedExperience] = useState(null);
  const navigate = useNavigate();

  // Custom hooks for form handling
  const handleChange = useFormChangeHandler(newExperience, setNewExperience, {
    onFieldChange: (name, value) => {
      // Track destination input for modal prefill
      if (name === 'destination') {
        setDestinationInput(value);
      }
    }
  });

  // Destination management hook
  const {
    showDestinationModal,
    destinationInput,
    prefillName,
    getDestinationOptions,
    handleDestinationChange,
    handleDestinationCreated,
    handleCreateDestinationClick,
    closeDestinationModal,
    setDestinationInput
  } = useDestinationManagement(destinations, newExperience, setNewExperience, setDestinations);

  // Error handling hook
  const handleFormError = useFormErrorHandling(setError, {
    onEmailNotVerified: (data) => {
      setError(data.error || lang.en.alert.emailNotVerifiedMessage);
    },
    onDuplicateError: (err) => {
      setError(err.message);
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

  // Form persistence - combines newExperience and tags
  const formData = { ...newExperience, experience_type: tags };
  const setFormData = (data) => {
    const { experience_type, ...expData } = data;
    setNewExperience(expData);
    if (experience_type) {
      setTags(experience_type);
    }
  };

  const persistence = useFormPersistence(
    'new-experience-form',
    formData,
    setFormData,
    {
      enabled: true,
      userId: user?._id, // Encryption and user-specific storage
      ttl: 24 * 60 * 60 * 1000, // 24 hours
      debounceMs: 1000,
      excludeFields: [], // File objects auto-excluded by persistence hook
      onRestore: (savedData, age) => {
        // Show toast notification with clear option and friendly time formatting
        const message = formatRestorationMessage(age, 'create');
        success(message, {
          duration: 20000,
          actions: [{
            label: lang.en.button.clearForm,
            onClick: () => {
              setNewExperience({});
              setTags([]);
              persistence.clear();
            },
            variant: 'link'
          }]
        });
      }
    }
  );

  function handleTagsChange(newTags) {
    setTags(newTags);
    setNewExperience({
      ...newExperience,
      experience_type: newTags // Store as array, not comma-separated string
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    // Frontend duplicate check
    if (newExperience.name && isDuplicateName(experiences, newExperience.name)) {
      setError(`An experience named "${newExperience.name}" already exists. Please choose a different name.`);
      return;
    }

    try {
      setNewExperience(
        Object.assign(newExperience, {
          destination: destinations.find(
            (destination) =>
              destination.name === newExperience.destination.split(", ")[0]
          )._id,
        })
      );
      let experience = await createExperience(newExperience);
      addExperience(experience); // Instant UI update!

      // Clear saved form data on success
      persistence.clear();

      // Show success modal instead of navigating directly
      setCreatedExperience(experience);
      setShowSuccessModal(true);
    } catch (err) {
      handleFormError(err, { context: 'Create experience' });
    }
  }

  useEffect(() => {
    if (destData) setDestinations(destData);
    if (expData) setExperiences(expData);
    document.title = `New Experience - Biensperience`;
  }, [destData, expData]);

  return (
    <>
      <div className="row animation-fade_in">
        <div className="col-12">
          <h1 className="form-title">{lang.en.heading.createExperience}</h1>
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

      <div className="row my-4 animation-fade_in justify-content-center">
        <div className="col-12">
          <Form onSubmit={handleSubmit} className="form-unified">
            <FormField
              name="name"
              label={lang.en.label.title}
              type="text"
              value={newExperience.name || ''}
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
                  {' '}
                  <FormTooltip
                    text={lang.en.helper.overviewOptional}
                    placement="top"
                  />
                </Form.Label>
                <Form.Control
                  as="textarea"
                  name="overview"
                  rows={4}
                  value={newExperience.overview || ''}
                  onChange={handleChange}
                  placeholder={lang.en.placeholder.overview}
                />
              </Form.Group>
            </div>

            <div className="mb-4">
              <Form.Group>
                <Form.Label>
                  {lang.en.label.destinationLabel}
                  {' '}
                  <span className="text-danger">*</span>
                  {' '}
                  <FormTooltip
                    text={`${lang.en.helper.destinationRequired}${lang.en.helper.createNewDestination}`}
                    placement="top"
                  />
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
                  onSelect={(destination) => {
                    // Check if it's the "Create New" option
                    if (destination.isCreateOption) {
                      handleCreateDestinationClick(new Event('click'));
                      return;
                    }
                    
                    setNewExperience({
                      ...newExperience,
                      destination: destination._id || destination.id
                    });
                  }}
                  onSearch={(query) => {
                    // Update search term for filtering and "Create New Destination" button
                    setDestinationSearchTerm(query);
                    setDestinationInput(query);
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

            <FormField
              name="map_location"
              label={lang.en.label.address}
              type="text"
              value={newExperience.map_location || ''}
              onChange={handleChange}
              placeholder={lang.en.placeholder.address}
              tooltip={lang.en.helper.addressOptional}
              tooltipPlacement="top"
            />

            <div className="mb-4">
              <Form.Label htmlFor="experience_type">
                {lang.en.label.experienceTypes}
                <FormTooltip
                  content={lang.en.helper.experienceTypesOptional}
                  placement="top"
                />
              </Form.Label>
              <TagInput
                tags={tags}
                onChange={handleTagsChange}
                placeholder={lang.en.placeholder.experienceType}
                maxTags={4}
              />
            </div>

            <div className="mb-4">
              <Form.Label>
                Photos
                <FormTooltip
                  content={lang.en.helper.photosOptional}
                  placement="top"
                />
              </Form.Label>
              <ImageUpload data={newExperience} setData={setNewExperience} />
            </div>

            <FormField
              name="max_planning_days"
              label={lang.en.label.planningDays}
              type="number"
              value={newExperience.max_planning_days || ''}
              onChange={handleChange}
              placeholder={lang.en.placeholder.planningDays}
              min="1"
              tooltip={lang.en.helper.planningTimeTooltip}
              tooltipPlacement="top"
              append="days"
            />

            <FormField
              name="cost_estimate"
              label={lang.en.label.costEstimate}
              type="number"
              value={newExperience.cost_estimate || ''}
              onChange={handleChange}
              placeholder={lang.en.placeholder.costEstimate}
              min="0"
              tooltip={lang.en.helper.costEstimateOptional}
              tooltipPlacement="top"
              prepend="$"
            />

            <div className="d-flex justify-content-end mt-4">
              <button
                type="submit"
                className="btn btn-primary btn-lg"
                aria-label={lang.en.button.createExperience}
              >
                {lang.en.button.createExperience}
              </button>
            </div>
          </Form>
        </div>
      </div>

      <NewDestinationModal
        show={showDestinationModal}
        onClose={closeDestinationModal}
        onDestinationCreated={handleDestinationCreated}
        prefillName={prefillName}
      />

      <SuccessModal
        show={showSuccessModal}
        onClose={() => {
          setShowSuccessModal(false);
          // Reset form for creating another
          setNewExperience({});
          setTags([]);
          setCreatedExperience(null);
        }}
        title="Experience Created!"
        message="Your experience has been created successfully"
        entityName={createdExperience?.name}
        entityType="experience"
        entityId={createdExperience?._id}
      />
    </>
  );
}

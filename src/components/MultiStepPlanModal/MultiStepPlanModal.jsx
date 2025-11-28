import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { FaCheck, FaArrowLeft } from 'react-icons/fa';
import { useData } from '../../contexts/DataContext';
import { useUser } from '../../contexts/UserContext';
import { useToast } from '../../contexts/ToastContext';
import { usePlanExperience } from '../../contexts/PlanExperienceContext';
import { createExperience } from '../../utilities/experiences-api';
import { createPlan } from '../../utilities/plans-api';
import { isDuplicateName } from '../../utilities/deduplication';
import { createFilter } from '../../utilities/trie';
import { lang } from '../../lang.constants';
import { Button } from '../design-system';
import FormField from '../FormField/FormField';
import { FormTooltip } from '../Tooltip/Tooltip';
import Autocomplete from '../Autocomplete/Autocomplete';
import TagInput from '../TagInput/TagInput';
import ImageUpload from '../ImageUpload/ImageUpload';
import NewDestinationModal from '../NewDestinationModal/NewDestinationModal';
import Alert from '../Alert/Alert';
import { Form } from 'react-bootstrap';
import styles from './MultiStepPlanModal.module.scss';

const STEPS = {
  CREATE_EXPERIENCE: 1,
  SELECT_DATE: 2,
};

/**
 * MultiStepPlanModal - A multi-step modal for creating an experience and planning it
 *
 * Step 1: Create Experience (with optional destination creation)
 * Step 2: Select planned date and create the plan
 */
export default function MultiStepPlanModal() {
  const navigate = useNavigate();
  const { destinations: destData, experiences: expData, addExperience } = useData();
  const { user } = useUser();
  const { success, error: showError } = useToast();
  const { isModalOpen, initialStep, prefilledData, closePlanExperienceModal } = usePlanExperience();

  // Step management
  const [currentStep, setCurrentStep] = useState(initialStep);

  // Experience form state
  const [newExperience, setNewExperience] = useState({});
  const [tags, setTags] = useState([]);
  const [destinationSearchTerm, setDestinationSearchTerm] = useState('');
  const [destinationInput, setDestinationInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Created experience (from step 1 or prefilled)
  const [createdExperience, setCreatedExperience] = useState(null);

  // Plan date state
  const [plannedDate, setPlannedDate] = useState('');

  // Destination modal state
  const [showDestinationModal, setShowDestinationModal] = useState(false);
  const [prefillDestinationName, setPrefillDestinationName] = useState('');

  // Local destinations state (includes newly created ones)
  const [destinations, setDestinations] = useState([]);

  // Sync initial step when modal opens
  useEffect(() => {
    if (isModalOpen) {
      setCurrentStep(initialStep);
      if (prefilledData?.experience) {
        setCreatedExperience(prefilledData.experience);
      }
      if (prefilledData?.destinationId) {
        setNewExperience(prev => ({ ...prev, destination: prefilledData.destinationId }));
      }
    }
  }, [isModalOpen, initialStep, prefilledData]);

  // Sync destinations from context
  useEffect(() => {
    if (destData) setDestinations(destData);
  }, [destData]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isModalOpen) {
      setNewExperience({});
      setTags([]);
      setDestinationSearchTerm('');
      setDestinationInput('');
      setError('');
      setCreatedExperience(null);
      setPlannedDate('');
      setCurrentStep(1);
    }
  }, [isModalOpen]);

  // Build trie index for destination search
  const destinationTrieFilter = useMemo(() => {
    if (!destinations || destinations.length === 0) return null;
    const destItems = destinations.map(dest => ({
      id: dest._id,
      name: dest.name,
      country: dest.country,
      flag: dest.flag,
      experienceCount: (expData || []).filter(exp =>
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

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setNewExperience(prev => ({ ...prev, [name]: value }));
    setError('');
  }, []);

  const handleTagsChange = useCallback((newTags) => {
    setTags(newTags);
    setNewExperience(prev => ({ ...prev, experience_type: newTags }));
  }, []);

  const handleCreateDestinationClick = useCallback(() => {
    setPrefillDestinationName(destinationInput || destinationSearchTerm);
    setShowDestinationModal(true);
  }, [destinationInput, destinationSearchTerm]);

  const handleDestinationCreated = useCallback((newDestination) => {
    // Add to local destinations
    setDestinations(prev => [...prev, newDestination]);
    // Select the new destination
    setNewExperience(prev => ({ ...prev, destination: newDestination._id }));
    setDestinationSearchTerm(`${newDestination.name}, ${newDestination.country}`);
    setShowDestinationModal(false);
  }, []);

  // Step 1: Create Experience
  const handleCreateExperience = async () => {
    setError('');
    setLoading(true);

    // Validation
    if (!newExperience.name?.trim()) {
      setError('Please enter an experience name');
      setLoading(false);
      return;
    }

    if (!newExperience.destination) {
      setError('Please select a destination');
      setLoading(false);
      return;
    }

    // Check for duplicates
    if (isDuplicateName(expData || [], newExperience.name)) {
      setError(`An experience named "${newExperience.name}" already exists. Please choose a different name.`);
      setLoading(false);
      return;
    }

    try {
      // Prepare experience data
      const experienceData = {
        ...newExperience,
        experience_type: tags,
      };

      const experience = await createExperience(experienceData);
      addExperience(experience);

      setCreatedExperience(experience);
      setCurrentStep(STEPS.SELECT_DATE);
      success('Experience created! Now select a date to plan it.');
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to create experience';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Create Plan
  const handleCreatePlan = async () => {
    if (!createdExperience) {
      setError('No experience selected');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await createPlan(createdExperience._id, plannedDate || null);
      success(`You're now planning "${createdExperience.name}"!`);
      closePlanExperienceModal();
      // Navigate to the experience page
      navigate(`/experiences/${createdExperience._id}`);
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to create plan';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Skip date and create plan without date
  const handleSkipDate = async () => {
    setPlannedDate('');
    await handleCreatePlan();
  };

  // Go back to step 1
  const handleBack = () => {
    setCurrentStep(STEPS.CREATE_EXPERIENCE);
    setError('');
  };

  // Get filtered destination items for autocomplete
  const getFilteredDestinations = useCallback(() => {
    let filteredDestItems;
    if (destinationSearchTerm && destinationSearchTerm.trim() && destinationTrieFilter) {
      filteredDestItems = destinationTrieFilter.filter(destinationSearchTerm, { rankResults: true });
    } else if (destinationSearchTerm && destinationSearchTerm.trim()) {
      const allDestItems = destinations.map(dest => ({
        id: dest._id,
        name: dest.name,
        country: dest.country,
        flag: dest.flag,
        experienceCount: (expData || []).filter(exp =>
          (typeof exp.destination === 'object' ? exp.destination._id : exp.destination) === dest._id
        ).length
      }));
      const searchLower = destinationSearchTerm.toLowerCase();
      filteredDestItems = allDestItems.filter(dest => {
        const searchableText = [dest.name, dest.country].filter(Boolean).join(' ').toLowerCase();
        return searchableText.includes(searchLower);
      });
    } else {
      filteredDestItems = destinations.map(dest => ({
        id: dest._id,
        name: dest.name,
        country: dest.country,
        flag: dest.flag,
        experienceCount: (expData || []).filter(exp =>
          (typeof exp.destination === 'object' ? exp.destination._id : exp.destination) === dest._id
        ).length
      }));
    }

    // Add "Create New" option if no matches
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
  }, [destinationSearchTerm, destinationTrieFilter, destinations, expData]);

  if (!isModalOpen) return null;

  const modalContent = (
    <div className={`${styles.modalContainer} modal show d-block`} tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content" style={{ borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
          {/* Header */}
          <div className="modal-header" style={{ borderBottom: '1px solid var(--color-border-light)' }}>
            <h5 className="modal-title" style={{ fontWeight: 'var(--font-weight-bold)' }}>
              {currentStep === STEPS.CREATE_EXPERIENCE ? 'Create New Experience' : 'Plan Your Experience'}
            </h5>
            <button
              type="button"
              className="btn-close"
              onClick={closePlanExperienceModal}
              aria-label="Close"
            />
          </div>

          {/* Step Indicator */}
          <div className={styles.stepIndicator}>
            <div className={`${styles.step} ${currentStep >= 1 ? styles.active : ''} ${currentStep > 1 ? styles.completed : ''}`}>
              <span className={styles.stepNumber}>
                {currentStep > 1 ? <FaCheck size={12} /> : '1'}
              </span>
              <span className={styles.stepLabel}>Create Experience</span>
            </div>
            <div className={`${styles.stepConnector} ${currentStep > 1 ? styles.active : ''}`} />
            <div className={`${styles.step} ${currentStep >= 2 ? styles.active : ''}`}>
              <span className={styles.stepNumber}>2</span>
              <span className={styles.stepLabel}>Select Date</span>
            </div>
          </div>

          {/* Body */}
          <div className="modal-body" style={{ padding: 'var(--space-5)' }}>
            {error && (
              <Alert type="danger" className="mb-4" dismissible onDismiss={() => setError('')}>
                {error}
              </Alert>
            )}

            <div className={styles.stepContent}>
              {currentStep === STEPS.CREATE_EXPERIENCE && (
                <Form onSubmit={(e) => { e.preventDefault(); handleCreateExperience(); }}>
                  <FormField
                    name="name"
                    label={lang.current.label.title}
                    type="text"
                    value={newExperience.name || ''}
                    onChange={handleChange}
                    placeholder={lang.current.placeholder.experienceName}
                    required
                    tooltip={lang.current.helper.nameRequired}
                  />

                  <div className="mb-4">
                    <Form.Group>
                      <Form.Label>
                        {lang.current.label.destinationLabel}
                        {' '}<span className="text-danger">*</span>{' '}
                        <FormTooltip
                          text={`${lang.current.helper.destinationRequired} ${lang.current.helper.createNewDestination}`}
                          placement="top"
                        />
                      </Form.Label>
                      <Autocomplete
                        placeholder={lang.current.placeholder.destination}
                        entityType="destination"
                        items={getFilteredDestinations()}
                        onSelect={(destination) => {
                          if (destination.isCreateOption) {
                            handleCreateDestinationClick();
                            return;
                          }
                          setNewExperience(prev => ({
                            ...prev,
                            destination: destination._id || destination.id
                          }));
                          setDestinationSearchTerm(`${destination.name}, ${destination.country}`);
                        }}
                        onSearch={(query) => {
                          setDestinationSearchTerm(query);
                          setDestinationInput(query);
                        }}
                        size="md"
                        emptyMessage="Type to search destinations..."
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

                  <FormField
                    name="map_location"
                    label={lang.current.label.address}
                    type="text"
                    value={newExperience.map_location || ''}
                    onChange={handleChange}
                    placeholder={lang.current.placeholder.address}
                    tooltip={lang.current.helper.addressOptional}
                  />

                  <div className="mb-4">
                    <Form.Label htmlFor="experience_type">
                      {lang.current.label.experienceTypes}
                        <FormTooltip content={lang.current.helper.experienceTypesOptional} placement="top" />
                    </Form.Label>
                    <TagInput
                      tags={tags}
                      onChange={handleTagsChange}
                      placeholder={lang.current.placeholder.experienceType}
                    />
                  </div>

                  <div className="mb-4">
                      <Form.Label>
                      Photos
                      <FormTooltip content={lang.current.helper.photosOptional} placement="top" />
                    </Form.Label>
                    <ImageUpload data={newExperience} setData={setNewExperience} />
                  </div>

                  <div className="row">
                    <div className="col-md-6">
                      <FormField
                        name="max_planning_days"
                        label={lang.current.label.planningDays}
                        type="number"
                        value={newExperience.max_planning_days || ''}
                        onChange={handleChange}
                        placeholder={lang.current.placeholder.planningDays}
                        min="1"
                        tooltip={lang.current.helper.planningTimeTooltip}
                        append="days"
                      />
                    </div>
                    <div className="col-md-6">
                      <FormField
                        name="cost_estimate"
                        label={lang.current.label.costEstimate}
                        type="number"
                        value={newExperience.cost_estimate || ''}
                        onChange={handleChange}
                        placeholder={lang.current.placeholder.costEstimate}
                        min="0"
                        tooltip={lang.current.helper.costEstimateOptional}
                        prepend="$"
                      />
                    </div>
                  </div>
                </Form>
              )}

              {currentStep === STEPS.SELECT_DATE && createdExperience && (
                <div>
                  <div className={styles.experienceSummary}>
                    <div className={styles.summaryTitle}>{createdExperience.name}</div>
                    <div className={styles.summaryDestination}>
                      {createdExperience.destination?.name
                        ? `${createdExperience.destination.name}, ${createdExperience.destination.country}`
                        : 'Destination selected'}
                    </div>
                  </div>

                  <div className={styles.datePickerContainer}>
                    <label className={styles.formLabel}>
                      When are you planning this experience?
                    </label>
                    <input
                      type="date"
                      className={styles.dateInput}
                      value={plannedDate}
                      onChange={(e) => setPlannedDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                    />
                    <p className={styles.helpText}>
                      You can always change this later from the experience page.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className={`modal-footer ${styles.modalFooter}`}>
            <div className={styles.footerLeft}>
              {currentStep === STEPS.SELECT_DATE && (
                <button type="button" className={styles.backButton} onClick={handleBack}>
                  <FaArrowLeft size={12} className="me-2" />
                  Back
                </button>
              )}
            </div>
            <div className={styles.footerRight}>
              {currentStep === STEPS.CREATE_EXPERIENCE && (
                <Button
                  variant="gradient"
                  size="lg"
                  onClick={handleCreateExperience}
                  disabled={loading || !newExperience.name || !newExperience.destination}
                >
                  {loading ? 'Creating...' : 'Create & Continue'}
                </Button>
              )}
              {currentStep === STEPS.SELECT_DATE && (
                <>
                  <button
                    type="button"
                    className={styles.skipDateLink}
                    onClick={handleSkipDate}
                    disabled={loading}
                  >
                    Skip for now
                  </button>
                  <Button
                    variant="gradient"
                    size="lg"
                    onClick={handleCreatePlan}
                    disabled={loading}
                  >
                    {loading ? 'Creating Plan...' : plannedDate ? 'Plan It!' : 'Plan Without Date'}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Nested Destination Modal */}
      <NewDestinationModal
        show={showDestinationModal}
        onClose={() => setShowDestinationModal(false)}
        onDestinationCreated={handleDestinationCreated}
        prefillName={prefillDestinationName}
      />
    </div>
  );

  return createPortal(modalContent, document.body);
}

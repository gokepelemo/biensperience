import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import {
  FaCheck,
  FaArrowLeft,
  FaArrowRight,
  FaPlus,
  FaMinus,
  FaTrash,
  FaCheckCircle,
  FaUserPlus,
  FaEnvelope
} from 'react-icons/fa';
import { Form } from 'react-bootstrap';
import { useData } from '../../contexts/DataContext';
import { useUser } from '../../contexts/UserContext';
import { useToast } from '../../contexts/ToastContext';
import { createExperience, addPlanItem as addExperiencePlanItem } from '../../utilities/experiences-api';
import { createPlan, addCollaborator, addPlanItem as addPlanPlanItem } from '../../utilities/plans-api';
import { searchUsers } from '../../utilities/users-api';
import { isDuplicateName } from '../../utilities/deduplication';
import { createFilter } from '../../utilities/trie';
import { lang } from '../../lang.constants';
import { Button, Pill } from '../design-system';
import FormField from '../FormField/FormField';
import { FormTooltip } from '../Tooltip/Tooltip';
import Autocomplete from '../Autocomplete/Autocomplete';
import TagInput from '../TagInput/TagInput';
import PhotoUpload from '../PhotoUpload/PhotoUpload';
import NewDestinationModal from '../NewDestinationModal/NewDestinationModal';
import Alert from '../Alert/Alert';
import styles from './ExperienceWizardModal.module.scss';

const STEPS = {
  BASIC_INFO: 1,
  MORE_DETAILS: 2,
  PLAN_ITEMS: 3,
  COLLABORATORS: 4,
  SUCCESS: 5,
};

const STEP_LABELS = {
  [STEPS.BASIC_INFO]: 'Basic Info',
  [STEPS.MORE_DETAILS]: 'Details',
  [STEPS.PLAN_ITEMS]: 'Plan Items',
  [STEPS.COLLABORATORS]: 'Collaborators',
  [STEPS.SUCCESS]: 'Done',
};

/**
 * ExperienceWizardModal - A comprehensive multi-step wizard for creating a fully featured experience
 *
 * Step 1: Basic Info (Title, Overview, Destination)
 * Step 2: More Details (Address, Experience Types, Photos)
 * Step 3: Plan Items (Add multiple items with +/- interface)
 * Step 4: Collaborators (Search users or invite by email)
 * Step 5: Success
 */
export default function ExperienceWizardModal({ show, onClose, initialValues = {} }) {
  const navigate = useNavigate();
  const { destinations: destData, experiences: expData, addExperience } = useData();
  const { user } = useUser();
  const { success, error: showError } = useToast();

  // Step management
  const [currentStep, setCurrentStep] = useState(STEPS.BASIC_INFO);

  // Experience form state (Steps 1 & 2)
  const [experienceData, setExperienceData] = useState({
    name: '',
    description: '',
    destination: '',
    map_location: '',
    experience_type: [],
  });
  const [tags, setTags] = useState([]);
  const [destinationSearchTerm, setDestinationSearchTerm] = useState('');
  const [destinationInput, setDestinationInput] = useState('');

  // Created experience reference
  const [createdExperience, setCreatedExperience] = useState(null);
  const [createdPlan, setCreatedPlan] = useState(null);

  // Plan items state (Step 3)
  const [planItems, setPlanItems] = useState([
    { id: Date.now(), content: '', planning_days: 1, cost_estimate: 0 }
  ]);

  // Collaborators state (Step 4)
  const [collaboratorSearchTerm, setCollaboratorSearchTerm] = useState('');
  const [collaboratorSearchResults, setCollaboratorSearchResults] = useState([]);
  const [selectedCollaborators, setSelectedCollaborators] = useState([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMode, setInviteMode] = useState('search'); // 'search' or 'email'

  // UI state
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDestinationModal, setShowDestinationModal] = useState(false);
  const [prefillDestinationName, setPrefillDestinationName] = useState('');

  // Local destinations state
  const [destinations, setDestinations] = useState([]);

  // Sync destinations from context
  useEffect(() => {
    if (destData) setDestinations(destData);
  }, [destData]);

  // Reset state when modal opens/closes. Prefill from `initialValues` when provided.
  useEffect(() => {
    if (!show) {
      setCurrentStep(STEPS.BASIC_INFO);
      setExperienceData({
        name: '',
        description: '',
        destination: '',
        map_location: '',
        experience_type: [],
      });
      setTags([]);
      setDestinationSearchTerm('');
      setDestinationInput('');
      setError('');
      setCreatedExperience(null);
      setCreatedPlan(null);
      setPlanItems([{ id: Date.now(), content: '', planning_days: 1, cost_estimate: 0 }]);
      setSelectedCollaborators([]);
      setCollaboratorSearchTerm('');
      setInviteEmail('');
      setInviteMode('search');
      setPrefillDestinationName('');
    } else {
      // When opening, apply any provided initialValues to prefill fields
      if (initialValues) {
        const pre = {
          name: initialValues.name || '',
          description: initialValues.description || '',
          destination: initialValues.destinationId || initialValues.destination || '',
          map_location: initialValues.map_location || '',
          experience_type: initialValues.experience_type || [],
        };
        setExperienceData(pre);
        // Prefill tags (experience types) when initial values are provided
        setTags(pre.experience_type || []);

        // If a destination name was provided, set search term to help Autocomplete
        if (initialValues.destinationName) {
          setDestinationSearchTerm(initialValues.destinationName);
          setDestinationInput(initialValues.destinationName);
        } else if (initialValues.destinationId) {
          // Try to derive name from dest list
          const destObj = (destinations || []).find(d => String(d._id) === String(initialValues.destinationId));
          if (destObj) {
            setDestinationSearchTerm(`${destObj.name}, ${destObj.country}`);
            setDestinationInput(`${destObj.name}, ${destObj.country}`);
          }
        }
      }
    }
  }, [show, initialValues, destinations]);

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

  // Handlers
  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setExperienceData(prev => ({ ...prev, [name]: value }));
    setError('');
  }, []);

  const handleTagsChange = useCallback((newTags) => {
    setTags(newTags);
    setExperienceData(prev => ({ ...prev, experience_type: newTags }));
  }, []);

  const handleCreateDestinationClick = useCallback(() => {
    setPrefillDestinationName(destinationInput || destinationSearchTerm);
    setShowDestinationModal(true);
  }, [destinationInput, destinationSearchTerm]);

  const handleDestinationCreated = useCallback((newDestination) => {
    setDestinations(prev => [...prev, newDestination]);
    setExperienceData(prev => ({ ...prev, destination: newDestination._id }));
    setDestinationSearchTerm(`${newDestination.name}, ${newDestination.country}`);
    setShowDestinationModal(false);
  }, []);

  // Get filtered destinations for autocomplete
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

    // Add "Create New" option if searching
    if (destinationSearchTerm && destinationSearchTerm.length >= 2 && filteredDestItems.length === 0) {
      return [{
        id: 'create-new',
        name: `+ Create "${destinationSearchTerm}"`,
        country: 'New Destination',
        flag: '',
        experienceCount: 0,
        isCreateOption: true
      }];
    }

    return filteredDestItems;
  }, [destinationSearchTerm, destinationTrieFilter, destinations, expData]);

  // Plan Items handlers
  const handleAddPlanItem = useCallback(() => {
    setPlanItems(prev => [...prev, {
      id: Date.now(),
      content: '',
      planning_days: 1,
      cost_estimate: 0
    }]);
  }, []);

  const handleRemovePlanItem = useCallback((itemId) => {
    setPlanItems(prev => prev.filter(item => item.id !== itemId));
  }, []);

  const handlePlanItemChange = useCallback((itemId, field, value) => {
    setPlanItems(prev => prev.map(item =>
      item.id === itemId ? { ...item, [field]: value } : item
    ));
  }, []);

  const incrementDays = useCallback((itemId) => {
    setPlanItems(prev => prev.map(item =>
      item.id === itemId ? { ...item, planning_days: (item.planning_days || 1) + 1 } : item
    ));
  }, []);

  const decrementDays = useCallback((itemId) => {
    setPlanItems(prev => prev.map(item =>
      item.id === itemId && item.planning_days > 1
        ? { ...item, planning_days: item.planning_days - 1 }
        : item
    ));
  }, []);

  // Collaborator handlers
  const handleSearchCollaborators = useCallback(async (query) => {
    setCollaboratorSearchTerm(query);
    if (!query || query.length < 2) {
      setCollaboratorSearchResults([]);
      return;
    }
    try {
      const results = await searchUsers(query);
      // Filter out current user and already selected
      const filtered = (results || []).filter(u =>
        u._id !== user?._id &&
        !selectedCollaborators.some(c => c._id === u._id)
      );
      setCollaboratorSearchResults(filtered);
    } catch (err) {
      setCollaboratorSearchResults([]);
    }
  }, [user, selectedCollaborators]);

  const handleSelectCollaborator = useCallback((collaborator) => {
    setSelectedCollaborators(prev => [...prev, collaborator]);
    setCollaboratorSearchTerm('');
    setCollaboratorSearchResults([]);
  }, []);

  const handleRemoveCollaborator = useCallback((userId) => {
    setSelectedCollaborators(prev => prev.filter(c => c._id !== userId));
  }, []);

  // Step navigation
  const canProceedStep1 = experienceData.name?.trim() && experienceData.destination;
  const canProceedStep2 = true; // Optional fields
  const canProceedStep3 = true; // Optional - can skip adding items

  // Step 1 & 2: Create Experience
  const handleCreateExperience = async () => {
    setError('');
    setLoading(true);

    // Validation
    if (!experienceData.name?.trim()) {
      setError('Please enter an experience name');
      setLoading(false);
      return;
    }

    if (!experienceData.destination) {
      setError('Please select a destination');
      setLoading(false);
      return;
    }

    // Check for duplicates
    if (isDuplicateName(expData || [], experienceData.name)) {
      setError(`An experience named "${experienceData.name}" already exists.`);
      setLoading(false);
      return;
    }

    try {
      const data = {
        ...experienceData,
        experience_type: tags,
      };

      // Defensive: remove client-only preview field `photos_full` before
      // sending to the API. The backend expects `photos` as an array of IDs
      // and `default_photo_id` for the default photo. `photos_full` is used
      // only client-side to preserve previews when navigating modal steps.
      const payload = { ...data };
      if (payload.photos_full) delete payload.photos_full;

      const experience = await createExperience(payload);
      addExperience(experience);
      setCreatedExperience(experience);

      // Create a plan for this experience
      const plan = await createPlan(experience._id);
      setCreatedPlan(plan);

      success('Experience created successfully!');
      setCurrentStep(STEPS.PLAN_ITEMS);
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to create experience';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Add Plan Items
  const handleSavePlanItems = async () => {
    setLoading(true);
    setError('');

    try {
      // Filter out empty items
      const validItems = planItems.filter(item => item.content?.trim());

      // Add each plan item to the experience
      const addedExperienceItems = [];
      for (const item of validItems) {
        const result = await addExperiencePlanItem(createdExperience._id, {
          text: item.content,
          planning_days: item.planning_days || 1,
          cost_estimate: parseFloat(item.cost_estimate) || 0,
        });
        // The last added item will be at the end of the plan_items array
        const newItem = result.plan_items[result.plan_items.length - 1];
        addedExperienceItems.push(newItem);
      }

      // Now add corresponding plan items to the user's plan
      for (const experienceItem of addedExperienceItems) {
        await addPlanPlanItem(createdPlan._id, {
          plan_item_id: experienceItem._id,
          text: experienceItem.text,
          planning_days: experienceItem.planning_days,
          cost: experienceItem.cost_estimate,
        });
      }

      if (validItems.length > 0) {
        success(`Added ${validItems.length} plan item(s) to your plan!`);
      }

      setCurrentStep(STEPS.COLLABORATORS);
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to add plan items';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Step 4: Add Collaborators
  const handleSaveCollaborators = async () => {
    setLoading(true);
    setError('');

    try {
      // Add selected collaborators to the plan
      for (const collaborator of selectedCollaborators) {
        await addCollaborator(createdPlan._id, collaborator._id);
      }

      if (selectedCollaborators.length > 0) {
        success(`Added ${selectedCollaborators.length} collaborator(s)!`);
      }

      setCurrentStep(STEPS.SUCCESS);
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to add collaborators';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Handle going back
  const handleBack = useCallback(() => {
    if (currentStep > STEPS.BASIC_INFO && currentStep !== STEPS.SUCCESS) {
      // Can't go back before experience is created (after step 2)
      if (currentStep === STEPS.PLAN_ITEMS) {
        // Can't go back to step 2 after experience is created
        return;
      }
      setCurrentStep(prev => prev - 1);
      setError('');
    }
  }, [currentStep]);

  // Handle skipping optional steps
  const handleSkipStep = useCallback(() => {
    if (currentStep === STEPS.PLAN_ITEMS) {
      setCurrentStep(STEPS.COLLABORATORS);
    } else if (currentStep === STEPS.COLLABORATORS) {
      setCurrentStep(STEPS.SUCCESS);
    }
  }, [currentStep]);

  // Handle final action - go to experience
  const handleGoToExperience = useCallback(() => {
    onClose();
    if (createdExperience) {
      navigate(`/experiences/${createdExperience._id}`);
    }
  }, [onClose, navigate, createdExperience]);

  // Close handler
  const handleClose = useCallback(() => {
    if (currentStep === STEPS.SUCCESS || !createdExperience) {
      onClose();
    } else {
      // Confirm closing if experience was created but wizard not complete
      if (window.confirm('Are you sure you want to close? Your experience has been created but you can add more details later.')) {
        onClose();
      }
    }
  }, [currentStep, createdExperience, onClose]);

  if (!show) return null;

  const renderStepIndicator = () => (
    <div className={styles.stepIndicator}>
      {[STEPS.BASIC_INFO, STEPS.MORE_DETAILS, STEPS.PLAN_ITEMS, STEPS.COLLABORATORS].map((step, index, arr) => (
        <React.Fragment key={step}>
          <div className={`${styles.step} ${currentStep >= step ? styles.active : ''} ${currentStep > step ? styles.completed : ''}`}>
            <span className={styles.stepNumber}>
              {currentStep > step ? <FaCheck size={12} /> : index + 1}
            </span>
            <span className={styles.stepLabel}>{STEP_LABELS[step]}</span>
          </div>
          {index < arr.length - 1 && (
            <div className={`${styles.stepConnector} ${currentStep > step ? styles.active : ''}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <Form onSubmit={(e) => { e.preventDefault(); setCurrentStep(STEPS.MORE_DETAILS); }}>
      <FormField
        name="name"
        label="Experience Title"
        type="text"
        value={experienceData.name || ''}
        onChange={handleChange}
        placeholder="e.g., Weekend in Paris, Tokyo Food Tour"
        required
        tooltip="Give your experience a memorable name"
      />

      <FormField
        name="description"
        label="Overview"
        type="textarea"
        value={experienceData.description || ''}
        onChange={handleChange}
        placeholder="Describe what makes this experience special..."
        rows={3}
        tooltip="A brief overview of your planned experience"
      />

      <div className="mb-4">
        <Form.Group>
          <Form.Label>
            Destination
            {' '}<span className="text-danger">*</span>{' '}
            <FormTooltip
              text="Select where this experience takes place"
              placement="top"
            />
          </Form.Label>
          <Autocomplete
            placeholder="Search for a destination..."
            entityType="destination"
            items={getFilteredDestinations()}
            displayValue={destinationSearchTerm}
            onSelect={(destination) => {
              // Handle clear/unselect which passes `null` from Autocomplete
              if (!destination) {
                setExperienceData(prev => ({ ...prev, destination: '' }));
                setDestinationSearchTerm('');
                return;
              }

              if (destination.isCreateOption) {
                handleCreateDestinationClick();
                return;
              }

              setExperienceData(prev => ({
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
            Can't find your destination?{' '}
            <a
              href="#"
              role="button"
              onClick={(e) => { e.preventDefault(); handleCreateDestinationClick(); }}
              className="btn btn-link p-0 align-baseline"
              style={{ textDecoration: 'none' }}
              aria-label="Create a new destination"
            >
              Create a new one
            </a>
          </small>
        </Form.Group>
      </div>
    </Form>
  );

  const renderStep2 = () => (
    <Form onSubmit={(e) => { e.preventDefault(); handleCreateExperience(); }}>
      <FormField
        name="map_location"
        label="Address"
        type="text"
        value={experienceData.map_location || ''}
        onChange={handleChange}
        placeholder="Specific address or area (optional)"
        tooltip="Add a specific location for this experience"
      />

      <div className="mb-4">
        <Form.Label htmlFor="experience_type">
          Experience Types
          <FormTooltip content="Tag your experience for easier discovery" placement="top" />
        </Form.Label>
        <TagInput
          tags={tags}
          onChange={handleTagsChange}
          placeholder="e.g., Adventure, Food, Culture"
          maxTags={4}
        />
      </div>

      <div className="mb-4">
        <Form.Label>
          Photos
          <FormTooltip content="Add photos to make your experience more appealing" placement="top" />
        </Form.Label>
        <PhotoUpload data={experienceData} setData={setExperienceData} />
      </div>
    </Form>
  );

  const renderStep3 = () => (
    <div className={styles.planItemsContainer}>
      <p className={styles.stepDescription}>
        Add items to your plan. These are things you want to do, places to visit, or activities to complete.
      </p>

      <div className={styles.planItemsList}>
        {planItems.map((item, index) => (
          <div key={item.id} className={styles.planItemRow}>
            <div className={styles.planItemNumber}>{index + 1}</div>

            <div className={styles.planItemContent}>
              <input
                type="text"
                className={styles.planItemInput}
                placeholder="What do you want to do?"
                value={item.content}
                onChange={(e) => handlePlanItemChange(item.id, 'content', e.target.value)}
              />

              <div className={styles.planItemMeta}>
                <div className={styles.metaField}>
                  <label>Days</label>
                  <div className={styles.counterControl}>
                    <button
                      type="button"
                      onClick={() => decrementDays(item.id)}
                      disabled={item.planning_days <= 1}
                      className={styles.counterBtn}
                    >
                      <FaMinus size={10} />
                    </button>
                    <span className={styles.counterValue}>{item.planning_days || 1}</span>
                    <button
                      type="button"
                      onClick={() => incrementDays(item.id)}
                      className={styles.counterBtn}
                    >
                      <FaPlus size={10} />
                    </button>
                  </div>
                </div>

                <div className={styles.metaField}>
                  <label>Est. Cost</label>
                  <div className={styles.costInput}>
                    <span className={styles.currencySymbol}>$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0"
                      value={item.cost_estimate || ''}
                      onChange={(e) => handlePlanItemChange(item.id, 'cost_estimate', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            {planItems.length > 1 && (
              <button
                type="button"
                className={styles.removeItemBtn}
                onClick={() => handleRemovePlanItem(item.id)}
                title="Remove item"
              >
                <FaTrash size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        className={styles.addItemBtn}
        onClick={handleAddPlanItem}
      >
        <FaPlus size={14} />
        Add Another Item
      </button>
    </div>
  );

  const renderStep4 = () => (
    <div className={styles.collaboratorsContainer}>
      <p className={styles.stepDescription}>
        Invite others to collaborate on your experience. They'll be able to view and contribute to your plan.
      </p>

      <div className={styles.inviteModeToggle}>
        <button
          type="button"
          className={`${styles.modeBtn} ${inviteMode === 'search' ? styles.active : ''}`}
          onClick={() => setInviteMode('search')}
        >
          <FaUserPlus size={14} />
          Search Users
        </button>
        <button
          type="button"
          className={`${styles.modeBtn} ${inviteMode === 'email' ? styles.active : ''}`}
          onClick={() => setInviteMode('email')}
        >
          <FaEnvelope size={14} />
          Invite by Email
        </button>
      </div>

      {inviteMode === 'search' ? (
        <div className={styles.searchSection}>
          <Autocomplete
            placeholder="Search by name or email..."
            entityType="user"
            items={collaboratorSearchResults}
            onSelect={handleSelectCollaborator}
            onSearch={handleSearchCollaborators}
            value={collaboratorSearchTerm}
            onChange={(e) => setCollaboratorSearchTerm(e.target.value)}
            showAvatar={true}
            showStatus={true}
            size="md"
            emptyMessage="Type to search users..."
          />
        </div>
      ) : (
        <div className={styles.emailSection}>
          <FormField
            name="inviteEmail"
            label="Email Address"
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="friend@example.com"
            helpText="We'll send them an invitation to join"
          />
          <Button
            variant="outline"
            size="sm"
            disabled={!inviteEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)}
            onClick={() => {
              // TODO: Implement email invite
              success(`Invitation sent to ${inviteEmail}`);
              setInviteEmail('');
            }}
          >
            Send Invite
          </Button>
        </div>
      )}

      {selectedCollaborators.length > 0 && (
        <div className={styles.selectedCollaborators}>
          <label>Selected Collaborators ({selectedCollaborators.length})</label>
          <div className={styles.collaboratorPills}>
            {selectedCollaborators.map(collab => (
              <Pill
                key={collab._id}
                onDismiss={() => handleRemoveCollaborator(collab._id)}
              >
                {collab.name || collab.email}
              </Pill>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderSuccessStep = () => (
    <div className={styles.successContainer}>
      <div className={styles.successIcon}>
        <FaCheckCircle size={64} />
      </div>
      <h3 className={styles.successTitle}>Experience Created!</h3>
      <p className={styles.successMessage}>
        Your experience "{createdExperience?.name}" has been created successfully.
        {planItems.filter(i => i.content?.trim()).length > 0 && (
          <> You've added {planItems.filter(i => i.content?.trim()).length} plan items.</>
        )}
        {selectedCollaborators.length > 0 && (
          <> {selectedCollaborators.length} collaborator(s) have been invited.</>
        )}
      </p>
      <div className={styles.successActions}>
        <Button variant="gradient" size="lg" onClick={handleGoToExperience}>
          Go to Experience
        </Button>
        <Button variant="outline" size="lg" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );

  const renderFooter = () => {
    if (currentStep === STEPS.SUCCESS) return null;

    return (
      <div className={styles.modalFooter}>
        <div className={styles.footerLeft}>
          {currentStep === STEPS.BASIC_INFO && (
            <button type="button" className={styles.backButton} onClick={handleClose}>
              Cancel
            </button>
          )}
          {currentStep === STEPS.MORE_DETAILS && (
            <button type="button" className={styles.backButton} onClick={() => setCurrentStep(STEPS.BASIC_INFO)}>
              <FaArrowLeft size={12} className="me-2" />
              Back
            </button>
          )}
          {(currentStep === STEPS.PLAN_ITEMS || currentStep === STEPS.COLLABORATORS) && (
            <button type="button" className={styles.skipLink} onClick={handleSkipStep}>
              Skip this step
            </button>
          )}
        </div>

        <div className={styles.footerRight}>
          {currentStep === STEPS.BASIC_INFO && (
            <Button
              variant="gradient"
              size="lg"
              onClick={() => setCurrentStep(STEPS.MORE_DETAILS)}
              disabled={!canProceedStep1}
            >
              Next
              <FaArrowRight size={12} className="ms-2" />
            </Button>
          )}
          {currentStep === STEPS.MORE_DETAILS && (
            <Button
              variant="gradient"
              size="lg"
              onClick={handleCreateExperience}
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Experience'}
            </Button>
          )}
          {currentStep === STEPS.PLAN_ITEMS && (
            <Button
              variant="gradient"
              size="lg"
              onClick={handleSavePlanItems}
              disabled={loading}
            >
              {loading ? 'Saving...' : planItems.filter(i => i.content?.trim()).length > 0 ? 'Save & Continue' : 'Continue'}
            </Button>
          )}
          {currentStep === STEPS.COLLABORATORS && (
            <Button
              variant="gradient"
              size="lg"
              onClick={handleSaveCollaborators}
              disabled={loading}
            >
              {loading ? 'Adding...' : selectedCollaborators.length > 0 ? 'Add & Finish' : 'Finish'}
            </Button>
          )}
        </div>
      </div>
    );
  };

  const modalContent = (
    <div className={styles.modalContainer} tabIndex="-1" role="dialog" aria-modal="true">
      <div className={styles.modalDialog}>
        <div className={styles.modalContent}>
          {/* Header */}
          <div className={styles.modalHeader}>
            <h5 className={styles.modalTitle}>
              {currentStep === STEPS.SUCCESS ? 'Success!' : 'Create New Experience'}
            </h5>
            <button
              type="button"
              className={styles.closeButton}
              onClick={handleClose}
              aria-label="Close"
            >
              &times;
            </button>
          </div>

          {/* Step Indicator */}
          {currentStep !== STEPS.SUCCESS && renderStepIndicator()}

          {/* Body */}
          <div className={styles.modalBody}>
            {error && (
              <Alert type="danger" className="mb-4" dismissible onDismiss={() => setError('')}>
                {error}
              </Alert>
            )}

            <div className={styles.stepContent}>
              {currentStep === STEPS.BASIC_INFO && renderStep1()}
              {currentStep === STEPS.MORE_DETAILS && renderStep2()}
              {currentStep === STEPS.PLAN_ITEMS && renderStep3()}
              {currentStep === STEPS.COLLABORATORS && renderStep4()}
              {currentStep === STEPS.SUCCESS && renderSuccessStep()}
            </div>
          </div>

          {/* Footer */}
          {renderFooter()}
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

ExperienceWizardModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  // initialValues is a free-form object used to prefill fields. Example:
  // { destinationId: '...', destinationName: 'Paris, France', name: 'Weekend in Paris' }
  initialValues: PropTypes.object,
};

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { FaCheck, FaArrowLeft, FaGripVertical, FaPlus, FaTrash } from 'react-icons/fa';
import { useData } from '../../contexts/DataContext';
import { useUser } from '../../contexts/UserContext';
import { useToast } from '../../contexts/ToastContext';
import { usePlanExperience } from '../../contexts/PlanExperienceContext';
import { createExperience, updateExperience, addPlanItem } from '../../utilities/experiences-api';
import { createPlan } from '../../utilities/plans-api';
import { isDuplicateName } from '../../utilities/deduplication';
import { createFilter } from '../../utilities/trie';
import { sanitizeUrl, sanitizeText } from '../../utilities/sanitize';
import { lang } from '../../lang.constants';
import { Button } from '../design-system';
import FormField from '../FormField/FormField';
import { FormTooltip } from '../Tooltip/Tooltip';
import Autocomplete from '../Autocomplete/Autocomplete';
import TagInput from '../TagInput/TagInput';
import PhotoUpload from '../PhotoUpload/PhotoUpload';
import NewDestinationModal from '../NewDestinationModal/NewDestinationModal';
import Alert from '../Alert/Alert';
import { Form } from 'react-bootstrap';
import { saveFormData, loadFormData, clearFormData } from '../../utilities/form-persistence';
import { logger } from '../../utilities/logger';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import styles from './MultiStepPlanModal.module.scss';

const STEPS = {
  CREATE_EXPERIENCE: 1,
  ADD_PLAN_ITEMS: 2,
  SELECT_DATE: 3,
};

const FORM_ID = 'multiStepPlanModal';

/**
 * MultiStepPlanModal - A multi-step modal for creating an experience and planning it
 *
 * Step 1: Create Experience (with optional destination creation)
 * Step 2: Add Plan Items (with hierarchical support and drag & drop)
 * Step 3: Select planned date and create the plan
 *
 * Features form persistence to prevent data loss on accidental close/reload
 */
export default function MultiStepPlanModal() {
  const navigate = useNavigate();
  const { destinations: destData, experiences: expData, addExperience } = useData();
  const { user } = useUser();
  const { success, error: showError } = useToast();
  const { isModalOpen, initialStep, prefilledData, closePlanExperienceModal } = usePlanExperience();

  // Refs for tracking persistence state
  const isLoadingPersistedData = useRef(false);
  const saveTimeoutRef = useRef(null);

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

  // Plan items state
  const [planItems, setPlanItems] = useState([]);
  const [newPlanItem, setNewPlanItem] = useState({
    text: '',
    parent_id: null,
    url: '',
    cost_estimate: '',
    planning_days: ''
  });

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  // Load persisted form data on mount (only when modal opens)
  useEffect(() => {
    if (!isModalOpen || !user?._id) return;

    const loadPersistedData = async () => {
      try {
        isLoadingPersistedData.current = true;
        const persistedData = await loadFormData(FORM_ID, true, user._id);

        if (persistedData && !prefilledData?.experience) {
          // Only restore if we don't have prefilled data from context
          logger.debug('[MultiStepPlanModal] Restoring persisted form data', { persistedData });

          if (persistedData.currentStep) setCurrentStep(persistedData.currentStep);
          if (persistedData.newExperience) setNewExperience(persistedData.newExperience);
          if (persistedData.tags) setTags(persistedData.tags);
          if (persistedData.destinationSearchTerm) setDestinationSearchTerm(persistedData.destinationSearchTerm);
          if (persistedData.destinationInput) setDestinationInput(persistedData.destinationInput);
          if (persistedData.createdExperience) setCreatedExperience(persistedData.createdExperience);
          if (persistedData.plannedDate) setPlannedDate(persistedData.plannedDate);
          if (persistedData.planItems) setPlanItems(persistedData.planItems);

          success(lang.current.multiStepPlanModal.restoredInProgress);
        }
      } catch (err) {
        // Silently fail - don't break the modal if persistence fails
        logger.error('[MultiStepPlanModal] Failed to load persisted data', err);
      } finally {
        // Small delay to ensure state is settled before allowing saves
        setTimeout(() => {
          isLoadingPersistedData.current = false;
        }, 100);
      }
    };

    loadPersistedData();
  }, [isModalOpen, user, prefilledData, success]);

  // Save form data on changes (debounced)
  useEffect(() => {
    // Don't save if:
    // - Modal is closed
    // - User not logged in
    // - Currently loading persisted data
    // - No experience data to save
    if (!isModalOpen || !user?._id || isLoadingPersistedData.current || !newExperience.name) {
      return;
    }

    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce saves to avoid excessive writes
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const dataToSave = {
          currentStep,
          newExperience,
          tags,
          destinationSearchTerm,
          destinationInput,
          createdExperience,
          plannedDate,
          planItems,
          savedAt: new Date().toISOString()
        };

        await saveFormData(FORM_ID, dataToSave, 24 * 60 * 60 * 1000, user._id); // 24 hour TTL
        logger.debug('[MultiStepPlanModal] Form data persisted', { step: currentStep });
      } catch (err) {
        // Silently fail - don't break the user flow
        logger.error('[MultiStepPlanModal] Failed to persist form data', err);
      }
    }, 500); // 500ms debounce

    // Cleanup timeout on unmount
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [isModalOpen, user, currentStep, newExperience, tags, destinationSearchTerm, 
      destinationInput, createdExperience, plannedDate, planItems]);

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
      setPlanItems([]);
      setNewPlanItem({
        text: '',
        parent_id: null,
        url: '',
        cost_estimate: '',
        planning_days: ''
      });
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

  // Step 1: Create or Update Experience
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

    // Check for duplicates (only for new experiences)
    if (!createdExperience && isDuplicateName(expData || [], newExperience.name)) {
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

      let experience;
      if (createdExperience) {
        // Update existing experience
        experience = await updateExperience(createdExperience._id, experienceData);
        success(lang.current.multiStepPlanModal.experienceUpdated);
      } else {
        // Create new experience
        experience = await createExperience(experienceData);
        addExperience(experience);
        setCreatedExperience(experience);
        success(lang.current.multiStepPlanModal.experienceCreated);
      }

      setCurrentStep(STEPS.ADD_PLAN_ITEMS);
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to save experience';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Create Plan and add plan items
  const handleCreatePlan = async () => {
    if (!createdExperience) {
      setError('No experience selected');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Add plan items to the experience first (so they can be snapshotted into the plan)
      if (planItems.length > 0) {
        const planItemPromises = planItems.map(async (item, index) => {
          const planItemData = {
            text: item.text,
            url: item.url || undefined,
            cost_estimate: item.cost_estimate ? parseFloat(item.cost_estimate) : undefined,
            planning_days: item.planning_days ? parseInt(item.planning_days) : undefined,
            parent_id: item.parent_id || undefined,
            order: index
          };
          return addPlanItem(createdExperience._id, planItemData);
        });

        await Promise.all(planItemPromises);
      }

      // Create the plan (which will snapshot the experience's plan_items)
      await createPlan(createdExperience._id, plannedDate || null);

      // Clear persisted form data on successful completion
      if (user?._id) {
        try {
          clearFormData(FORM_ID, user._id);
          logger.debug('[MultiStepPlanModal] Cleared persisted form data after successful plan creation');
        } catch (err) {
          logger.error('[MultiStepPlanModal] Failed to clear form data', err);
        }
      }

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

  // Skip date selection and create plan
  const handleSkipDate = () => {
    setPlannedDate('');
    handleCreatePlan();
  };

  // Plan item handlers
  const handleAddPlanItem = () => {
    if (!newPlanItem.text.trim()) return;

    const item = {
      id: `temp-${Date.now()}`,
      text: newPlanItem.text,
      parent_id: newPlanItem.parent_id,
      url: newPlanItem.url || '',
      cost_estimate: newPlanItem.cost_estimate || '',
      planning_days: newPlanItem.planning_days || '',
      order: planItems.length
    };

    setPlanItems(prev => [...prev, item]);
    setNewPlanItem({
      text: '',
      parent_id: null,
      url: '',
      cost_estimate: '',
      planning_days: ''
    });
  };

  const handleDeletePlanItem = (itemId) => {
    setPlanItems(prev => prev.filter(item => item.id !== itemId));
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      setPlanItems((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        return arrayMove(items, oldIndex, newIndex).map((item, index) => ({
          ...item,
          order: index
        }));
      });
    }
  };

  // Get available parent items (items without parents)
  const getAvailableParents = () => {
    return planItems.filter(item => !item.parent_id);
  };

  // Get child items for a parent
  const getChildItems = (parentId) => {
    return planItems.filter(item => item.parent_id === parentId);
  };

  // Sortable Plan Item Component
  const SortablePlanItem = ({ item, onDelete }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
    } = useSortable({ id: item.id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    };

    const parentItem = item.parent_id ? planItems.find(p => p.id === item.parent_id) : null;

    return (
      <div ref={setNodeRef} style={style} className={styles.planItem}>
        <div className={styles.planItemGrip} {...attributes} {...listeners}>
          <FaGripVertical />
        </div>
        <div className={styles.planItemContent}>
          <div className={styles.planItemText}>
            {item.text}
            {parentItem && (
              <small className="text-muted ms-2">
                (under: {parentItem.text})
              </small>
            )}
          </div>
          {item.url && (() => {
            const safeUrl = sanitizeUrl(item.url);
            // Build a safe, human-friendly display string from the parsed URL
            let displayUrl = '';
            if (safeUrl) {
              try {
                const parsedForDisplay = new URL(safeUrl.startsWith('http') ? safeUrl : `https://${safeUrl}`);
                displayUrl = `${parsedForDisplay.hostname}${parsedForDisplay.pathname || ''}${parsedForDisplay.search || ''}`;
              } catch (e) {
                // Fallback to the normalized URL if parsing fails
                displayUrl = safeUrl;
              }
            }

            return safeUrl && displayUrl ? (
              <div className={styles.planItemUrl}>
                <a href={safeUrl} target="_blank" rel="noopener noreferrer nofollow">
                  {displayUrl}
                </a>
              </div>
            ) : null;
          })()}
          <div className={styles.planItemMeta}>
            {item.cost_estimate && <span>Cost: ${item.cost_estimate}</span>}
            {item.planning_days && <span>Days: {item.planning_days}</span>}
          </div>
        </div>
        <button
          type="button"
          className={styles.planItemDelete}
          onClick={() => onDelete(item.id)}
          aria-label={lang.current.aria.deletePlanItem}
        >
          <FaTrash />
        </button>
      </div>
    );
  };

  // Go back to previous step
  const handleBack = () => {
    if (currentStep === STEPS.SELECT_DATE) {
      setCurrentStep(STEPS.ADD_PLAN_ITEMS);
    } else if (currentStep === STEPS.ADD_PLAN_ITEMS) {
      setCurrentStep(STEPS.CREATE_EXPERIENCE);
    }
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
      <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content" style={{ borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
          {/* Header */}
          <div className="modal-header" style={{ borderBottom: '1px solid var(--color-border-light)' }}>
            <h5 className="modal-title" style={{ fontWeight: 'var(--font-weight-bold)' }}>
              {currentStep === STEPS.CREATE_EXPERIENCE ? lang.current.multiStepPlanModal.createNewExperience :
               currentStep === STEPS.ADD_PLAN_ITEMS ? lang.current.multiStepPlanModal.addPlanItemsTitle :
               lang.current.multiStepPlanModal.planYourExperience}
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
              <span className={styles.stepLabel}>{lang.current.multiStepPlanModal.stepCreateExperience}</span>
            </div>
            <div className={`${styles.stepConnector} ${currentStep > 1 ? styles.active : ''}`} />
            <div className={`${styles.step} ${currentStep >= 2 ? styles.active : ''} ${currentStep > 2 ? styles.completed : ''}`}>
              <span className={styles.stepNumber}>
                {currentStep > 2 ? <FaCheck size={12} /> : '2'}
              </span>
              <span className={styles.stepLabel}>{lang.current.multiStepPlanModal.stepAddPlanItems}</span>
            </div>
            <div className={`${styles.stepConnector} ${currentStep > 2 ? styles.active : ''}`} />
            <div className={`${styles.step} ${currentStep >= 3 ? styles.active : ''}`}>
              <span className={styles.stepNumber}>3</span>
              <span className={styles.stepLabel}>{lang.current.multiStepPlanModal.stepSelectDate}</span>
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
                        value={destinationSearchTerm}
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
                      {lang.current.label.photos}
                      <FormTooltip content={lang.current.helper.photosOptional} placement="top" />
                    </Form.Label>
                    <PhotoUpload data={newExperience} setData={setNewExperience} />
                  </div>

                  {/* Planning days and cost estimate are virtuals computed from plan items; removed from the modal form. */}
                </Form>
              )}

              {currentStep === STEPS.ADD_PLAN_ITEMS && createdExperience && (
                <div>
                  <div className={styles.experienceSummary}>
                    <div className={styles.summaryTitle}>{createdExperience.name}</div>
                    <div className={styles.summaryDestination}>
                      {createdExperience.destination?.name
                        ? `${createdExperience.destination.name}, ${createdExperience.destination.country}`
                        : 'Destination selected'}
                    </div>
                  </div>

                  <div className={styles.planItemsSection}>
                    <h6 className={styles.sectionTitle}>{lang.current.multiStepPlanModal.stepAddPlanItems}</h6>
                    <p className={styles.sectionDescription}>
                      {lang.current.multiStepPlanModal.noItemsDescription}
                    </p>

                    {/* Add new plan item form */}
                    <div className={styles.addPlanItemForm}>
                      <FormField
                        name="text"
                        label={lang.current.label.planItem}
                        type="text"
                        value={newPlanItem.text}
                        onChange={(e) => setNewPlanItem(prev => ({ ...prev, text: e.target.value }))}
                        placeholder={lang.current.multiStepPlanModal.itemPlaceholder}
                        required
                      />

                      <div className="row">
                        <div className="col-md-6">
                          <Form.Group className="mb-3">
                            <Form.Label>Parent Item (Optional)</Form.Label>
                            <Form.Select
                              value={newPlanItem.parent_id || ''}
                              onChange={(e) => setNewPlanItem(prev => ({
                                ...prev,
                                parent_id: e.target.value || null
                              }))}
                            >
                              <option value="">No parent (top level)</option>
                              {getAvailableParents().map(parent => (
                                <option key={parent.id} value={parent.id}>
                                  {parent.text}
                                </option>
                              ))}
                            </Form.Select>
                          </Form.Group>
                        </div>
                        <div className="col-md-3">
                          <FormField
                            name="cost_estimate"
                            label="Cost ($)"
                            type="number"
                            value={newPlanItem.cost_estimate}
                            onChange={(e) => setNewPlanItem(prev => ({ ...prev, cost_estimate: e.target.value }))}
                            placeholder="0"
                          />
                        </div>
                        <div className="col-md-3">
                          <FormField
                            name="planning_days"
                            label="Days"
                            type="number"
                            value={newPlanItem.planning_days}
                            onChange={(e) => setNewPlanItem(prev => ({ ...prev, planning_days: e.target.value }))}
                            placeholder="0"
                          />
                        </div>
                      </div>

                      <FormField
                        name="url"
                        label="URL (Optional)"
                        type="url"
                        value={newPlanItem.url}
                        onChange={(e) => setNewPlanItem(prev => ({ ...prev, url: e.target.value }))}
                        placeholder="https://example.com"
                      />

                      <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={handleAddPlanItem}
                        disabled={!newPlanItem.text.trim()}
                        className="mt-2"
                      >
                        <FaPlus className="me-2" />
                        {lang.current.multiStepPlanModal.addItem}
                      </Button>
                    </div>

                    {/* Plan items list with drag and drop */}
                    {planItems.length > 0 && (
                      <div className={styles.planItemsList}>
                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={handleDragEnd}
                        >
                          <SortableContext
                            items={planItems.map(item => item.id)}
                            strategy={verticalListSortingStrategy}
                          >
                            {planItems.map((item) => (
                              <SortablePlanItem
                                key={item.id}
                                item={item}
                                onDelete={handleDeletePlanItem}
                              />
                            ))}
                          </SortableContext>
                        </DndContext>
                      </div>
                    )}

                    {planItems.length === 0 && (
                      <div className={styles.emptyState}>
                        <p>{lang.current.multiStepPlanModal.noItemsYet}</p>
                      </div>
                    )}
                  </div>
                </div>
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
                    {planItems.length > 0 && (
                      <div className={styles.summaryPlanItems}>
                        {planItems.length} plan item{planItems.length !== 1 ? 's' : ''} added
                      </div>
                    )}
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
              {(currentStep === STEPS.ADD_PLAN_ITEMS || currentStep === STEPS.SELECT_DATE) && (
                <button type="button" className={styles.backButton} onClick={handleBack}>
                  <FaArrowLeft size={12} className="me-2" />
                  {lang.current.multiStepPlanModal.back}
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
                  {loading ? lang.current.button.saving : createdExperience ? lang.current.multiStepPlanModal.updateContinue : lang.current.multiStepPlanModal.createContinue}
                </Button>
              )}
              {currentStep === STEPS.ADD_PLAN_ITEMS && (
                <Button
                  variant="gradient"
                  size="lg"
                  onClick={() => setCurrentStep(STEPS.SELECT_DATE)}
                  disabled={loading}
                >
                  {planItems.length > 0 ? `Continue with ${planItems.length} item${planItems.length !== 1 ? 's' : ''}` : 'Skip Plan Items'}
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

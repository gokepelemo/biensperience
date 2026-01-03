import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import {
  FaCheck,
  FaArrowRight,
} from 'react-icons/fa';
import BiensperienceLogo from '../BiensperienceLogo/BiensperienceLogo';
import { Form } from 'react-bootstrap';
import { useData } from '../../contexts/DataContext';
import { useUser } from '../../contexts/UserContext';
import { useToast } from '../../contexts/ToastContext';
import { createDestination, updateDestination } from '../../utilities/destinations-api';
import { useTravelTipsManager } from '../../hooks/useTravelTipsManager';
import { useFormPersistence } from '../../hooks/useFormPersistence';
import { formatRestorationMessage } from '../../utilities/time-utils';
import { lang } from '../../lang.constants';
import { Button } from '../design-system';
import FormField from '../FormField/FormField';
import PhotoUpload from '../PhotoUpload/PhotoUpload';
import TravelTipsManager from '../TravelTipsManager/TravelTipsManager';
import Alert from '../Alert/Alert';
import styles from './DestinationWizardModal.module.scss';

const STEPS = {
  BASIC_INFO: 1,
  DETAILS: 2,
  PHOTOS: 3,
  TRAVEL_TIPS: 4,
  SUCCESS: 5,
};

/**
 * DestinationWizardModal - A comprehensive multi-step wizard for creating a destination
 *
 * Step 1: Basic Info (City/Town, State/Province, Country) - Creates destination on completion
 * Step 2: Details (Overview) - Updates destination on blur
 * Step 3: Photos - Updates destination on change
 * Step 4: Travel Tips - Updates destination on blur/add
 * Step 5: Success
 */
export default function DestinationWizardModal({ show, onClose, initialValues = {}, onDestinationCreated }) {
  const navigate = useNavigate();
  const { destinations: destData, addDestination, updateDestination: updateDestInContext } = useData();
  const { user } = useUser();
  const { success, error: showError } = useToast();

  // Step management
  const [currentStep, setCurrentStep] = useState(STEPS.BASIC_INFO);

  // Destination form state
  const [destinationData, setDestinationData] = useState({
    name: '',
    state: '',
    country: '',
    overview: '',
  });

  // Track if we've created the destination (for optimistic creation)
  const [createdDestination, setCreatedDestination] = useState(null);
  const isCreatingRef = useRef(false);

  // Travel tips state
  const {
    travelTips,
    newTravelTip,
    setTravelTips,
    addTravelTip,
    deleteTravelTip,
    handleNewTipChange,
    handleNewTipKeyPress,
    tipMode,
    setTipMode,
    structuredTip,
    addStructuredTip,
    updateStructuredTipField,
    updateCallToAction
  } = useTravelTipsManager([]);

  // UI state
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Form persistence - combines destinationData and travelTips
  const formData = { ...destinationData, travel_tips: travelTips };
  const setFormData = useCallback((data) => {
    const { travel_tips, ...destFields } = data;
    setDestinationData(destFields);
    if (travel_tips) {
      setTravelTips(travel_tips);
    }
  }, [setTravelTips]);

  const persistence = useFormPersistence(
    'destination-wizard-form',
    formData,
    setFormData,
    {
      enabled: show && !createdDestination, // Only persist before destination is created
      userId: user?._id,
      ttl: 24 * 60 * 60 * 1000,
      debounceMs: 1000,
      excludeFields: ['photos', 'photos_full'],
      onRestore: (savedData, age) => {
        const message = formatRestorationMessage(age, 'create');
        success(message, {
          duration: 20000,
          actions: [{
            label: lang.current.button.clearForm,
            onClick: () => {
              setDestinationData({ name: '', state: '', country: '', overview: '' });
              setTravelTips([]);
              persistence.clear();
            },
            variant: 'link'
          }]
        });
      }
    }
  );

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!show) {
      setCurrentStep(STEPS.BASIC_INFO);
      setDestinationData({
        name: '',
        state: '',
        country: '',
        overview: '',
      });
      setTravelTips([]);
      setError('');
      setCreatedDestination(null);
      isCreatingRef.current = false;
    } else if (initialValues) {
      // When opening, apply any provided initialValues to prefill fields
      setDestinationData({
        name: initialValues.name || '',
        state: initialValues.state || '',
        country: initialValues.country || '',
        overview: initialValues.overview || '',
      });
      if (initialValues.travel_tips) {
        setTravelTips(initialValues.travel_tips);
      }
    }
  }, [show, initialValues, setTravelTips]);

  // Handlers
  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setDestinationData(prev => ({ ...prev, [name]: value }));
    setError('');
  }, []);

  // Check if we can create the destination (name + country are filled)
  const canCreate = destinationData.name?.trim() && destinationData.country?.trim();

  // Create destination when Step 1 is complete (optimistic creation)
  const handleCreateDestination = async () => {
    if (isCreatingRef.current || createdDestination) return;

    setError('');
    setLoading(true);
    isCreatingRef.current = true;

    // Validation
    if (!destinationData.name?.trim()) {
      setError(lang.current.destinationWizardModal.cityRequired);
      setLoading(false);
      isCreatingRef.current = false;
      return;
    }

    if (!destinationData.country?.trim()) {
      setError(lang.current.destinationWizardModal.countryRequired);
      setLoading(false);
      isCreatingRef.current = false;
      return;
    }

    // Check for duplicates
    const duplicate = (destData || []).find(dest =>
      dest.name.toLowerCase().trim() === destinationData.name.toLowerCase().trim() &&
      dest.country.toLowerCase().trim() === destinationData.country.toLowerCase().trim()
    );

    if (duplicate) {
      setError(lang.current.validation.destinationAlreadyExists?.replace('{name}', `${destinationData.name}, ${destinationData.country}`) || `A destination named "${destinationData.name}, ${destinationData.country}" already exists.`);
      setLoading(false);
      isCreatingRef.current = false;
      return;
    }

    try {
      const data = {
        name: destinationData.name.trim(),
        state: destinationData.state?.trim() || '',
        country: destinationData.country.trim(),
      };

      const destination = await createDestination(data);
      addDestination(destination);
      setCreatedDestination(destination);

      // Clear form persistence since destination is now created
      persistence.clear();

      success(lang.current.success?.destinationCreated || 'Destination created!');
      setCurrentStep(STEPS.DETAILS);

      // Notify parent if callback provided
      if (onDestinationCreated) {
        onDestinationCreated(destination);
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to create destination';
      setError(errorMsg);
      isCreatingRef.current = false;
    } finally {
      setLoading(false);
    }
  };

  // Update destination on field blur (for steps 2-4)
  const handleFieldBlur = useCallback(async (fieldName, value) => {
    if (!createdDestination) return;

    // Don't update if value hasn't changed
    if (createdDestination[fieldName] === value) return;

    try {
      const updated = await updateDestination(createdDestination._id, { [fieldName]: value });
      setCreatedDestination(updated);
      updateDestInContext(updated);
    } catch (err) {
      // Silently handle update errors - the data is saved locally and will sync
      console.warn('Failed to update destination field', fieldName, err);
    }
  }, [createdDestination, updateDestInContext]);

  // Handle overview blur
  const handleOverviewBlur = useCallback(() => {
    handleFieldBlur('overview', destinationData.overview?.trim() || '');
  }, [destinationData.overview, handleFieldBlur]);

  // Update travel tips
  const handleSaveTravelTips = useCallback(async () => {
    if (!createdDestination) return;

    try {
      const updated = await updateDestination(createdDestination._id, { travel_tips: travelTips });
      setCreatedDestination(updated);
      updateDestInContext(updated);
    } catch (err) {
      console.warn('Failed to update travel tips', err);
    }
  }, [createdDestination, travelTips, updateDestInContext]);

  // Handle photo changes
  const handlePhotoChange = useCallback(async (newData) => {
    setDestinationData(prev => ({ ...prev, ...newData }));

    if (!createdDestination) return;

    // Update photos on the server
    try {
      const updatePayload = {};
      if (newData.photos) updatePayload.photos = newData.photos;
      if (newData.default_photo_id) updatePayload.default_photo_id = newData.default_photo_id;

      if (Object.keys(updatePayload).length > 0) {
        const updated = await updateDestination(createdDestination._id, updatePayload);
        setCreatedDestination(updated);
        updateDestInContext(updated);
      }
    } catch (err) {
      console.warn('Failed to update photos', err);
    }
  }, [createdDestination, updateDestInContext]);

  // Step navigation
  const handleBack = useCallback(() => {
    if (currentStep > STEPS.BASIC_INFO && currentStep !== STEPS.SUCCESS) {
      // Can't go back to step 1 after destination is created
      if (currentStep === STEPS.DETAILS && createdDestination) {
        return;
      }
      setCurrentStep(prev => prev - 1);
      setError('');
    }
  }, [currentStep, createdDestination]);

  // Handle skipping optional steps
  const handleSkipStep = useCallback(() => {
    if (currentStep === STEPS.DETAILS) {
      setCurrentStep(STEPS.PHOTOS);
    } else if (currentStep === STEPS.PHOTOS) {
      setCurrentStep(STEPS.TRAVEL_TIPS);
    } else if (currentStep === STEPS.TRAVEL_TIPS) {
      setCurrentStep(STEPS.SUCCESS);
    }
  }, [currentStep]);

  // Proceed to next step
  const handleNextStep = useCallback(async () => {
    if (currentStep === STEPS.DETAILS) {
      // Save overview before moving to next step
      await handleFieldBlur('overview', destinationData.overview?.trim() || '');
      setCurrentStep(STEPS.PHOTOS);
    } else if (currentStep === STEPS.PHOTOS) {
      setCurrentStep(STEPS.TRAVEL_TIPS);
    } else if (currentStep === STEPS.TRAVEL_TIPS) {
      // Save travel tips before finishing
      await handleSaveTravelTips();
      setCurrentStep(STEPS.SUCCESS);
    }
  }, [currentStep, destinationData.overview, handleFieldBlur, handleSaveTravelTips]);

  // Handle final action - go to destination
  const handleGoToDestination = useCallback(() => {
    onClose();
    if (createdDestination) {
      navigate(`/destinations/${createdDestination._id}`);
    }
  }, [onClose, navigate, createdDestination]);

  // Close handler
  const handleClose = useCallback(() => {
    if (currentStep === STEPS.SUCCESS || !createdDestination) {
      onClose();
    } else {
      // Confirm closing if destination was created but wizard not complete
      if (window.confirm('Are you sure you want to close? Your destination has been created but you can add more details later.')) {
        onClose();
      }
    }
  }, [currentStep, createdDestination, onClose]);

  if (!show) return null;

  const stepLabels = {
    [STEPS.BASIC_INFO]: lang.current.destinationWizardModal.stepBasicInfo,
    [STEPS.DETAILS]: lang.current.destinationWizardModal.stepDetails,
    [STEPS.PHOTOS]: lang.current.destinationWizardModal.stepPhotos,
    [STEPS.TRAVEL_TIPS]: lang.current.destinationWizardModal.stepTravelTips,
    [STEPS.SUCCESS]: lang.current.destinationWizardModal.stepDone,
  };

  const renderStepIndicator = () => (
    <div className={styles.stepIndicator}>
      {[STEPS.BASIC_INFO, STEPS.DETAILS, STEPS.PHOTOS, STEPS.TRAVEL_TIPS].map((step, index, arr) => (
        <React.Fragment key={step}>
          <div className={`${styles.step} ${currentStep >= step ? styles.active : ''} ${currentStep > step ? styles.completed : ''}`}>
            <span className={styles.stepNumber}>
              {currentStep > step ? <FaCheck size={12} /> : index + 1}
            </span>
            <span className={styles.stepLabel}>{stepLabels[step]}</span>
          </div>
          {index < arr.length - 1 && (
            <div className={`${styles.stepConnector} ${currentStep > step ? styles.active : ''}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <Form onSubmit={(e) => { e.preventDefault(); handleCreateDestination(); }}>
      <FormField
        name="name"
        label={lang.current.destinationWizardModal.cityTown}
        type="text"
        value={destinationData.name || ''}
        onChange={handleChange}
        placeholder={lang.current.destinationWizardModal.cityTownPlaceholder}
        required
        tooltip={lang.current.helper.cityRequired}
        autoFocus
      />

      <FormField
        name="state"
        label={lang.current.destinationWizardModal.stateProvince}
        type="text"
        value={destinationData.state || ''}
        onChange={handleChange}
        placeholder={lang.current.destinationWizardModal.stateProvincePlaceholder}
        tooltip={lang.current.helper.stateProvinceOptional || 'State or province is optional'}
      />

      <FormField
        name="country"
        label={lang.current.destinationWizardModal.country}
        type="text"
        value={destinationData.country || ''}
        onChange={handleChange}
        placeholder={lang.current.destinationWizardModal.countryPlaceholder}
        required
        tooltip={lang.current.helper.countryRequired}
      />
    </Form>
  );

  const renderStep2 = () => (
    <Form onSubmit={(e) => { e.preventDefault(); handleNextStep(); }}>
      <p className={styles.stepDescription}>
        {lang.current.helper.overviewOptional || 'Add an overview to help travelers understand what makes this destination special.'}
      </p>

      <FormField
        name="overview"
        label={lang.current.destinationWizardModal.overview}
        type="textarea"
        value={destinationData.overview || ''}
        onChange={handleChange}
        onBlur={handleOverviewBlur}
        placeholder={lang.current.destinationWizardModal.overviewPlaceholder}
        rows={4}
        showCounter
        maxLength={300}
      />
    </Form>
  );

  const renderStep3 = () => (
    <div className={styles.photosContainer}>
      <p className={styles.stepDescription}>
        {lang.current.destinationWizardModal.photosDescription}
      </p>

      <PhotoUpload
        data={destinationData}
        setData={handlePhotoChange}
      />
    </div>
  );

  const renderStep4 = () => (
    <div className={styles.travelTipsContainer}>
      <p className={styles.stepDescription}>
        {lang.current.destinationWizardModal.travelTipsDescription}
      </p>

      <TravelTipsManager
        tips={travelTips}
        newTip={newTravelTip}
        onNewTipChange={handleNewTipChange}
        onNewTipKeyPress={handleNewTipKeyPress}
        onAddTip={() => {
          addTravelTip();
          // Auto-save after adding tip
          setTimeout(() => handleSaveTravelTips(), 100);
        }}
        onDeleteTip={(index) => {
          deleteTravelTip(index);
          // Auto-save after deleting tip
          setTimeout(() => handleSaveTravelTips(), 100);
        }}
        label={lang.current.heading.travelTips}
        placeholder={lang.current.travelTip.insiderTipPlaceholder}
        addButtonText={lang.current.button.addTip}
        deleteButtonText={lang.current.button.remove}
        mode={tipMode}
        onModeChange={setTipMode}
        structuredTip={structuredTip}
        onStructuredTipFieldChange={updateStructuredTipField}
        onCallToActionChange={updateCallToAction}
        onAddStructuredTip={() => {
          addStructuredTip();
          setTimeout(() => handleSaveTravelTips(), 100);
        }}
      />
    </div>
  );

  const renderSuccessStep = () => (
    <div className={styles.successContainer}>
      <div className={styles.successIcon}>
        <BiensperienceLogo type="clean" size="xl" />
      </div>
      <h3 className={styles.successTitle}>{lang.current.destinationWizardModal.doneTitle}</h3>
      <p className={styles.successMessage}>
        {lang.current.destinationWizardModal.doneMessage}
        {travelTips.length > 0 && (
          <> You've added {travelTips.length} travel tip{travelTips.length !== 1 ? 's' : ''}.</>
        )}
      </p>
      <div className={styles.successActions}>
        <Button variant="gradient" size="lg" onClick={handleGoToDestination}>
          {lang.current.destinationWizardModal.goToDestination}
        </Button>
        <Button variant="outline" size="lg" onClick={onClose}>
          {lang.current.destinationWizardModal.close}
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
              {lang.current.button.cancel}
            </button>
          )}
          {currentStep > STEPS.BASIC_INFO && currentStep < STEPS.SUCCESS && (
            <button type="button" className={styles.skipLink} onClick={handleSkipStep}>
              {lang.current.destinationWizardModal.skip}
            </button>
          )}
        </div>

        <div className={styles.footerRight}>
          {currentStep === STEPS.BASIC_INFO && (
            <Button
              variant="gradient"
              size="lg"
              onClick={handleCreateDestination}
              disabled={loading || !canCreate}
            >
              {loading ? lang.current.button.creating : lang.current.destinationWizardModal.create}
            </Button>
          )}
          {currentStep === STEPS.DETAILS && (
            <Button
              variant="gradient"
              size="lg"
              onClick={handleNextStep}
              disabled={loading}
            >
              {lang.current.destinationWizardModal.next}
              <FaArrowRight size={12} className="ms-2" />
            </Button>
          )}
          {currentStep === STEPS.PHOTOS && (
            <Button
              variant="gradient"
              size="lg"
              onClick={handleNextStep}
              disabled={loading}
            >
              {lang.current.destinationWizardModal.next}
              <FaArrowRight size={12} className="ms-2" />
            </Button>
          )}
          {currentStep === STEPS.TRAVEL_TIPS && (
            <Button
              variant="gradient"
              size="lg"
              onClick={handleNextStep}
              disabled={loading}
            >
              {loading ? lang.current.button.saving : lang.current.destinationWizardModal.finish}
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
              {currentStep === STEPS.SUCCESS ? lang.current.destinationWizardModal.doneTitle : lang.current.destinationWizardModal.title}
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
              {currentStep === STEPS.DETAILS && renderStep2()}
              {currentStep === STEPS.PHOTOS && renderStep3()}
              {currentStep === STEPS.TRAVEL_TIPS && renderStep4()}
              {currentStep === STEPS.SUCCESS && renderSuccessStep()}
            </div>
          </div>

          {/* Footer */}
          {renderFooter()}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

DestinationWizardModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  initialValues: PropTypes.object,
  onDestinationCreated: PropTypes.func,
};

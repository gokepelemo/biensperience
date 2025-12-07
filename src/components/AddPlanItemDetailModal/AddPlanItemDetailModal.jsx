/**
 * AddPlanItemDetailModal Component
 * Multi-step modal for adding different types of details to a plan item.
 * Step 1: Select detail type (cost, flight, transport, hotel, parking, discount)
 * Step 2: Enter details in key/value pairs with schema-based fields
 * Step 3: Upload document (optional) with AI parsing
 */

import { useState, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import Modal from '../Modal/Modal';
import DetailTypeSelector from './DetailTypeSelector';
import DetailEntryForm from './DetailEntryForm';
import DocumentUploadStep from './DocumentUploadStep';
import styles from './AddPlanItemDetailModal.module.scss';
import { lang } from '../../lang.constants';
import { logger } from '../../utilities/logger';
import { DETAIL_TYPES, DETAIL_TYPE_CONFIG, DETAIL_CATEGORIES, STEPS } from './constants';

// Re-export constants for consumers importing from this file
export { DETAIL_TYPES, DETAIL_TYPE_CONFIG, DETAIL_CATEGORIES };

export default function AddPlanItemDetailModal({
  show,
  onClose,
  planItem,
  plan,
  onSave,
  defaultDetailType = null,
  defaultCurrency = 'USD'
}) {
  const [currentStep, setCurrentStep] = useState(STEPS.SELECT_TYPE);
  const [selectedType, setSelectedType] = useState(defaultDetailType);
  const [formData, setFormData] = useState({});
  const [documentData, setDocumentData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (show) {
      setCurrentStep(defaultDetailType ? STEPS.ENTER_DETAILS : STEPS.SELECT_TYPE);
      setSelectedType(defaultDetailType);
      setFormData({});
      setDocumentData(null);
      setError(null);
    }
  }, [show, defaultDetailType]);

  // Handle type selection (Step 1)
  const handleTypeSelect = useCallback((type) => {
    setSelectedType(type);
    setFormData({});
    setCurrentStep(STEPS.ENTER_DETAILS);
  }, []);

  // Handle form data change (Step 2)
  const handleFormChange = useCallback((data) => {
    setFormData(data);
  }, []);

  // Handle document upload (Step 3)
  const handleDocumentChange = useCallback((docData) => {
    setDocumentData(docData);
  }, []);

  // Navigate between steps
  const handleBack = useCallback(() => {
    if (currentStep === STEPS.ENTER_DETAILS) {
      setCurrentStep(STEPS.SELECT_TYPE);
      setSelectedType(null);
      setFormData({});
    } else if (currentStep === STEPS.UPLOAD_DOCUMENT) {
      setCurrentStep(STEPS.ENTER_DETAILS);
    }
  }, [currentStep]);

  const handleNext = useCallback(() => {
    if (currentStep === STEPS.ENTER_DETAILS) {
      setCurrentStep(STEPS.UPLOAD_DOCUMENT);
    }
  }, [currentStep]);

  // Skip document upload and save directly
  const handleSkipDocument = useCallback(async () => {
    await handleSave();
  }, [formData, selectedType, planItem, plan, onSave]);

  // Save the detail
  const handleSave = useCallback(async () => {
    if (!selectedType || !planItem) {
      setError('Missing required data');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        type: selectedType,
        planItemId: planItem._id || planItem.plan_item_id,
        planId: plan?._id,
        data: formData,
        document: documentData
      };

      logger.info('[AddPlanItemDetailModal] Saving detail', { type: selectedType, planItemId: payload.planItemId });

      if (onSave) {
        await onSave(payload);
      }

      // Close modal on success
      onClose();
    } catch (err) {
      logger.error('[AddPlanItemDetailModal] Failed to save detail', { error: err.message });
      setError(err.message || 'Failed to save detail');
    } finally {
      setLoading(false);
    }
  }, [selectedType, planItem, plan, formData, documentData, onSave, onClose]);

  // Get step title
  const getStepTitle = () => {
    if (currentStep === STEPS.SELECT_TYPE) {
      return lang.en.modal?.addDetail || 'Add Detail';
    }
    if (currentStep === STEPS.ENTER_DETAILS) {
      const config = DETAIL_TYPE_CONFIG[selectedType];
      return config ? `${config.icon} ${config.label}` : 'Enter Details';
    }
    return lang.en.modal?.uploadDocument || 'Upload Document';
  };

  // Render footer buttons
  const renderFooter = () => {
    const buttons = [];

    // Back button (not on first step)
    if (currentStep > STEPS.SELECT_TYPE) {
      buttons.push(
        <button
          key="back"
          type="button"
          className={styles.backButton}
          onClick={handleBack}
          disabled={loading}
        >
          ← Back
        </button>
      );
    }

    // Step-specific buttons
    if (currentStep === STEPS.ENTER_DETAILS) {
      buttons.push(
        <button
          key="skip"
          type="button"
          className={styles.skipButton}
          onClick={handleSkipDocument}
          disabled={loading}
        >
          {loading ? 'Saving...' : 'Save Without Document'}
        </button>
      );
      buttons.push(
        <button
          key="next"
          type="button"
          className={styles.nextButton}
          onClick={handleNext}
          disabled={loading}
        >
          Add Document →
        </button>
      );
    }

    if (currentStep === STEPS.UPLOAD_DOCUMENT) {
      buttons.push(
        <button
          key="save"
          type="button"
          className={styles.saveButton}
          onClick={handleSave}
          disabled={loading}
        >
          {loading ? 'Saving...' : 'Save'}
        </button>
      );
    }

    return <div className={styles.footerButtons}>{buttons}</div>;
  };

  if (!show) return null;

  return (
    <Modal
      show={show}
      onClose={onClose}
      title={getStepTitle()}
      size="xl"
      footer={currentStep > STEPS.SELECT_TYPE ? renderFooter() : null}
    >
      <div className={styles.addDetailModal}>
        {/* Step indicator */}
        <div className={styles.stepIndicator}>
          <div className={`${styles.step} ${currentStep >= STEPS.SELECT_TYPE ? styles.active : ''} ${currentStep > STEPS.SELECT_TYPE ? styles.completed : ''}`}>
            <span className={styles.stepNumber}>1</span>
            <span className={styles.stepLabel}>Type</span>
          </div>
          <div className={styles.stepConnector} />
          <div className={`${styles.step} ${currentStep >= STEPS.ENTER_DETAILS ? styles.active : ''} ${currentStep > STEPS.ENTER_DETAILS ? styles.completed : ''}`}>
            <span className={styles.stepNumber}>2</span>
            <span className={styles.stepLabel}>Details</span>
          </div>
          <div className={styles.stepConnector} />
          <div className={`${styles.step} ${currentStep >= STEPS.UPLOAD_DOCUMENT ? styles.active : ''}`}>
            <span className={styles.stepNumber}>3</span>
            <span className={styles.stepLabel}>Document</span>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className={styles.errorMessage}>
            {error}
          </div>
        )}

        {/* Step content */}
        <div className={styles.stepContent}>
          {currentStep === STEPS.SELECT_TYPE && (
            <DetailTypeSelector
              onSelect={handleTypeSelect}
              selectedType={selectedType}
            />
          )}

          {currentStep === STEPS.ENTER_DETAILS && selectedType && (
            <DetailEntryForm
              detailType={selectedType}
              value={formData}
              onChange={handleFormChange}
              defaultCurrency={plan?.currency || defaultCurrency}
              planItem={planItem}
            />
          )}

          {currentStep === STEPS.UPLOAD_DOCUMENT && (
            <DocumentUploadStep
              detailType={selectedType}
              value={documentData}
              onChange={handleDocumentChange}
              planItem={planItem}
              plan={plan}
            />
          )}
        </div>
      </div>
    </Modal>
  );
}

AddPlanItemDetailModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  planItem: PropTypes.object,
  plan: PropTypes.object,
  onSave: PropTypes.func,
  defaultDetailType: PropTypes.oneOf(Object.values(DETAIL_TYPES)),
  defaultCurrency: PropTypes.string
};

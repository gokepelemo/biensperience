import styles from "./NewDestinationModal.module.scss";
import { useState, useEffect } from "react";
import { Form } from "react-bootstrap";
import Modal from "../Modal/Modal";
import FormField from "../FormField/FormField";
import { createDestination } from "../../utilities/destinations-api";
import { useData } from "../../contexts/DataContext";
import { useToast } from "../../contexts/ToastContext";
import { handleError } from "../../utilities/error-handler";
import { lang } from "../../lang.constants";
import { logger } from "../../utilities/logger";

/**
 * Modal for quickly creating a new destination inline
 * Only requires essential fields: name (city/town), state, and country
 *
 * @param {Object} props - Component props
 * @param {boolean} props.show - Whether modal is visible
 * @param {Function} props.onClose - Callback when modal is closed
 * @param {Function} props.onDestinationCreated - Callback when destination is created with new destination object
 * @param {string} props.prefillName - Optional prefilled destination name from user input
 */
export default function NewDestinationModal({ show, onClose, onDestinationCreated, prefillName = "" }) {
  const { addDestination } = useData();
  const { success } = useToast();
  const [formData, setFormData] = useState({
    name: prefillName,
    state: "",
    country: ""
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Update prefilled name when prop changes
  useEffect(() => {
    if (prefillName && prefillName !== formData.name) {
      setFormData(prev => ({ ...prev, name: prefillName }));
    }
  }, [prefillName, formData.name]);

  function handleChange(e) {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    // Clear error when user starts typing
    if (error) setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      // Create minimal destination with only required fields
      const newDestination = {
        name: formData.name.trim(),
        state: formData.state.trim(),
        country: formData.country.trim()
      };

      logger.info('Creating destination from modal', { name: newDestination.name });
      const createdDestination = await createDestination(newDestination);

      // Add to global state
      addDestination(createdDestination);

      // Show success message
      const message = lang.current.notification?.destination?.created?.replace('{name}', `${createdDestination.name}, ${createdDestination.country}`) || `${createdDestination.name}, ${createdDestination.country} has been added to Biensperience!`;
      success(message);

      // Reset form
      setFormData({ name: "", state: "", country: "" });

      // Notify parent component
      if (onDestinationCreated) {
        onDestinationCreated(createdDestination);
      }

      // Close modal
      onClose();

    } catch (err) {
      logger.error('Failed to create destination from modal', { error: err.message }, err);
      const errorMsg = handleError(err, { context: 'Create destination' });

      // Check for email verification error
      if (err.response?.data?.code === 'EMAIL_NOT_VERIFIED') {
        setError(err.response.data.error || lang.current.alert.emailNotVerifiedMessage);
      } else {
        setError(errorMsg);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleCancel() {
    setFormData({ name: "", state: "", country: "" });
    setError("");
    onClose();
  }

  return (
    <Modal
      show={show}
      onClose={handleCancel}
      title={lang.current.modal.addNewDestination}
      contentClassName={styles.newDestinationModal}
      footer={
        <>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleCancel}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="quick-destination-form"
            className="btn btn-primary"
            disabled={submitting}
          >
            {submitting ? 'Creating...' : 'Create Destination'}
          </button>
        </>
      }
    >
      <Form id="quick-destination-form" onSubmit={handleSubmit}>
        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
            {error.includes('verify your email') && (
              <div className="mt-2">
                <a href="/resend-confirmation" className="btn btn-sm btn-outline-primary">
                  Resend Verification Email
                </a>
              </div>
            )}
          </div>
        )}

        <FormField
          name="name"
          label="City / Town Name"
          type="text"
          value={formData.name}
          onChange={handleChange}
          placeholder="e.g., Paris, Tokyo, New York"
          required
          tooltip="Enter the city or town name"
          tooltipPlacement="top"
          autoFocus
        />

        <FormField
          name="state"
          label="State / Province"
          type="text"
          value={formData.state}
          onChange={handleChange}
          placeholder="e.g., California, Ontario, Île-de-France"
          tooltip="Enter the state, province, or region (optional)"
          tooltipPlacement="top"
        />

        <FormField
          name="country"
          label="Country"
          type="text"
          value={formData.country}
          onChange={handleChange}
          placeholder="e.g., United States, Canada, France"
          required
          tooltip="Enter the country name"
          tooltipPlacement="top"
        />

        <div className="alert alert-info mb-0">
          <small>
            <strong>Quick Create:</strong> You can add more details (description, photos, travel tips)
            by visiting the <a href="/destinations" target="_blank" rel="noopener noreferrer">destinations page</a> later.
          </small>
        </div>
      </Form>
    </Modal>
  );
}

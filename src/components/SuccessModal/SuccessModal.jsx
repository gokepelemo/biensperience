import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Modal from "../Modal/Modal";
import { FaCheckCircle } from "react-icons/fa";

/**
 * SuccessModal - A modal for celebrating successful form submissions
 *
 * Displays a success message with optional navigation to the created entity.
 * Matches the Storybook SuccessModal design pattern.
 *
 * @param {Object} props
 * @param {boolean} props.show - Whether the modal is visible
 * @param {Function} props.onClose - Handler called when modal closes
 * @param {string} props.title - Success title (default: "Success!")
 * @param {string} props.message - Success message describing what was created
 * @param {string} props.entityName - Name of the created entity (displayed in bold)
 * @param {string} props.entityType - Type of entity (e.g., "experience", "destination")
 * @param {string} props.entityId - ID of the created entity for navigation
 * @param {string} props.continueText - Text for the continue button (default: "Continue")
 * @param {string} props.navigateTo - Custom navigation path (overrides default entity navigation)
 * @param {boolean} props.showViewButton - Show a secondary "View [Entity]" button (default: true)
 */
export default function SuccessModal({
  show,
  onClose,
  title = "Success!",
  message,
  entityName,
  entityType,
  entityId,
  continueText = "Continue",
  navigateTo,
  showViewButton = true
}) {
  const navigate = useNavigate();

  // Determine the navigation path based on entity type
  const getEntityPath = useCallback(() => {
    if (navigateTo) return navigateTo;
    if (!entityId || !entityType) return null;

    switch (entityType.toLowerCase()) {
      case "experience":
        return `/experiences/${entityId}`;
      case "destination":
        return `/destinations/${entityId}`;
      default:
        return null;
    }
  }, [navigateTo, entityId, entityType]);

  // Handle continue button click
  const handleContinue = useCallback(() => {
    const path = getEntityPath();
    onClose();
    if (path) {
      navigate(path);
    }
  }, [getEntityPath, onClose, navigate]);

  // Handle close without navigation
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Get entity type display name
  const getEntityTypeDisplay = () => {
    if (!entityType) return "Entity";
    return entityType.charAt(0).toUpperCase() + entityType.slice(1);
  };

  // Build custom content (no header/footer from Modal)
  const content = (
    <div style={{
      padding: 'var(--space-8)',
      textAlign: 'center',
    }}>
      {/* Success Icon */}
      <div style={{
        width: '80px',
        height: '80px',
        borderRadius: 'var(--radius-full)',
        backgroundColor: 'var(--color-success-light)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto var(--space-6)',
      }}>
        <FaCheckCircle style={{
          fontSize: 'var(--font-size-4xl)',
          color: 'var(--color-success)',
        }} />
      </div>

      {/* Title */}
      <h2 style={{
        fontSize: 'var(--font-size-2xl)',
        fontWeight: 'var(--font-weight-bold)',
        color: 'var(--color-text-primary)',
        marginBottom: 'var(--space-3)',
      }}>
        {title}
      </h2>

      {/* Message with optional entity name */}
      <p style={{
        fontSize: 'var(--font-size-base)',
        color: 'var(--color-text-secondary)',
        marginBottom: 'var(--space-6)',
        lineHeight: 'var(--line-height-relaxed)',
      }}>
        {message}
        {entityName && (
          <>
            {' '}<strong>"{entityName}"</strong>
          </>
        )}
        {message && '.'}
      </p>

      {/* Buttons */}
      <div style={{
        display: 'flex',
        gap: 'var(--space-3)',
        justifyContent: 'center',
        flexWrap: 'wrap',
      }}>
        {showViewButton && getEntityPath() && (
          <button
            type="button"
            className="btn btn-outline-primary"
            onClick={handleClose}
            style={{
              borderRadius: 'var(--radius-full)',
              padding: 'var(--space-3) var(--space-6)',
              fontWeight: 'var(--font-weight-medium)',
            }}
          >
            Create Another
          </button>
        )}
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleContinue}
          style={{
            borderRadius: 'var(--radius-full)',
            padding: 'var(--space-3) var(--space-8)',
            fontWeight: 'var(--font-weight-semibold)',
          }}
        >
          {getEntityPath() ? `View ${getEntityTypeDisplay()}` : continueText}
        </button>
      </div>
    </div>
  );

  return (
    <Modal
      show={show}
      onClose={handleClose}
      centered={true}
      showSubmitButton={false}
      showCloseButton={false}
    >
      {content}
    </Modal>
  );
}

import './PhotoModal.css';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { sanitizeText, sanitizeUrl } from '../../utilities/sanitize';

export default function PhotoModal({ photo, onClose }) {
  // Close modal on Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);

    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [onClose]);

  if (!photo) return null;

  // Sanitize user-controlled content to prevent XSS
  const sanitizedCredit = sanitizeText(photo.photo_credit);
  const sanitizedCreditUrl = sanitizeUrl(photo.photo_credit_url);

  const modalContent = (
    <div
      className="photo-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
    >
      <div
        className="photo-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="photo-modal-close"
          onClick={onClose}
          aria-label="Close photo viewer"
        >
          ✕
        </button>

        <img
          src={photo.url}
          alt={photo.photo_credit || 'Photo'}
          className="photo-modal-image"
        />

        {sanitizedCredit && (
          <div className="photo-modal-credits">
            <span>Photo by: </span>
            {sanitizedCreditUrl ? (
              <a
                href={sanitizedCreditUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                {sanitizedCredit}
              </a>
            ) : (
              <span>{sanitizedCredit}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // Render modal at document body level using a portal
  return createPortal(modalContent, document.body);
}

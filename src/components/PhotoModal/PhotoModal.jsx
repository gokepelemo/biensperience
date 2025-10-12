import './PhotoModal.css';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';

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

        {photo.photo_credit && (
          <div className="photo-modal-credits">
            <span>Photo by: </span>
            {photo.photo_credit_url ? (
              <a
                href={photo.photo_credit_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                {photo.photo_credit}
              </a>
            ) : (
              <span>{photo.photo_credit}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // Render modal at document body level using a portal
  return createPortal(modalContent, document.body);
}

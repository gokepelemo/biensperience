import './PhotoModal.css';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { sanitizeText, sanitizeUrl } from '../../utilities/sanitize';
import { getPhotoIndexById } from '../../utilities/photo-utils';
import { logger } from '../../utilities/logger';

export default function PhotoModal({ photo, photos, onClose, onNavigate }) {
  // Get current photo index
  const currentIndex = photos && photo ? getPhotoIndexById(photos, photo._id) : -1;
  const hasMultiplePhotos = photos && photos.length > 1;
  const hasPrevious = hasMultiplePhotos && currentIndex > 0;
  const hasNext = hasMultiplePhotos && currentIndex < photos.length - 1;

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && hasPrevious && onNavigate) {
        e.preventDefault();
        const prevPhoto = photos[currentIndex - 1];
        logger.debug('Navigating to previous photo', { currentIndex, photoId: prevPhoto._id });
        onNavigate(prevPhoto);
      } else if (e.key === 'ArrowRight' && hasNext && onNavigate) {
        e.preventDefault();
        const nextPhoto = photos[currentIndex + 1];
        logger.debug('Navigating to next photo', { currentIndex, photoId: nextPhoto._id });
        onNavigate(nextPhoto);
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [onClose, onNavigate, photos, currentIndex, hasPrevious, hasNext]);

  if (!photo) return null;

  // Sanitize user-controlled content to prevent XSS
  const sanitizedCredit = sanitizeText(photo.photo_credit);
  const sanitizedCreditUrl = sanitizeUrl(photo.photo_credit_url);

  // Navigation handlers
  const handlePrevious = () => {
    if (hasPrevious && onNavigate) {
      const prevPhoto = photos[currentIndex - 1];
      logger.debug('Clicking previous photo', { currentIndex, photoId: prevPhoto._id });
      onNavigate(prevPhoto);
    }
  };

  const handleNext = () => {
    if (hasNext && onNavigate) {
      const nextPhoto = photos[currentIndex + 1];
      logger.debug('Clicking next photo', { currentIndex, photoId: nextPhoto._id });
      onNavigate(nextPhoto);
    }
  };

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

        {/* Previous button */}
        {hasPrevious && onNavigate && (
          <button
            className="photo-modal-nav photo-modal-nav-prev"
            onClick={handlePrevious}
            aria-label="Previous photo"
          >
            ‹
          </button>
        )}

        {/* Next button */}
        {hasNext && onNavigate && (
          <button
            className="photo-modal-nav photo-modal-nav-next"
            onClick={handleNext}
            aria-label="Next photo"
          >
            ›
          </button>
        )}

        <img
          src={photo.url}
          alt={photo.photo_credit || 'Photo'}
          className="photo-modal-image"
        />

        {/* Photo counter */}
        {hasMultiplePhotos && (
          <div className="photo-modal-counter">
            {currentIndex + 1} / {photos.length}
          </div>
        )}

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

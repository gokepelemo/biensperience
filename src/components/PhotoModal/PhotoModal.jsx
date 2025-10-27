import './PhotoModal.css';
import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { sanitizeText, sanitizeUrl } from '../../utilities/sanitize';

export default function PhotoModal({ photo, photos = [], onClose, initialIndex = 0 }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  
  // Support both single photo and array of photos
  const photoArray = photos.length > 0 ? photos : (photo ? [photo] : []);
  const currentPhoto = photoArray[currentIndex];
  const hasMultiplePhotos = photoArray.length > 1;

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prevIndex) => 
      prevIndex > 0 ? prevIndex - 1 : photoArray.length - 1
    );
  }, [photoArray.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prevIndex) => 
      prevIndex < photoArray.length - 1 ? prevIndex + 1 : 0
    );
  }, [photoArray.length]);

  // Close modal on Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    // Handle arrow key navigation for multiple photos
    const handleArrowKeys = (e) => {
      if (!hasMultiplePhotos) return;
      
      if (e.key === 'ArrowLeft') {
        goToPrevious();
      } else if (e.key === 'ArrowRight') {
        goToNext();
      }
    };

    document.addEventListener('keydown', handleEscape);
    if (hasMultiplePhotos) {
      document.addEventListener('keydown', handleArrowKeys);
    }

    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('keydown', handleArrowKeys);
      document.body.style.overflow = 'unset';
    };
  }, [onClose, hasMultiplePhotos, goToNext, goToPrevious]);

  if (!currentPhoto) return null;

  // Sanitize user-controlled content to prevent XSS
  const sanitizedCredit = sanitizeText(currentPhoto.photo_credit);
  const sanitizedCreditUrl = sanitizeUrl(currentPhoto.photo_credit_url);

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

        {/* Navigation buttons for multiple photos */}
        {hasMultiplePhotos && (
          <>
            <button
              className="photo-modal-nav photo-modal-nav-prev"
              onClick={(e) => {
                e.stopPropagation();
                goToPrevious();
              }}
              aria-label="Previous photo"
            >
              <FaChevronLeft />
            </button>
            <button
              className="photo-modal-nav photo-modal-nav-next"
              onClick={(e) => {
                e.stopPropagation();
                goToNext();
              }}
              aria-label="Next photo"
            >
              <FaChevronRight />
            </button>
          </>
        )}

        {/* Image counter for multiple photos */}
        {hasMultiplePhotos && (
          <div className="photo-modal-counter">
            {currentIndex + 1} of {photoArray.length}
          </div>
        )}

        <img
          src={currentPhoto.url}
          alt={currentPhoto.photo_credit || 'Photo'}
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

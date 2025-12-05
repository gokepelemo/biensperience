import styles from './PhotoModal.module.scss';
import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { sanitizeText, sanitizeUrl } from '../../utilities/sanitize';
import { lang } from '../../lang.constants';

export default function PhotoModal({ photo, photos = [], onClose, initialIndex = 0 }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  
  // Update currentIndex when initialIndex changes (e.g., when user switches photos in PhotoCard)
  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);
  
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

    // Handle comprehensive keyboard navigation for multiple photos
    const handleKeyboardNavigation = (e) => {
      if (!hasMultiplePhotos) return;

      // Arrow key navigation
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPrevious();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToNext();
      }
      // Home/End keys
      else if (e.key === 'Home') {
        e.preventDefault();
        setCurrentIndex(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setCurrentIndex(photoArray.length - 1);
      }
      // Number keys (1-9) to jump to specific photos
      else if (e.key >= '1' && e.key <= '9') {
        const num = parseInt(e.key) - 1; // Convert 1-9 to 0-8
        if (num < photoArray.length) {
          e.preventDefault();
          setCurrentIndex(num);
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    if (hasMultiplePhotos) {
      document.addEventListener('keydown', handleKeyboardNavigation);
    }

    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('keydown', handleKeyboardNavigation);
      document.body.style.overflow = 'unset';
    };
  }, [onClose, hasMultiplePhotos, goToNext, goToPrevious, photoArray.length]);

  if (!currentPhoto) return null;

  // Sanitize user-controlled content to prevent XSS
  const sanitizedCredit = sanitizeText(currentPhoto.photo_credit);
  const sanitizedCreditUrl = sanitizeUrl(currentPhoto.photo_credit_url);

  const modalContent = (
    <div
      className={styles.photoModalOverlay}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={lang.current.aria.photoViewer}
    >
      <div
        className={styles.photoModalContent}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className={styles.photoModalClose}
          onClick={onClose}
          aria-label={lang.current.aria.closePhotoViewer}
        >
          ✕
        </button>

        {/* Navigation buttons for multiple photos */}
        {hasMultiplePhotos && (
          <>
            <button
              className={`${styles.photoModalNav} ${styles.photoModalNavPrev}`}
              onClick={(e) => {
                e.stopPropagation();
                goToPrevious();
              }}
              aria-label={lang.current.aria.previousPhoto}
            >
              <FaChevronLeft />
            </button>
            <button
              className={`${styles.photoModalNav} ${styles.photoModalNavNext}`}
              onClick={(e) => {
                e.stopPropagation();
                goToNext();
              }}
              aria-label={lang.current.aria.nextPhoto}
            >
              <FaChevronRight />
            </button>
          </>
        )}

        {/* Image counter for multiple photos */}
        {hasMultiplePhotos && (
          <div className={styles.photoModalCounter}>
            {currentIndex + 1} of {photoArray.length}
          </div>
        )}

        <img
          src={currentPhoto.url}
          alt={currentPhoto.photo_credit || 'Photo'}
          className={styles.photoModalImage}
        />

        {/* Thumbnail Navigation for multiple photos */}
        {hasMultiplePhotos && (
          <div className={styles.photoModalThumbnails}>
            {photoArray.map((photo, index) => (
              <div
                key={index}
                className={`${styles.photoModalThumbnail} ${index === currentIndex ? styles.active : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(index);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setCurrentIndex(index);
                  }
                }}
                aria-label={`View photo ${index + 1} of ${photoArray.length}${index === currentIndex ? ' (current)' : ''}`}
                title={(photo.photo_credit && photo.photo_credit.toLowerCase() !== 'biensperience') ? photo.photo_credit : `Photo ${index + 1}`}
              >
                <img
                  src={photo.url}
                  alt={`Thumbnail ${index + 1}`}
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        )}

        {/* Photo credit - hide "Biensperience" default */}
        {sanitizedCredit && sanitizedCredit.toLowerCase() !== "biensperience" && (
          <div className={styles.photoModalCredits}>
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

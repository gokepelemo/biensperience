import styles from './PhotoModal.module.scss';
import { useEffect, useState, useCallback, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { sanitizeText, sanitizeUrl } from '../../utilities/sanitize';
import { lang } from '../../lang.constants';
import { useScrollLock } from '../../hooks/useScrollLock';

/**
 * PhotoModal - Lightbox image viewer with gallery navigation
 *
 * Specialized photo viewer modal using portal rendering with custom overlay,
 * arrow/thumbnail navigation, and keyboard controls. Enhanced with
 * comprehensive accessibility: focus trapping, unique ARIA IDs, aria-live
 * announcements, aria-roledescription, and proper keyboard navigation.
 *
 * Migrated to Chakra UI via design-system abstraction pattern with
 * accessibility enhancements consistent with the modal migration standard.
 *
 * Task: biensperience-23c0
 */

export default function PhotoModal({ photo, photos = [], onClose, initialIndex = 0 }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const id = useId();
  const modalRef = useRef(null);
  const previousFocusRef = useRef(null);

  // Lock body scroll — coordinates with other modals via global ref counter
  useScrollLock(true);
  
  // Update currentIndex when initialIndex changes (e.g., when user switches photos in PhotoCard)
  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  // Focus management: capture previous focus and restore on close
  useEffect(() => {
    previousFocusRef.current = document.activeElement;

    // Focus the modal container on open for keyboard trapping
    const timer = setTimeout(() => {
      modalRef.current?.focus();
    }, 0);

    return () => {
      clearTimeout(timer);
      // Restore focus to the element that opened the modal
      previousFocusRef.current?.focus?.();
    };
  }, []);
  
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
      // Tab trapping within modal
      if (e.key === 'Tab') {
        const focusableElements = modalRef.current?.querySelectorAll(
          'button, [href], [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements && focusableElements.length > 0) {
          const first = focusableElements[0];
          const last = focusableElements[focusableElements.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
        return;
      }

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
    document.addEventListener('keydown', handleKeyboardNavigation);

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('keydown', handleKeyboardNavigation);
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
      aria-roledescription="image viewer"
      ref={modalRef}
      tabIndex={-1}
    >
      <div
        className={styles.photoModalContent}
        onClick={(e) => e.stopPropagation()}
        role="document"
      >
        <button
          className={styles.photoModalClose}
          onClick={onClose}
          aria-label={lang.current.aria.closePhotoViewer}
        >
          <span aria-hidden="true">✕</span>
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
              <FaChevronLeft aria-hidden="true" />
            </button>
            <button
              className={`${styles.photoModalNav} ${styles.photoModalNavNext}`}
              onClick={(e) => {
                e.stopPropagation();
                goToNext();
              }}
              aria-label={lang.current.aria.nextPhoto}
            >
              <FaChevronRight aria-hidden="true" />
            </button>
          </>
        )}

        {/* Image counter for multiple photos */}
        {hasMultiplePhotos && (
          <div
            className={styles.photoModalCounter}
            aria-live="polite"
            aria-atomic="true"
            role="status"
          >
            {lang.current.photoModal.counter.replace('{current}', currentIndex + 1).replace('{total}', photoArray.length)}
          </div>
        )}

        <img
          src={currentPhoto.url}
          alt={currentPhoto.photo_credit || 'Photo'}
          className={styles.photoModalImage}
          id={`${id}-current-image`}
        />

        {/* Thumbnail Navigation for multiple photos */}
        {hasMultiplePhotos && (
          <div
            className={styles.photoModalThumbnails}
            role="tablist"
            aria-label="Photo thumbnails"
          >
            {photoArray.map((p, index) => (
              <div
                key={index}
                className={`${styles.photoModalThumbnail} ${index === currentIndex ? styles.active : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(index);
                }}
                role="tab"
                tabIndex={index === currentIndex ? 0 : -1}
                aria-selected={index === currentIndex}
                aria-label={`${lang.current.photoThumbnail.viewPhoto.replace('{index}', index + 1)} ${lang.current.photoModal.counter.replace('{current}', '').replace('{total}', photoArray.length).trim()}${index === currentIndex ? ' (current)' : ''}`}
                aria-controls={`${id}-current-image`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setCurrentIndex(index);
                  }
                }}
                title={(p.photo_credit && p.photo_credit.toLowerCase() !== 'biensperience') ? p.photo_credit : lang.current.photoModal.thumbnailTitle.replace('{index}', index + 1)}
              >
                <img
                  src={p.url}
                  alt={lang.current.photoModal.thumbnailAlt.replace('{index}', index + 1)}
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        )}

        {/* Photo credit - hide "Biensperience" default */}
        {sanitizedCredit && sanitizedCredit.toLowerCase() !== "biensperience" && (
          <div className={styles.photoModalCredits}>
            <span>{lang.current.photoModal.photoBy} </span>
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

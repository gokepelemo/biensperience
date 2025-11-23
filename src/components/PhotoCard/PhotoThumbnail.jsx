import styles from "./PhotoThumbnail.module.scss";
import { useMemo, useState, useEffect } from "react";
import { lang } from "../../lang.constants";
import { sanitizeText } from "../../utilities/sanitize";
import { calculateAspectRatio } from "../../utilities/image-utils";

export default function PhotoThumbnail({
  photo,
  photos,
  defaultPhotoIndex,
  altText,
  title,
  selectedIndex,
  photoIndex,
  onSelect,
  showDefaultBadge = false
}) {
  const rand = useMemo(() => Math.floor(Math.random() * 50), []);
  const imageAlt = altText || title || lang.en.image.alt.photo;

  // Determine photos array
  const photoArray = useMemo(() => {
    if (photos && photos.length > 0) {
      return photos;
    }
    if (photo) {
      // Handle single photo prop - convert to array format
      return [photo];
    }
    return [];
  }, [photos, photo]);

  const defaultIndex = defaultPhotoIndex || 0;
  const [imageLoading, setImageLoading] = useState(true);
  const [imageStyle, setImageStyle] = useState({});

  // Use the selectedIndex from props, or default to the first photo
  const currentIndex = selectedIndex !== undefined && selectedIndex < photoArray.length ? selectedIndex : defaultIndex;
  const currentPhoto = photoArray[currentIndex];

  // Create placeholder photo object when no photos available
  const placeholderPhoto = useMemo(() => ({
    url: `https://picsum.photos/600?rand=${rand}`,
    photo_credit: null,
    photo_credit_url: null,
    width: 600, // Placeholder dimensions for layout shift prevention
    height: 400
  }), [rand]);

  // Use actual photo or placeholder
  const displayPhoto = photoArray.length > 0 ? currentPhoto : placeholderPhoto;
  const hasRealPhotos = photoArray.length > 0;

  // Calculate aspect ratio for layout shift prevention
  const aspectRatio = useMemo(() => {
    return calculateAspectRatio(displayPhoto.width, displayPhoto.height);
  }, [displayPhoto.width, displayPhoto.height]);

  // Reset loading state when photo changes
  useEffect(() => {
    setImageLoading(true);
    setImageStyle({});

    // Fallback timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      setImageLoading(false);
    }, 5000); // 5 second timeout

    return () => clearTimeout(timeout);
  }, [displayPhoto.url]);

  /**
   * Handle image load and resize if needed
   * If image height is less than container height, resize to fill
   */
  const handleImageLoad = (e) => {
    const img = e.target;
    const containerHeight = img.parentElement.offsetHeight;
    const imageHeight = img.naturalHeight;

    // If image is smaller than container, scale it up to fill the height
    if (imageHeight < containerHeight) {
      setImageStyle({
        height: '100%',
        width: 'auto',
        maxWidth: '100%',
        objectFit: 'cover'
      });
    } else {
      setImageStyle({
        height: '100%',
        objectFit: 'contain'
      });
    }

    setImageLoading(false);
  };

  // Sanitize user-controlled content to prevent XSS
  const sanitizedCredit = sanitizeText(displayPhoto.photo_credit);

  const handleClick = (e) => {
    e.stopPropagation();
    if (onSelect) {
      onSelect(photoIndex);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick(e);
    }
  };

  return (
    <div
      className={`${styles.photoThumbnail} ${photoIndex === selectedIndex ? styles.active : ''}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label={`View photo ${photoIndex + 1}${showDefaultBadge ? ' (default)' : ''}`}
    >
      <div
        className={`${styles.photoThumbnailContainer} d-flex align-items-center justify-content-center`}
        style={{
          cursor: 'pointer',
          aspectRatio: aspectRatio
        }}
      >
        {imageLoading && (
          <div className={styles.photoThumbnailLoader}>
            <div className={styles.thumbnailLoadingSpinner}></div>
          </div>
        )}
        <img
          src={displayPhoto.url}
          className="img-fluid"
          alt={hasRealPhotos ? `${imageAlt} thumbnail ${photoIndex + 1}` : `${imageAlt} placeholder thumbnail`}
          title={hasRealPhotos ? (sanitizedCredit || `${imageAlt} ${photoIndex + 1}`) : undefined}
          loading="lazy"
          decoding="async"
          role={hasRealPhotos ? undefined : "presentation"}
          onLoad={handleImageLoad}
          onError={() => setImageLoading(false)}
          style={{
            ...imageStyle,
            opacity: imageLoading ? 0 : 1,
            transition: 'opacity 0.3s ease-in'
          }}
        />
      </div>

      {showDefaultBadge && currentIndex === defaultIndex && (
        <span className={styles.thumbnailDefaultBadge} aria-label="Default photo">★</span>
      )}
    </div>
  );
}
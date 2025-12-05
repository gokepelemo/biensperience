import styles from "./PhotoCard.module.scss";
import { useMemo, useState, useEffect, useRef } from "react";
import { lang } from "../../lang.constants";
import PhotoModal from "../PhotoModal/PhotoModal";
import Loading from "../Loading/Loading";
import PhotoThumbnail from "./PhotoThumbnail";
import { sanitizeText, sanitizeUrl } from "../../utilities/sanitize";
import { calculateAspectRatio } from "../../utilities/image-utils";
import EntitySchema from "../OpenGraph/EntitySchema";

export default function PhotoCard({ photos, defaultPhotoId, altText, title, includeSchema = false }) {
  const rand = useMemo(() => Math.floor(Math.random() * 50), []);
  const imageAlt = altText || title || lang.current.image.alt.photo;

  const photoArray = useMemo(() => {
    return photos && photos.length > 0 ? photos : [];
  }, [photos]);

  // Find default photo index by ID
  const defaultIndex = useMemo(() => {
    if (defaultPhotoId && photoArray.length > 0) {
      const index = photoArray.findIndex(p => p._id?.toString() === defaultPhotoId?.toString());
      return index >= 0 ? index : 0;
    }
    return 0;
  }, [photoArray, defaultPhotoId]);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(defaultIndex);
  const [showModal, setShowModal] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageStyle, setImageStyle] = useState({});
  const [showScrollButtons, setShowScrollButtons] = useState(false);
  const thumbnailsRef = useRef(null);

  // Ensure selected index is valid
  const currentIndex = selectedPhotoIndex < photoArray.length ? selectedPhotoIndex : defaultIndex;
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

  // Calculate the container height based on the tallest image
  // This ensures all images in the array can fit without cropping
  const containerAspectRatio = useMemo(() => {
    if (photoArray.length === 0) {
      // Use placeholder aspect ratio
      return calculateAspectRatio(placeholderPhoto.width, placeholderPhoto.height);
    }
    
    // Find the tallest aspect ratio (smallest ratio value = tallest relative height)
    // For example: 4/3 = 1.33 (landscape), 3/4 = 0.75 (portrait, taller)
    const tallestAspectRatio = photoArray.reduce((minRatio, photo) => {
      if (!photo.width || !photo.height) return minRatio;
      const ratio = calculateAspectRatio(photo.width, photo.height);
      // Smaller ratio = taller image
      return ratio < minRatio ? ratio : minRatio;
    }, Infinity);
    
    // If no valid dimensions found, use placeholder dimensions
    if (tallestAspectRatio === Infinity) {
      return calculateAspectRatio(placeholderPhoto.width, placeholderPhoto.height);
    }
    
    return tallestAspectRatio;
  }, [photoArray, placeholderPhoto.width, placeholderPhoto.height]);

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

  // Check if thumbnails overflow and need scroll buttons
  useEffect(() => {
    const checkOverflow = () => {
      if (thumbnailsRef.current) {
        const { scrollWidth, clientWidth } = thumbnailsRef.current;
        setShowScrollButtons(scrollWidth > clientWidth);
      }
    };

    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [photoArray.length]);

  // Scroll thumbnails left or right
  const scrollThumbnails = (direction) => {
    if (thumbnailsRef.current) {
      const scrollAmount = 200; // Scroll 200px at a time
      const newScrollLeft = direction === 'left'
        ? thumbnailsRef.current.scrollLeft - scrollAmount
        : thumbnailsRef.current.scrollLeft + scrollAmount;

      thumbnailsRef.current.scrollTo({
        left: newScrollLeft,
        behavior: 'smooth'
      });
    }
  };

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
  const sanitizedCreditUrl = sanitizeUrl(displayPhoto.photo_credit_url);

  return (
    <>
      <figure className="photoFrame" role="img" aria-label={imageAlt}>
      <div
        className={`${styles.photoCard} d-flex align-items-center justify-content-center`}
        onClick={() => setShowModal(true)}
        style={{ aspectRatio: containerAspectRatio }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            setShowModal(true);
          }
        }}
        aria-label="Click to view full size photo"
      >
        {imageLoading && (
          <div className={styles.photoLoader}>
            <Loading size="md" showMessage={false} />
          </div>
        )}
        <img
          src={displayPhoto.url}
          className={`img-fluid ${imageLoading ? 'loading' : 'loaded'}`}
          alt={hasRealPhotos ? imageAlt : `${imageAlt} placeholder`}
          title={hasRealPhotos ? ((sanitizedCredit && sanitizedCredit.toLowerCase() !== 'biensperience') ? sanitizedCredit : title) : undefined}
          loading="lazy"
          decoding="async"
          role={hasRealPhotos ? undefined : "presentation"}
          onLoad={handleImageLoad}
          onError={() => setImageLoading(false)}
          style={imageStyle}
        />
      </div>

      {/* Thumbnails - only show when there's more than 1 photo */}
      {hasRealPhotos && photoArray.length > 1 && (
        <div className={styles.photoThumbnailsContainer}>
          {showScrollButtons && (
            <button
              className={`${styles.thumbnailScrollButton} ${styles.thumbnailScrollLeft}`}
              onClick={() => scrollThumbnails('left')}
              aria-label="Scroll thumbnails left"
              type="button"
            >
              ‹
            </button>
          )}
          <div className={styles.photoThumbnails} ref={thumbnailsRef}>
            {photoArray.map((photo, index) => (
              <PhotoThumbnail
                key={index}
                photo={photo}
                altText={imageAlt}
                title={title}
                selectedIndex={currentIndex}
                photoIndex={index}
                onSelect={setSelectedPhotoIndex}
                showDefaultBadge={index === defaultIndex}
              />
            ))}
          </div>
          {showScrollButtons && (
            <button
              className={`${styles.thumbnailScrollButton} ${styles.thumbnailScrollRight}`}
              onClick={() => scrollThumbnails('right')}
              aria-label="Scroll thumbnails right"
              type="button"
            >
              ›
            </button>
          )}
        </div>
      )}

      {/* Photo credit - only show for real photos with credit info, hide "Biensperience" default */}
      {hasRealPhotos && sanitizedCredit && sanitizedCredit !== "undefined" && sanitizedCredit.toLowerCase() !== "biensperience" && (
        <figcaption className={styles.photoCreditBlock}>
          <small>
            Photo by{" "}
            {sanitizedCreditUrl ? (
              <a
                href={sanitizedCreditUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Photo by ${sanitizedCredit}, opens in new window`}
              >
                {sanitizedCredit}
              </a>
            ) : (
              sanitizedCredit
            )}
          </small>
        </figcaption>
      )}

      {/* Photo Modal - works for both real and placeholder photos */}
      {showModal && (
        <PhotoModal
          photo={displayPhoto}
          photos={photoArray}
          initialIndex={currentIndex}
          onClose={() => setShowModal(false)}
        />
      )}
    </figure>
    {includeSchema && displayPhoto && (
      <EntitySchema entity={displayPhoto} entityType="photo" />
    )}
  </>
);
}

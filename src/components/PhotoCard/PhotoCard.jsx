import "./PhotoCard.css";
import { useMemo, useState, useEffect } from "react";
import { lang } from "../../lang.constants";
import PhotoModal from "../PhotoModal/PhotoModal";
import { sanitizeText, sanitizeUrl } from "../../utilities/sanitize";

export default function PhotoCard({ photo, photos, defaultPhotoIndex, altText, title }) {
  const rand = useMemo(() => Math.floor(Math.random() * 50), []);
  const imageAlt = altText || title || lang.en.image.alt.photo;

  // Determine photos array
  const photoArray = useMemo(() => {
    if (photos && photos.length > 0) {
      return photos;
    }
    return [];
  }, [photos]);

  const defaultIndex = defaultPhotoIndex || 0;
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(defaultIndex);
  const [showModal, setShowModal] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageStyle, setImageStyle] = useState({});

  // Ensure selected index is valid
  const currentIndex = selectedPhotoIndex < photoArray.length ? selectedPhotoIndex : defaultIndex;
  const currentPhoto = photoArray[currentIndex];

  // Create placeholder photo object when no photos available
  const placeholderPhoto = useMemo(() => ({
    url: `https://picsum.photos/600?rand=${rand}`,
    photo_credit: null,
    photo_credit_url: null
  }), [rand]);

  // Use actual photo or placeholder
  const displayPhoto = photoArray.length > 0 ? currentPhoto : placeholderPhoto;
  const hasRealPhotos = photoArray.length > 0;

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
  const sanitizedCreditUrl = sanitizeUrl(displayPhoto.photo_credit_url);

  return (
    <figure className="photoFrame" role="img" aria-label={imageAlt}>
      <div
        className="photoCard d-flex align-items-center justify-content-center"
        onClick={() => setShowModal(true)}
        style={{ cursor: 'pointer' }}
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
          <div className="photo-loader">
            <div className="photo-loader-circle"></div>
          </div>
        )}
        <img
          src={displayPhoto.url}
          className="rounded img-fluid"
          alt={hasRealPhotos ? imageAlt : `${imageAlt} placeholder`}
          title={hasRealPhotos ? (sanitizedCredit || title) : undefined}
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

      {/* Thumbnails - only show for real photos with multiple items */}
      {hasRealPhotos && photoArray.length > 1 && (
        <div className="photo-thumbnails">
          {photoArray.map((photo, index) => (
            <div
              key={index}
              className={`photo-thumbnail ${index === currentIndex ? 'active' : ''}`}
              onClick={() => setSelectedPhotoIndex(index)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setSelectedPhotoIndex(index);
                }
              }}
              aria-label={`View photo ${index + 1}${index === defaultIndex ? ' (default)' : ''}`}
            >
              <img
                src={photo.url}
                alt={`${imageAlt} thumbnail ${index + 1}`}
                loading="lazy"
              />
              {index === defaultIndex && (
                <span className="default-badge" aria-label="Default photo">★</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Photo credit - only show for real photos with credit info */}
      {hasRealPhotos && sanitizedCredit && sanitizedCredit !== "undefined" && (
        <figcaption className="photo-credit-block">
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
          onClose={() => setShowModal(false)}
        />
      )}
    </figure>
  );
}

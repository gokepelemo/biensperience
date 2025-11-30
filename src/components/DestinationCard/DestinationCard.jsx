import styles from "./DestinationCard.module.scss";
import { Link } from "react-router-dom";
import { useMemo, memo, useRef, useEffect, useState } from "react";
import SkeletonLoader from "../SkeletonLoader/SkeletonLoader";
import EntitySchema from "../OpenGraph/EntitySchema";
import imagePreloader from '../../utilities/image-preloader';

/**
 * Destination card component that displays a destination with background image and title.
 * Automatically adjusts font size to fit the card dimensions.
 *
 * @param {Object} props - Component props
 * @param {Object} props.destination - Destination object
 * @param {string} props.destination._id - Unique identifier for the destination
 * @param {string} props.destination.name - Display name of the destination
 * @param {string} [props.destination.photo] - Background image URL for the destination
 * @returns {JSX.Element} Destination card component
 */
function DestinationCard({ destination, includeSchema = false, forcePreload = false }) {
  const rand = useMemo(() => Math.floor(Math.random() * 50), []);
  const titleRef = useRef(null);
  const containerRef = useRef(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Get background image URL from destination photos or fallback to placeholder
  const { imageSrc, backgroundImage } = useMemo(() => {
    if (!destination) {
      const src = `https://picsum.photos/400?rand=${rand}`;
      return { imageSrc: src, backgroundImage: `url(${src})` };
    }

    // If photos array exists and has items, use the default one
    if (destination.photos && destination.photos.length > 0) {
      let defaultPhoto;
      if (destination.default_photo_id) {
        defaultPhoto = destination.photos.find(photo => photo._id === destination.default_photo_id);
      }
      // Fallback to first photo if default not found or not set
      if (!defaultPhoto) {
        defaultPhoto = destination.photos[0];
      }
      const src = defaultPhoto?.url || `https://picsum.photos/400?rand=${rand}`;
      return { imageSrc: src, backgroundImage: `url(${src})` };
    }

    // If single photo exists
    if (destination.photo && destination.photo.url) {
      const src = destination.photo.url;
      return { imageSrc: src, backgroundImage: `url(${src})` };
    }

    // Fallback to placeholder
    const src = `https://picsum.photos/400?rand=${rand}`;
    return { imageSrc: src, backgroundImage: `url(${src})` };
  }, [destination, rand]);

  // Use shared image preloader utility to ensure skeleton overlay exists and load image
  useEffect(() => {
    setImageLoaded(false);
    if (!imageSrc) {
      setImageLoaded(true);
      return;
    }

    // lazy preload with fallback to immediate load if requested
    const cleanup = imagePreloader(containerRef, imageSrc, () => {
      setTimeout(() => setImageLoaded(true), 60);
    }, { forcePreload: forcePreload, rootMargin: '400px' });

    return () => {
      try { cleanup && cleanup(); } catch (e) {}
    };
  }, [imageSrc, forcePreload]);

  /**
   * Dynamically adjusts the font size of the destination title to fit within the card bounds.
   * Reduces font size incrementally until text no longer overflows.
   */
  useEffect(() => {
    const adjustFontSize = () => {
      const element = titleRef.current;
      if (!element) return;

      // Reset to default size first
      element.style.fontSize = '';

      // Get the computed style to find the current font size
      let fontSize = parseFloat(window.getComputedStyle(element).fontSize);
      const minFontSize = 0.65; // rem

      // Check if text is overflowing
      while ((element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth) && fontSize > minFontSize * 16) {
        fontSize -= 0.5;
        element.style.fontSize = `${fontSize}px`;
      }
    };

    // Adjust on mount and when destination changes
    adjustFontSize();

    // Adjust on window resize
    window.addEventListener('resize', adjustFontSize);
    return () => window.removeEventListener('resize', adjustFontSize);
  }, [destination]);

  return (
    <>
      {includeSchema && destination && (
        <EntitySchema entity={destination} entityType="destination" />
      )}
      <div className="d-block m-2" style={{ verticalAlign: 'top' }}>
      {destination ? (
        <div
          ref={containerRef}
          className={`${styles.destinationCard} d-flex flex-column align-items-center justify-content-center p-3 position-relative overflow-hidden`}
          style={{ backgroundImage: backgroundImage }}
        >
          <div
            aria-hidden="true"
            className="position-absolute w-100 h-100 start-0 top-0"
            style={{
              zIndex: 5,
              pointerEvents: 'none',
              transition: 'opacity 260ms ease',
              opacity: imageLoaded ? 0 : 1
            }}
          >
            <SkeletonLoader variant="rectangle" width="100%" height="100%" />
          </div>
          <Link to={`/destinations/${destination._id}`} className={`${styles.destinationCardLink} d-flex align-items-center justify-content-center w-100 h-100 text-decoration-none`}>
            <span ref={titleRef} className={`h3 fw-bold ${styles.destinationCardTitle} d-flex align-items-center justify-content-center text-center p-3 w-100`}>
              {destination.name}
            </span>
          </Link>
        </div>
      ) : (
        <div
          ref={containerRef}
          className={`${styles.destinationCard} d-flex flex-column align-items-center justify-content-center p-3 position-relative overflow-hidden`}
          style={{ backgroundImage: backgroundImage }}
        >
          <div
            aria-hidden="true"
            className="position-absolute w-100 h-100 start-0 top-0"
            style={{
              zIndex: 5,
              pointerEvents: 'none',
              transition: 'opacity 260ms ease',
              opacity: imageLoaded ? 0 : 1
            }}
          >
            <SkeletonLoader variant="rectangle" width="100%" height="100%" />
          </div>
          <Link to="/" className={`${styles.destinationCardLink} d-flex align-items-center justify-content-center w-100 h-100 text-decoration-none`}>
            <span ref={titleRef} className={`h3 fw-bold ${styles.destinationCardTitle} d-flex align-items-center justify-content-center text-center p-3 w-100`}>
              New York
            </span>
          </Link>
        </div>
      )}
    </div>
    </>
  );
}

export default memo(DestinationCard);

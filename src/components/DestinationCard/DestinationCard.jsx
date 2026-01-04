import styles from "./DestinationCard.module.scss";
import { Link } from "react-router-dom";
import { useMemo, memo, useRef, useEffect, useState } from "react";
import SkeletonLoader from "../SkeletonLoader/SkeletonLoader";
import EntitySchema from "../OpenGraph/EntitySchema";
import imagePreloader from '../../utilities/image-preloader';

// In-memory cache of URLs we've already successfully loaded during this session.
// This prevents skeleton re-appearing and redundant preload work on remounts.
const loadedImageUrls = new Set();

/**
 * Destination card component that displays a destination with background image and title.
 * Automatically adjusts font size to fit the card dimensions.
 *
 * @param {Object} props - Component props
 * @param {Object} props.destination - Destination object
 * @param {string} props.destination._id - Unique identifier for the destination
 * @param {string} props.destination.name - Display name of the destination
 * @param {string} [props.destination.photo] - Background image URL for the destination
 * @param {boolean} [props.fluid] - Whether the card should fill its parent container width (for grid layouts)
 * @returns {JSX.Element} Destination card component
 */
function DestinationCard({ destination, includeSchema = false, forcePreload = false, fluid = false }) {
  // Stable seed for placeholder images so they don't change on remount.
  const placeholderSeed = useMemo(() => {
    const id = destination?._id ? String(destination._id) : '';
    const name = destination?.name ? String(destination.name) : '';
    return encodeURIComponent(id || name || 'destination');
  }, [destination?._id, destination?.name]);
  const titleRef = useRef(null);
  const containerRef = useRef(null);
  const prevImageSrcRef = useRef(null);

  // Get background image URL from destination photos or fallback to placeholder
  const { imageSrc, backgroundImage } = useMemo(() => {
    if (!destination) {
      const src = `https://picsum.photos/seed/${placeholderSeed}/800/480`;
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
      const src = defaultPhoto?.url || `https://picsum.photos/seed/${placeholderSeed}/800/480`;
      return { imageSrc: src, backgroundImage: `url(${src})` };
    }

    // If single photo exists
    if (destination.photo && destination.photo.url) {
      const src = destination.photo.url;
      return { imageSrc: src, backgroundImage: `url(${src})` };
    }

    // Fallback to placeholder
    const src = `https://picsum.photos/seed/${placeholderSeed}/800/480`;
    return { imageSrc: src, backgroundImage: `url(${src})` };
  }, [destination, placeholderSeed]);

  // Check if image is already cached in browser to avoid skeleton flash on re-renders
  // This runs synchronously during render to set correct initial state
  const isImageCached = useMemo(() => {
    if (!imageSrc) return true;
    if (loadedImageUrls.has(imageSrc)) return true;
    // Check if image is already in browser cache
    const img = new Image();
    img.src = imageSrc;
    return img.complete && img.naturalHeight > 0;
  }, [imageSrc]);

  // Initialize from cache state so we don't render "no skeleton" and then flip it on.
  const [imageLoaded, setImageLoaded] = useState(() => isImageCached);

  // Use shared image preloader utility to ensure skeleton overlay exists and load image
  // Only reset imageLoaded when the actual URL changes, not on every render
  useEffect(() => {
    // Only reset if image source actually changed to a different URL
    const urlChanged = prevImageSrcRef.current !== imageSrc;
    if (urlChanged) {
      prevImageSrcRef.current = imageSrc;
    }

    if (!imageSrc) {
      setImageLoaded(true);
      return;
    }

    // If we've already loaded this URL in this session, don't re-run preload.
    if (loadedImageUrls.has(imageSrc)) {
      setImageLoaded(true);
      return;
    }

    // Check cache status
    const img = new Image();
    img.src = imageSrc;
    const isCached = img.complete && img.naturalHeight > 0;

    if (isCached) {
      // Image is already cached, no loading needed
      setImageLoaded(true);
      return;
    }

    // Not cached: show skeleton immediately and fade out on load.
    setImageLoaded(false);
    let cancelled = false;

    // lazy preload with fallback to immediate load if requested
    const cleanup = imagePreloader(containerRef, imageSrc, (err) => {
      cancelled = true;
      if (!err) loadedImageUrls.add(imageSrc);
      // Small delay to ensure smooth transition
      setTimeout(() => setImageLoaded(true), 30);
    }, { forcePreload: forcePreload, rootMargin: '400px' });

    return () => {
      cancelled = true;
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

  // Build card class names based on props
  const cardClasses = `${styles.destinationCard} ${fluid ? styles.destinationCardFluid : ''} d-flex flex-column align-items-center justify-content-center p-3 position-relative overflow-hidden`;

  // Derive link and title from destination or use fallback
  const linkTo = destination ? `/destinations/${destination._id}` : '/';
  const title = destination?.name || 'New York';

  return (
    <>
      {includeSchema && destination && (
        <EntitySchema entity={destination} entityType="destination" />
      )}
      <div className={fluid ? '' : 'd-block m-2'} style={fluid ? undefined : { verticalAlign: 'top' }}>
        <div
          ref={containerRef}
          className={cardClasses}
          style={{ backgroundImage: backgroundImage }}
        >
          <div
            aria-hidden="true"
            className="position-absolute w-100 h-100 start-0 top-0"
            style={{
              zIndex: 5,
              pointerEvents: 'none',
              transition: 'opacity 180ms ease-out',
              opacity: imageLoaded ? 0 : 1,
              willChange: 'opacity'
            }}
          >
            <SkeletonLoader variant="rectangle" width="100%" height="100%" />
          </div>
          <Link to={linkTo} className={`${styles.destinationCardLink} d-flex align-items-center justify-content-center w-100 h-100 text-decoration-none`}>
            <span ref={titleRef} className={`h3 fw-bold ${styles.destinationCardTitle} d-flex align-items-center justify-content-center text-center p-3 w-100`}>
              {title}
            </span>
          </Link>
        </div>
      </div>
    </>
  );
}

export default memo(DestinationCard);

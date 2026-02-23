import styles from "./DestinationCard.module.scss";
import { Link } from "react-router-dom";
import { useMemo, memo, useRef, useEffect } from "react";
import { useDataTransition } from "../../hooks/useDataTransition";
import SkeletonLoader from "../SkeletonLoader/SkeletonLoader";
import EntitySchema from "../OpenGraph/EntitySchema";
import useImageFallback from '../../hooks/useImageFallback';

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

  const { containerRef, imageLoaded } = useImageFallback(imageSrc, { forcePreload });

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

  // Subtle animation when destination data changes
  const { transitionClass } = useDataTransition(destination, {
    animation: 'pulse',
    enabled: !!destination?._id,
    selectFields: (d) => ({ name: d?.name, photo: d?.default_photo_id }),
  });

  // Build card class names based on props
  const cardClasses = `${styles.destinationCard} ${fluid ? styles.destinationCardFluid : ''} d-flex flex-column align-items-center justify-content-center p-3 position-relative overflow-hidden ${transitionClass}`;

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

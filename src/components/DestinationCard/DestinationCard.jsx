import "./DestinationCard.css";
import { Link } from "react-router-dom";
import { useMemo, memo, useRef, useEffect } from "react";

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
function DestinationCard({ destination }) {
  const rand = useMemo(() => Math.floor(Math.random() * 50), []);
  const titleRef = useRef(null);

  // Get background image URL from destination photos or fallback to placeholder
  const getBackgroundImage = useMemo(() => {
    if (!destination) {
      return `url(https://picsum.photos/400?rand=${rand})`;
    }
    
    // If photos array exists and has items, use the default one
    if (destination.photos && destination.photos.length > 0) {
      const index = destination.default_photo_index || 0;
      return `url(${destination.photos[index].url})`;
    }
    
    // If single photo exists
    if (destination.photo && destination.photo.url) {
      return `url(${destination.photo.url})`;
    }
    
    // Fallback to placeholder
    return `url(https://picsum.photos/400?rand=${rand})`;
  }, [destination, rand]);

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
    <div className="d-inline-block m-2" style={{ width: 'fit-content', verticalAlign: 'top' }}>
      {destination ? (
        <div
          className="destinationCard d-flex flex-column align-items-center justify-content-center p-3 position-relative overflow-hidden"
          style={{ backgroundImage: getBackgroundImage }}
        >
          <Link to={`/destinations/${destination._id}`} className="destination-card-link d-flex align-items-center justify-content-center w-100 h-100 text-decoration-none">
            <span ref={titleRef} className="h3 fw-bold destination-card-title d-flex align-items-center justify-content-center text-white text-center p-3 w-100">
              {destination.name}
            </span>
          </Link>
        </div>
      ) : (
        <div
          className="destinationCard d-flex flex-column align-items-center justify-content-center p-3 position-relative overflow-hidden"
          style={{ backgroundImage: getBackgroundImage }}
        >
          <Link to="/" className="destination-card-link d-flex align-items-center justify-content-center w-100 h-100 text-decoration-none">
            <span ref={titleRef} className="h3 fw-bold destination-card-title d-flex align-items-center justify-content-center text-white text-center p-3 w-100">
              New York
            </span>
          </Link>
        </div>
      )}
    </div>
  );
}

export default memo(DestinationCard);

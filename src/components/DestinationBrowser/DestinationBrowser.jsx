import { useState } from 'react';
import Autocomplete from '../Autocomplete/Autocomplete';
import './DestinationBrowser.css';

/**
 * DestinationBrowser - Map-based destination listing with filters
 * 
 * @param {Object} props - Component props
 * @param {Array} props.destinations - Array of destination objects
 * @param {string} [props.title] - Browser title
 * @param {string} [props.subtitle] - Browser subtitle
 * @param {boolean} [props.showMap=true] - Show/hide map view
 * @param {function} [props.onDestinationClick] - Callback when destination clicked
 * @param {function} [props.onFilterChange] - Callback when filters change
 * @param {function} [props.onDestinationSelect] - Callback when destination selected from autocomplete
 */
export default function DestinationBrowser({
  destinations = [],
  title = "287 Places in Osaka, Japan",
  subtitle = "Easily book hotels and search places quickly",
  showMap = true,
  onDestinationClick,
  onFilterChange,
  onDestinationSelect
}) {
  const [selectedDestination, setSelectedDestination] = useState(null);

  const handleDestinationSelect = (destination) => {
    setSelectedDestination(destination);
    if (onDestinationSelect) {
      onDestinationSelect(destination);
    }
  };

  return (
    <div className="destination-browser">
      {/* Header */}
      <div className="destination-browser-header">
        <div>
          <h1 className="destination-browser-title">{title}</h1>
          <p className="destination-browser-subtitle">{subtitle}</p>
        </div>
        <div className="destination-browser-actions">
          <button className="btn-icon" aria-label="Share">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M15 6.66667C16.3807 6.66667 17.5 5.54738 17.5 4.16667C17.5 2.78595 16.3807 1.66667 15 1.66667C13.6193 1.66667 12.5 2.78595 12.5 4.16667C12.5 5.54738 13.6193 6.66667 15 6.66667Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M5 12.5C6.38071 12.5 7.5 11.3807 7.5 10C7.5 8.61929 6.38071 7.5 5 7.5C3.61929 7.5 2.5 8.61929 2.5 10C2.5 11.3807 3.61929 12.5 5 12.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M15 18.3333C16.3807 18.3333 17.5 17.214 17.5 15.8333C17.5 14.4526 16.3807 13.3333 15 13.3333C13.6193 13.3333 12.5 14.4526 12.5 15.8333C12.5 17.214 13.6193 18.3333 15 18.3333Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M7.15833 11.175L12.85 14.6583" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12.8417 5.34167L7.15833 8.825" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button className="btn-icon" aria-label="Bookmark">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M15.8333 17.5L10 13.3333L4.16667 17.5V4.16667C4.16667 3.72464 4.34226 3.30072 4.65482 2.98816C4.96738 2.67559 5.39131 2.5 5.83333 2.5H14.1667C14.6087 2.5 15.0326 2.67559 15.3452 2.98816C15.6577 3.30072 15.8333 3.72464 15.8333 4.16667V17.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Search using Autocomplete */}
      <div className="destination-browser-search">
        <Autocomplete
          placeholder="Search your destinations..."
          entityType="destination"
          items={destinations}
          onSelect={handleDestinationSelect}
          showMeta={true}
          size="lg"
        />
      </div>

      <div className="destination-browser-filters">
        <button className="filter-chip filter-chip-active">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 14C11.3137 14 14 11.3137 14 8C14 4.68629 11.3137 2 8 2C4.68629 2 2 4.68629 2 8C2 11.3137 4.68629 14 8 14Z" fill="currentColor"/>
          </svg>
          Osaka, Japan
        </button>
        <button className="filter-chip">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M14 2H2V10H6L8 12L10 10H14V2Z" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
          May 23 - Jun 10
        </button>
        <button className="filter-chip">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 6H13M6 9H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          $1,500+
        </button>
        <button className="filter-chip">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 3H14V11L8 14L2 11V3Z" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
          Filter
        </button>
        <button className="btn-clear">Clear</button>
      </div>

      {/* View Toggle */}
      <div className="destination-browser-view-toggle">
        <div className="view-toggle-tabs">
          <button className="view-toggle-tab view-toggle-tab-active">
            Highest Price
          </button>
          <button className="view-toggle-tab">
            Lowest Price
          </button>
        </div>
        <div className="view-toggle-buttons">
          <button className="btn-icon btn-icon-active" aria-label="List view">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M3.33333 5H16.6667M3.33333 10H16.6667M3.33333 15H16.6667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
          <button className="btn-icon" aria-label="Grid view">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="3" y="3" width="6" height="6" stroke="currentColor" strokeWidth="1.5"/>
              <rect x="11" y="3" width="6" height="6" stroke="currentColor" strokeWidth="1.5"/>
              <rect x="3" y="11" width="6" height="6" stroke="currentColor" strokeWidth="1.5"/>
              <rect x="11" y="11" width="6" height="6" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Destination Cards */}
      <div className="destination-browser-content">
        <div className="destination-cards">
          {destinations.map((destination, index) => (
            <DestinationCard 
              key={index}
              destination={destination}
              onClick={() => onDestinationClick?.(destination)}
            />
          ))}
        </div>
        <button className="btn-load-more">
          Load More
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M12 6L8 10L4 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

function DestinationCard({ destination, onClick }) {
  const { 
    image, 
    badge, 
    name, 
    description, 
    rating, 
    reviews, 
    amenities = [],
    price,
    currency = 'USD'
  } = destination;

  const [imageError, setImageError] = useState(false);

  const handleImageError = () => {
    setImageError(true);
  };

  return (
    <article className="destination-card" onClick={onClick}>
      <div className="destination-card-image">
        {imageError ? (
          <div className="destination-image-placeholder">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeWidth="2" />
              <circle cx="8.5" cy="8.5" r="1.5" strokeWidth="2" />
              <polyline points="21 15 16 10 5 21" strokeWidth="2" />
            </svg>
            <span>Image unavailable</span>
          </div>
        ) : (
          <img 
            src={image} 
            alt={name} 
            loading="lazy"
            onError={handleImageError}
          />
        )}
        {badge && <span className="destination-badge">{badge}</span>}
        <button className="destination-favorite" aria-label="Add to favorites">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M17.3667 3.84172C16.9412 3.41589 16.4369 3.07778 15.8818 2.84663C15.3267 2.61547 14.7316 2.49609 14.1308 2.49609C13.5301 2.49609 12.935 2.61547 12.3799 2.84663C11.8247 3.07778 11.3205 3.41589 10.895 3.84172L10 4.73672L9.10502 3.84172C8.24581 2.98251 7.08896 2.49655 5.88252 2.49655C4.67609 2.49655 3.51924 2.98251 2.66002 3.84172C1.80081 4.70094 1.31486 5.85779 1.31486 7.06422C1.31486 8.27066 1.80081 9.42751 2.66002 10.2867L3.55502 11.1817L10 17.6267L16.445 11.1817L17.34 10.2867C17.7658 9.86121 18.104 9.35697 18.3351 8.80186C18.5663 8.24674 18.6856 7.65168 18.6856 7.05089C18.6856 6.45009 18.5663 5.85503 18.3351 5.29992C18.104 4.74481 17.7658 4.24057 17.34 3.81505L17.3667 3.84172Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      <div className="destination-card-content">
        <div className="destination-card-header">
          <span className="destination-category">{badge}</span>
          <h3 className="destination-name">{name}</h3>
        </div>

        <p className="destination-description">{description}</p>

        <div className="destination-rating">
          <div className="rating-stars">
            {[...Array(5)].map((_, i) => (
              <svg 
                key={i} 
                width="16" 
                height="16" 
                viewBox="0 0 16 16" 
                fill={i < Math.floor(rating) ? "currentColor" : "none"}
                className="star-icon"
              >
                <path d="M8 1L10.163 5.38197L15 6.12541L11.5 9.52786L12.326 14.3746L8 12.0919L3.674 14.3746L4.5 9.52786L1 6.12541L5.837 5.38197L8 1Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              </svg>
            ))}
          </div>
          <span className="rating-text">{rating}</span>
          <span className="rating-reviews">{reviews} reviews</span>
        </div>

        <div className="destination-amenities">
          {amenities.map((amenity, idx) => (
            <span key={idx} className="amenity-tag">
              {amenity.icon && <span>{amenity.icon}</span>}
              {amenity.label}
            </span>
          ))}
        </div>

        <div className="destination-card-footer">
          <div className="destination-price">
            <span className="price-amount">${price}</span>
            <span className="price-currency">{currency}</span>
          </div>
        </div>
      </div>
    </article>
  );
}

import { useState } from 'react';
import DestinationBrowser from '../components/DestinationBrowser/DestinationBrowser';
import MapView from '../components/MapView/MapView';
import BiensperienceLogo from '../components/BiensperienceLogo/BiensperienceLogo';

export default {
  title: 'Components/Navigation/Destination Browser',
  component: DestinationBrowser,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Complete destination browsing interface with map integration, search, filters, and destination cards. Designed for travel planning with Google Maps integration, responsive layouts, and full mobile support. Includes desktop, mobile, and map-focused views.',
      },
    },
  },
  tags: [],
};

// Sample destination data with travel theme - now compatible with Autocomplete
const sampleDestinations = [
  {
    id: 1,
    name: 'Osaka Luxury Suites',
    country: 'Japan',
    flag: '🇯🇵',
    experienceCount: 234,
    image: 'https://images.unsplash.com/photo-1542931287-023b922fa89b?w=400&h=300&fit=crop&auto=format',
    badge: 'Popular',
    description: 'Enjoy stunning views of Osaka Bay from this gorgeous hotel. Located in the heart of Osaka Bay, directly across from Osaka Castle.',
    rating: 4.8,
    reviews: 167,
    amenities: [
      { icon: '🏨', label: 'Chuo-ku' },
      { icon: '🍽️', label: 'Restaurant' },
      { icon: '📶', label: 'Free WiFi' }
    ],
    price: 870,
    currency: 'USD'
  },
  {
    id: 2,
    name: 'Osaka Bayview Hotel',
    country: 'Japan',
    flag: '🇯🇵',
    experienceCount: 156,
    image: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=400&h=300&fit=crop&auto=format',
    badge: 'Featured',
    description: 'Enjoy stunning views of Osaka Bay from this modern hotel. Located in the heart of Osaka Bay, close to shopping and entertainment districts.',
    rating: 3.2,
    reviews: 93,
    amenities: [
      { icon: '🏖️', label: 'Minato-ku' },
      { icon: '🏊', label: 'Pool' },
      { icon: '📶', label: 'Free WiFi' }
    ],
    price: 285,
    currency: 'USD'
  },
  {
    id: 3,
    name: 'Cozy Neo Tokyo Inn',
    country: 'Japan',
    flag: '🇯🇵',
    experienceCount: 189,
    image: 'https://images.unsplash.com/photo-1528127269322-539801943592?w=400&h=300&fit=crop&auto=format',
    badge: 'Exclusive Deals',
    description: 'Experience traditional Japanese hospitality with modern comforts. Located near the beautiful Sumida River.',
    rating: 4.8,
    reviews: 162,
    amenities: [
      { icon: '🏯', label: 'Matano-ku' },
      { icon: '🚇', label: 'Transport' },
      { icon: '🧘', label: 'Spa/Wellness' }
    ],
    price: 480,
    currency: 'USD'
  },
  {
    id: 4,
    name: 'Tokyo Tower Plaza',
    country: 'Japan',
    flag: '🇯🇵',
    experienceCount: 312,
    image: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=400&h=300&fit=crop&auto=format',
    badge: 'New',
    description: 'Modern hotel with direct views of Tokyo Tower. Perfect location in Minato ward.',
    rating: 4.6,
    reviews: 245,
    amenities: [
      { icon: '🗼', label: 'Minato-ku' },
      { icon: '🍣', label: 'Restaurant' },
      { icon: '📶', label: 'Free WiFi' }
    ],
    price: 650,
    currency: 'USD'
  },
  {
    id: 5,
    name: 'Kyoto Traditional Ryokan',
    country: 'Japan',
    flag: '🇯🇵',
    experienceCount: 178,
    image: 'https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=400&h=300&fit=crop&auto=format',
    badge: 'Heritage',
    description: 'Authentic ryokan experience with tatami rooms and kaiseki dining.',
    rating: 4.9,
    reviews: 198,
    amenities: [
      { icon: '⛩️', label: 'Gion' },
      { icon: '♨️', label: 'Onsen' },
      { icon: '🍵', label: 'Tea Ceremony' }
    ],
    price: 520,
    currency: 'USD'
  },
];

export const Default = {
  render: () => {
    const handleDestinationClick = (destination) => {
      console.log('Destination clicked:', destination);
    };

    const handleFilterChange = (filters) => {
      console.log('Filters changed:', filters);
    };

    const handleDestinationSelect = (destination) => {
      console.log('Destination selected from autocomplete:', destination);
    };

    return (
      <DestinationBrowser
        destinations={sampleDestinations}
        title="287 Places in Osaka, Japan"
        subtitle="Easily book hotels and search places quickly"
        showMap={true}
        onDestinationClick={handleDestinationClick}
        onFilterChange={handleFilterChange}
        onDestinationSelect={handleDestinationSelect}
      />
    );
  },
};

export const TokyoDestinations = {
  name: 'Tokyo Destinations',
  render: () => {
    const tokyoDestinations = [
      {
        image: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=400&h=300&fit=crop&auto=format',
        badge: 'Top Rated',
        name: 'Tokyo Imperial Palace View Hotel',
        description: 'Gabriel Planner recommends: Stunning views of the Imperial Palace Gardens with traditional Japanese architecture and modern amenities.',
        rating: 4.9,
        reviews: 342,
        amenities: [
          { icon: '🏯', label: 'Chiyoda' },
          { icon: '🍱', label: 'Japanese Cuisine' },
          { icon: '🌸', label: 'Garden View' }
        ],
        price: 1250,
        currency: 'USD'
      },
      {
        image: 'https://images.unsplash.com/photo-1536098561742-ca998e48cbcc?w=400&h=300&fit=crop&auto=format',
        badge: 'New',
        name: 'Shibuya Crossing Boutique Hotel',
        description: 'Kelly Traveler\'s pick: Located right at Shibuya Crossing, the busiest intersection in the world. Perfect for nightlife enthusiasts.',
        rating: 4.7,
        reviews: 218,
        amenities: [
          { icon: '🌃', label: 'Shibuya' },
          { icon: '🍸', label: 'Rooftop Bar' },
          { icon: '🚇', label: 'Metro Access' }
        ],
        price: 890,
        currency: 'USD'
      },
      {
        image: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=400&h=300&fit=crop&auto=format',
        badge: 'Luxury',
        name: 'Ginza Premium Suites',
        description: 'Jane Organizer suggests: Luxury accommodations in Tokyo\'s upscale shopping district. Walking distance to high-end boutiques and restaurants.',
        rating: 5.0,
        reviews: 156,
        amenities: [
          { icon: '💎', label: 'Ginza' },
          { icon: '🛍️', label: 'Shopping' },
          { icon: '⭐', label: 'Concierge' }
        ],
        price: 1680,
        currency: 'USD'
      },
      {
        image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&h=300&fit=crop&auto=format',
        badge: 'Budget Friendly',
        name: 'Asakusa Traditional Ryokan',
        description: 'Rachel Pleasure-Seeker\'s favorite: Authentic Japanese inn near Senso-ji Temple. Experience traditional tatami rooms and onsen baths.',
        rating: 4.6,
        reviews: 289,
        amenities: [
          { icon: '⛩️', label: 'Asakusa' },
          { icon: '♨️', label: 'Hot Spring' },
          { icon: '🍵', label: 'Tea Ceremony' }
        ],
        price: 420,
        currency: 'USD'
      },
      {
        image: 'https://images.unsplash.com/photo-1570797197190-8e003a00c846?w=400&h=300&fit=crop&auto=format',
        badge: 'Adventure',
        name: 'Mount Fuji Base Camp Lodge',
        description: 'Flora Adrenaline-Junkie recommends: Perfect starting point for climbing Mount Fuji. Adventure tours and hiking gear rental available.',
        rating: 4.5,
        reviews: 178,
        amenities: [
          { icon: '⛰️', label: 'Yamanashi' },
          { icon: '🥾', label: 'Hiking Tours' },
          { icon: '📸', label: 'Photo Spots' }
        ],
        price: 320,
        currency: 'USD'
      },
    ];

    return (
      <DestinationBrowser
        destinations={tokyoDestinations}
        title="156 Places in Tokyo, Japan"
        subtitle="From traditional ryokans to modern luxury hotels"
      />
    );
  },
};

export const ParisDestinations = {
  name: 'Paris Destinations',
  render: () => {
    const parisDestinations = [
      {
        image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=400&h=300&fit=crop&auto=format',
        badge: 'Romantic',
        name: 'Eiffel Tower View Suite',
        description: 'Marcus Explorer\'s choice: Wake up to breathtaking views of the Eiffel Tower. Perfect for romantic getaways and honeymoons.',
        rating: 4.9,
        reviews: 412,
        amenities: [
          { icon: '🗼', label: '7th Arrondissement' },
          { icon: '🥐', label: 'French Breakfast' },
          { icon: '🍷', label: 'Wine Cellar' }
        ],
        price: 1450,
        currency: 'EUR'
      },
      {
        image: 'https://images.unsplash.com/photo-1549144511-f099e773c147?w=400&h=300&fit=crop&auto=format',
        badge: 'Historic',
        name: 'Montmartre Artist\'s Loft',
        description: 'Gabriel Planner recommends: Stay in the artistic heart of Paris. Walking distance to Sacré-Cœur and charming cafés.',
        rating: 4.7,
        reviews: 234,
        amenities: [
          { icon: '🎨', label: 'Montmartre' },
          { icon: '☕', label: 'Café District' },
          { icon: '🚶', label: 'Walkable' }
        ],
        price: 780,
        currency: 'EUR'
      },
      {
        image: 'https://images.unsplash.com/photo-1565402170291-8491f14678db?w=400&h=300&fit=crop&auto=format',
        badge: 'Luxury',
        name: 'Champs-Élysées Grand Hotel',
        description: 'Kelly Traveler\'s pick: 5-star luxury on the world\'s most famous avenue. Premium shopping and dining at your doorstep.',
        rating: 5.0,
        reviews: 567,
        amenities: [
          { icon: '⭐', label: 'Champs-Élysées' },
          { icon: '🏪', label: 'Luxury Shopping' },
          { icon: '🍽️', label: 'Michelin Star' }
        ],
        price: 2100,
        currency: 'EUR'
      },
    ];

    return (
      <DestinationBrowser
        destinations={parisDestinations}
        title="89 Places in Paris, France"
        subtitle="Experience the City of Light in style"
      />
    );
  },
};

export const InteractiveDemo = {
  name: 'Interactive Demo',
  render: () => {
    const [destinations, setDestinations] = useState(sampleDestinations);
    const [sortOrder, setSortOrder] = useState('highest');

    const handleSort = (order) => {
      setSortOrder(order);
      const sorted = [...destinations].sort((a, b) => {
        return order === 'highest' ? b.price - a.price : a.price - b.price;
      });
      setDestinations(sorted);
    };

    return (
      <div>
        <div style={{ 
          padding: 'var(--space-4)', 
          background: 'var(--color-bg-secondary)',
          marginBottom: 'var(--space-4)',
          borderRadius: 'var(--border-radius-lg)'
        }}>
          <h4 style={{ 
            margin: '0 0 var(--space-2) 0',
            fontSize: 'var(--font-size-base)',
            fontWeight: 'var(--font-weight-semibold)'
          }}>
            Sort by price:
          </h4>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button
              onClick={() => handleSort('highest')}
              style={{
                padding: 'var(--space-2) var(--space-4)',
                background: sortOrder === 'highest' ? 'var(--color-primary)' : 'var(--color-bg-primary)',
                color: sortOrder === 'highest' ? 'var(--btn-gradient-color)' : 'var(--color-text-primary)',
                border: '1px solid var(--color-border-medium)',
                borderRadius: 'var(--border-radius-md)',
                cursor: 'pointer',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-medium)'
              }}
            >
              Highest First
            </button>
            <button
              onClick={() => handleSort('lowest')}
              style={{
                padding: 'var(--space-2) var(--space-4)',
                background: sortOrder === 'lowest' ? 'var(--color-primary)' : 'var(--color-bg-primary)',
                color: sortOrder === 'lowest' ? 'var(--btn-gradient-color)' : 'var(--color-text-primary)',
                border: '1px solid var(--color-border-medium)',
                borderRadius: 'var(--border-radius-md)',
                cursor: 'pointer',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-medium)'
              }}
            >
              Lowest First
            </button>
          </div>
        </div>

        <DestinationBrowser
          destinations={destinations}
          title="Osaka Travel Destinations"
          subtitle="Sorted by your preference"
        />
      </div>
    );
  },
};

export const EmptyState = {
  name: 'Empty State',
  render: () => {
    return (
      <DestinationBrowser
        destinations={[]}
        title="No Results Found"
        subtitle="Try adjusting your search filters"
      />
    );
  },
};

export const MapViewComponent = {
  name: 'Map View Component',
  render: () => {
    const markers = [
      { name: 'Osaka Luxury Suites', price: 870, type: 'hotel' },
      { name: 'Osaka Bayview Hotel', price: 285, type: 'hotel' },
      { name: 'Cozy Neo Tokyo Inn', price: 480, type: 'hotel' },
      { name: 'Dotonbori Restaurant', type: 'restaurant' },
      { name: 'Osaka Castle', type: 'attraction' },
      { name: 'Umeda Sky Building', type: 'attraction' },
    ];

    return (
      <div style={{ padding: 'var(--space-6)' }}>
        <h2 style={{ 
          marginBottom: 'var(--space-2)',
          fontSize: 'var(--font-size-2xl)',
          fontWeight: 'var(--font-weight-bold)',
          color: 'var(--color-text-primary)'
        }}>
          Osaka Destination Map
        </h2>
        <p style={{
          marginBottom: 'var(--space-6)',
          fontSize: 'var(--font-size-base)',
          color: 'var(--color-text-muted)'
        }}>
          Interactive Google Maps showing hotels, restaurants, and attractions
        </p>
        
        <MapView
          location="Osaka, Japan"
          height={500}
          showControls={true}
          markers={markers}
        />
      </div>
    );
  },
};

export const TokyoMapView = {
  name: 'Tokyo Map View',
  render: () => {
    const tokyoMarkers = [
      { name: 'Tokyo Imperial Palace View Hotel', type: 'hotel' },
      { name: 'Shibuya Crossing Boutique Hotel', type: 'hotel' },
      { name: 'Ginza Premium Suites', type: 'hotel' },
      { name: 'Senso-ji Temple', type: 'attraction' },
      { name: 'Tokyo Tower', type: 'attraction' },
      { name: 'Tsukiji Market', type: 'restaurant' },
    ];

    return (
      <div style={{ padding: 'var(--space-6)' }}>
        <h2 style={{ 
          marginBottom: 'var(--space-6)',
          fontSize: 'var(--font-size-2xl)',
          fontWeight: 'var(--font-weight-bold)',
          color: 'var(--color-text-primary)'
        }}>
          Tokyo Points of Interest
        </h2>
        
        <MapView
          location="Tokyo, Japan"
          height={600}
          showControls={true}
          markers={tokyoMarkers}
        />
      </div>
    );
  },
};

export const ParisMapView = {
  name: 'Paris Map View',
  render: () => {
    const parisMarkers = [
      { name: 'Eiffel Tower View Suite', type: 'hotel' },
      { name: 'Montmartre Artist\'s Loft', type: 'hotel' },
      { name: 'Eiffel Tower', type: 'attraction' },
      { name: 'Louvre Museum', type: 'attraction' },
      { name: 'Le Jules Verne', type: 'restaurant' },
    ];

    return (
      <div style={{ padding: 'var(--space-6)', background: 'var(--color-bg-secondary)' }}>
        <h2 style={{ 
          marginBottom: 'var(--space-6)',
          fontSize: 'var(--font-size-2xl)',
          fontWeight: 'var(--font-weight-bold)',
          color: 'var(--color-text-primary)'
        }}>
          Paris City Guide
        </h2>
        
        <MapView
          location="Paris, France"
          height={500}
          showControls={true}
          markers={parisMarkers}
        />
      </div>
    );
  },
};

export const DesktopAndMobileLayout = {
  name: 'Desktop and Mobile Layout',
  render: () => {
    return (
      <div style={{ 
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: 'var(--space-6)',
        padding: 'var(--space-6)',
        background: 'var(--color-bg-secondary)'
      }}>
        {/* Desktop View */}
        <div style={{
          background: 'var(--color-bg-primary)',
          borderRadius: 'var(--border-radius-xl)',
          padding: 'var(--space-4)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
        }}>
          <h3 style={{ 
            marginBottom: 'var(--space-4)',
            fontSize: 'var(--font-size-lg)',
            fontWeight: 'var(--font-weight-semibold)'
          }}>
            Desktop Layout
          </h3>
          <DestinationBrowser
            destinations={sampleDestinations.slice(0, 2)}
            title="287 Places in Osaka"
            subtitle="Desktop view with full features"
          />
        </div>

        {/* Mobile View */}
        <div style={{
          background: 'var(--color-bg-primary)',
          borderRadius: 'var(--border-radius-xl)',
          padding: 'var(--space-4)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          maxWidth: '375px'
        }}>
          <h3 style={{ 
            marginBottom: 'var(--space-4)',
            fontSize: 'var(--font-size-lg)',
            fontWeight: 'var(--font-weight-semibold)'
          }}>
            Mobile Layout
          </h3>
          <div style={{ 
            border: '2px solid var(--color-border-medium)',
            borderRadius: 'var(--border-radius-lg)',
            overflow: 'hidden'
          }}>
            <DestinationBrowser
              destinations={sampleDestinations.slice(0, 2)}
              title="287 Places"
              subtitle="Compact mobile view"
            />
          </div>
        </div>
      </div>
    );
  },
};

export const FullLayoutWithMap = {
  name: 'Full Layout with Map',
  render: () => {
    const markers = [
      { name: 'Osaka Luxury Suites', type: 'hotel' },
      { name: 'Osaka Bayview Hotel', type: 'hotel' },
      { name: 'Cozy Neo Tokyo Inn', type: 'hotel' },
      { name: 'Dotonbori', type: 'restaurant' },
      { name: 'Osaka Castle', type: 'attraction' },
    ];

    return (
      <div style={{ 
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 'var(--space-6)',
        padding: 'var(--space-6)',
        background: 'var(--color-bg-secondary)',
        minHeight: '100vh'
      }}>
        {/* Destination List */}
        <div style={{
          background: 'var(--color-bg-primary)',
          borderRadius: 'var(--border-radius-xl)',
          padding: 'var(--space-6)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          overflowY: 'auto',
          maxHeight: 'calc(100vh - 3rem)'
        }}>
          <DestinationBrowser
            destinations={sampleDestinations}
            title="287 Places in Osaka, Japan"
            subtitle="Browse hotels, restaurants, and attractions"
          />
        </div>

        {/* Map View */}
        <div style={{
          position: 'sticky',
          top: 'var(--space-6)',
          height: 'calc(100vh - 3rem)'
        }}>
          <div style={{
            background: 'var(--color-bg-primary)',
            borderRadius: 'var(--border-radius-xl)',
            padding: 'var(--space-6)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
            height: '100%'
          }}>
            <h3 style={{ 
              marginBottom: 'var(--space-4)',
              fontSize: 'var(--font-size-xl)',
              fontWeight: 'var(--font-weight-bold)',
              color: 'var(--color-text-primary)'
            }}>
              Map View
            </h3>
            <MapView
              location="Osaka, Japan"
              height={600}
              showControls={true}
              markers={markers}
            />
          </div>
        </div>
      </div>
    );
  },
};

// Mobile-First Story matching the screenshot
export const MobileView = {
  name: 'Mobile View',
  render: () => {
    return (
      <div style={{
        maxWidth: '428px', // iPhone 14 Pro Max width
        margin: '0 auto',
        background: 'var(--color-bg-primary)',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Mobile Header with Biensperience logo */}
        <div style={{
          background: 'var(--color-primary)',
          color: 'var(--btn-gradient-color)',
          padding: 'var(--space-4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)'
          }}>
            <BiensperienceLogo width={32} height={32} />
            <span style={{ 
              fontWeight: 'var(--font-weight-semibold)',
              fontSize: 'var(--font-size-lg)'
            }}>
              Biensperience
            </span>
          </div>
          <button style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--btn-gradient-color)',
            padding: 'var(--space-2)',
            cursor: 'pointer'
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <line x1="3" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="2"/>
              <line x1="3" y1="6" x2="21" y2="6" stroke="currentColor" strokeWidth="2"/>
              <line x1="3" y1="18" x2="21" y2="18" stroke="currentColor" strokeWidth="2"/>
            </svg>
          </button>
        </div>

        {/* Title Section */}
        <div style={{
          padding: 'var(--space-4)',
          borderBottom: '1px solid var(--color-border-light)'
        }}>
          <h1 style={{
            fontSize: 'var(--font-size-xl)',
            fontWeight: 'var(--font-weight-bold)',
            marginBottom: 'var(--space-2)',
            color: 'var(--color-text-primary)'
          }}>
            287 Places in Osaka, Japan
          </h1>
          <p style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-muted)',
            margin: 0
          }}>
            Easily book hotels and search places quickly
          </p>
          <div style={{
            display: 'flex',
            gap: 'var(--space-2)',
            marginTop: 'var(--space-3)'
          }}>
            <button style={{
              background: 'transparent',
              border: 'none',
              padding: 'var(--space-2)',
              cursor: 'pointer',
              color: 'var(--color-text-secondary)'
            }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M15 6.66667C16.3807 6.66667 17.5 5.54738 17.5 4.16667C17.5 2.78595 16.3807 1.66667 15 1.66667C13.6193 1.66667 12.5 2.78595 12.5 4.16667C12.5 5.54738 13.6193 6.66667 15 6.66667Z" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M5 12.5C6.38071 12.5 7.5 11.3807 7.5 10C7.5 8.61929 6.38071 7.5 5 7.5C3.61929 7.5 2.5 8.61929 2.5 10C2.5 11.3807 3.61929 12.5 5 12.5Z" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M15 18.3333C16.3807 18.3333 17.5 17.214 17.5 15.8333C17.5 14.4526 16.3807 13.3333 15 13.3333C13.6193 13.3333 12.5 14.4526 12.5 15.8333C12.5 17.214 13.6193 18.3333 15 18.3333Z" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M7.15833 11.175L12.85 14.6583" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M12.8417 5.34167L7.15833 8.825" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
            </button>
            <button style={{
              background: 'transparent',
              border: 'none',
              padding: 'var(--space-2)',
              cursor: 'pointer',
              color: 'var(--color-text-secondary)'
            }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M15.8333 17.5L10 13.3333L4.16667 17.5V4.16667C4.16667 3.72464 4.34226 3.30072 4.65482 2.98816C4.96738 2.67559 5.39131 2.5 5.83333 2.5H14.1667C14.6087 2.5 15.0326 2.67559 15.3452 2.98816C15.6577 3.30072 15.8333 3.72464 15.8333 4.16667V17.5Z" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Map Preview */}
        <div style={{
          width: '100%',
          height: '250px',
          position: 'relative',
          background: 'var(--color-bg-secondary)'
        }}>
          <MapView
            location="Osaka, Japan"
            height={250}
            showControls={false}
          />
        </div>

        {/* Search Bar */}
        <div style={{
          padding: 'var(--space-4)',
          background: 'var(--color-bg-primary)',
          borderBottom: '1px solid var(--color-border-light)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            background: 'var(--color-bg-secondary)',
            padding: 'var(--space-3)',
            borderRadius: 'var(--border-radius-lg)',
            border: '1px solid var(--color-border-light)'
          }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M9 17C13.4183 17 17 13.4183 17 9C17 4.58172 13.4183 1 9 1C4.58172 1 1 4.58172 1 9C1 13.4183 4.58172 17 9 17Z" stroke="var(--color-text-muted)" strokeWidth="2"/>
              <path d="M19 19L14.65 14.65" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <input
              type="text"
              placeholder="Search your destinations..."
              style={{
                flex: 1,
                border: 'none',
                background: 'transparent',
                fontSize: 'var(--font-size-base)',
                outline: 'none',
                color: 'var(--color-text-primary)'
              }}
            />
          </div>
          <div style={{
            display: 'flex',
            gap: 'var(--space-2)',
            marginTop: 'var(--space-3)',
            alignItems: 'center',
            fontSize: 'var(--font-size-sm)'
          }}>
            <span style={{
              background: 'var(--color-primary)',
              color: 'var(--btn-gradient-color)',
              padding: 'var(--space-1) var(--space-3)',
              borderRadius: 'var(--border-radius-full)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
              fontWeight: 'var(--font-weight-medium)'
            }}>
              2 Filters Applied
            </span>
            <button style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
              cursor: 'pointer',
              padding: 'var(--space-2)'
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect width="16" height="16" rx="2" fill="transparent"/>
                <line x1="4" y1="8" x2="12" y2="8" stroke="currentColor" strokeWidth="1.5"/>
                <line x1="8" y1="4" x2="8" y2="12" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
            </button>
            <button style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              padding: 'var(--space-2)',
              marginLeft: 'auto'
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Destination Cards - Vertical Stack */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--space-4)',
          background: 'var(--color-bg-secondary)'
        }}>
          {sampleDestinations.map((dest, index) => (
            <div
              key={index}
              style={{
                background: 'var(--color-bg-primary)',
                borderRadius: 'var(--border-radius-xl)',
                overflow: 'hidden',
                marginBottom: 'var(--space-4)',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                cursor: 'pointer',
                transition: 'transform var(--transition-standard), box-shadow var(--transition-standard)'
              }}
            >
              {/* Image */}
              <div style={{
                position: 'relative',
                width: '100%',
                height: '200px',
                overflow: 'hidden'
              }}>
                <img
                  src={dest.image}
                  alt={dest.name}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                />
                {dest.badge && (
                  <span style={{
                    position: 'absolute',
                    top: 'var(--space-3)',
                    left: 'var(--space-3)',
                    background: 'var(--color-success)',
                    color: 'var(--btn-gradient-color)',
                    padding: 'var(--space-1) var(--space-3)',
                    borderRadius: 'var(--border-radius-full)',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 'var(--font-weight-semibold)',
                    textTransform: 'uppercase',
                    letterSpacing: 'var(--letter-spacing-wide)'
                  }}>
                    {dest.badge}
                  </span>
                )}
              </div>

              {/* Content */}
              <div style={{ padding: 'var(--space-4)' }}>
                <div style={{
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-primary)',
                  fontWeight: 'var(--font-weight-semibold)',
                  marginBottom: 'var(--space-2)',
                  textTransform: 'uppercase',
                  letterSpacing: 'var(--letter-spacing-wide)'
                }}>
                  {dest.badge}
                </div>
                
                <h3 style={{
                  fontSize: 'var(--font-size-lg)',
                  fontWeight: 'var(--font-weight-bold)',
                  marginBottom: 'var(--space-2)',
                  color: 'var(--color-text-primary)'
                }}>
                  {dest.name}
                </h3>

                <p style={{
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--color-text-secondary)',
                  marginBottom: 'var(--space-3)',
                  lineHeight: 'var(--line-height-relaxed)'
                }}>
                  {dest.description}
                </p>

                {/* Rating */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  marginBottom: 'var(--space-3)'
                }}>
                  <div style={{ display: 'flex', gap: '2px' }}>
                    {[...Array(5)].map((_, i) => (
                      <svg key={i} width="16" height="16" viewBox="0 0 16 16" fill={i < Math.floor(dest.rating) ? 'var(--color-warning)' : 'var(--color-border-medium)'}>
                        <path d="M8 1.5L9.5 6.5H14.5L10.5 9.5L12 14.5L8 11.5L4 14.5L5.5 9.5L1.5 6.5H6.5L8 1.5Z"/>
                      </svg>
                    ))}
                  </div>
                  <span style={{
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 'var(--font-weight-semibold)',
                    color: 'var(--color-text-primary)'
                  }}>
                    {dest.rating}
                  </span>
                  <span style={{
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-text-muted)'
                  }}>
                    {dest.reviews} reviews
                  </span>
                </div>

                {/* Amenities */}
                <div style={{
                  display: 'flex',
                  gap: 'var(--space-3)',
                  marginBottom: 'var(--space-4)',
                  flexWrap: 'wrap'
                }}>
                  {dest.amenities.map((amenity, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-1)',
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--color-text-secondary)'
                      }}
                    >
                      <span>{amenity.icon}</span>
                      <span>{amenity.label}</span>
                    </div>
                  ))}
                </div>

                {/* Price */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <span style={{
                      fontSize: 'var(--font-size-2xl)',
                      fontWeight: 'var(--font-weight-bold)',
                      color: 'var(--color-text-primary)'
                    }}>
                      ${dest.price}
                    </span>
                    <span style={{
                      fontSize: 'var(--font-size-sm)',
                      color: 'var(--color-text-muted)',
                      marginLeft: 'var(--space-1)'
                    }}>
                      {dest.currency}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Load More Button */}
          <button style={{
            width: '100%',
            padding: 'var(--space-4)',
            background: 'var(--color-primary)',
            color: 'var(--btn-gradient-color)',
            border: 'none',
            borderRadius: 'var(--border-radius-lg)',
            fontSize: 'var(--font-size-base)',
            fontWeight: 'var(--font-weight-semibold)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-2)',
            transition: 'background var(--transition-standard)'
          }}>
            Load More
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 6L8 10L4 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    );
  },
  parameters: {
    layout: 'fullscreen',
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};

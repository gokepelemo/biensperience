/**
 * Discovery Layouts Stories
 * Storybook stories for content discovery layout components.
 */

import React from 'react';
import { FaMapMarkerAlt, FaClock, FaDollarSign } from 'react-icons/fa';
import CardGridLayout from '../../components/Layout/CardGridLayout';
import FeaturedHeroLayout from '../../components/Layout/FeaturedHeroLayout';
import MapListLayout from '../../components/Layout/MapListLayout';

export default {
  title: 'Layouts/Discovery Pages',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Layout components for browsing and discovering content.',
      },
    },
  },
};

// Sample card component for grid demos
const SampleCard = ({ title, location, image, price }) => (
  <div
    style={{
      background: 'var(--color-bg-primary)',
      borderRadius: '12px',
      overflow: 'hidden',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      transition: 'transform 0.2s, box-shadow 0.2s',
    }}
  >
    <div
      style={{
        aspectRatio: '16/10',
        background: image || 'var(--btn-gradient-bg, linear-gradient(135deg, var(--color-primary), var(--color-secondary)))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: '2rem',
      }}
    >
      {!image && '🌏'}
    </div>
    <div style={{ padding: '16px' }}>
      <h3 style={{ margin: '0 0 8px', fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>{title}</h3>
      <p style={{ margin: '0 0 12px', fontSize: '0.875rem', color: 'var(--color-text-tertiary)', display: 'flex', alignItems: 'center' }}>
        <FaMapMarkerAlt style={{ marginRight: '4px' }} />
        {location}
      </p>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center' }}><FaClock style={{ marginRight: '4px' }} />3 days</span>
        <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>${price}</span>
      </div>
    </div>
  </div>
);

// Sample experiences data
const experiences = [
  { title: 'Tokyo Food Tour', location: 'Tokyo, Japan', price: 450 },
  { title: 'Kyoto Temple Walk', location: 'Kyoto, Japan', price: 320 },
  { title: 'Mount Fuji Hike', location: 'Yamanashi, Japan', price: 280 },
  { title: 'Osaka Street Food', location: 'Osaka, Japan', price: 180 },
  { title: 'Nara Deer Park', location: 'Nara, Japan', price: 120 },
  { title: 'Hiroshima History', location: 'Hiroshima, Japan', price: 250 },
  { title: 'Hakone Hot Springs', location: 'Hakone, Japan', price: 380 },
  { title: 'Nikko Shrine Tour', location: 'Nikko, Japan', price: 200 },
];

// Sample map placeholder
const SampleMap = () => (
  <div
    style={{
      width: '100%',
      height: '100%',
      minHeight: '400px',
      background: 'var(--color-bg-secondary)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '16px',
    }}
  >
    <div style={{ fontSize: '3rem' }}>🗺️</div>
    <div style={{ color: 'var(--color-text-tertiary)' }}>Interactive Map</div>
    <div
      style={{
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap',
        justifyContent: 'center',
        maxWidth: '200px',
      }}
    >
      {['📍', '📍', '📍', '📍'].map((pin, i) => (
        <span key={i} style={{ fontSize: '1.5rem' }}>{pin}</span>
      ))}
    </div>
  </div>
);

// Sample list for map-list layout
const SampleList = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
    {experiences.slice(0, 4).map((exp, i) => (
      <div
        key={i}
        style={{
          padding: '16px',
          background: 'var(--color-bg-secondary)',
          borderRadius: '8px',
          display: 'flex',
          gap: '16px',
          alignItems: 'center',
          cursor: 'pointer',
          transition: 'background 0.2s',
        }}
      >
        <div
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '8px',
            background: 'var(--btn-gradient-bg, linear-gradient(135deg, var(--color-primary), var(--color-secondary)))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '1.5rem',
          }}
        >
          🏯
        </div>
        <div style={{ flex: 1 }}>
          <h4 style={{ margin: '0 0 4px', fontSize: '1rem', color: 'var(--color-text-primary)' }}>{exp.title}</h4>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-tertiary)' }}>
            {exp.location}
          </p>
        </div>
        <div style={{ fontWeight: 600, color: 'var(--color-primary)' }}>${exp.price}</div>
      </div>
    ))}
  </div>
);

// ============================================================
// CardGridLayout Stories
// ============================================================

export const CardGridBasic = {
  name: 'Card Grid - 4 Columns',
  render: () => (
    <div style={{ padding: '24px' }}>
      <CardGridLayout columns={4} gap="md">
        {experiences.map((exp, i) => (
          <SampleCard key={i} {...exp} />
        ))}
      </CardGridLayout>
    </div>
  ),
};

export const CardGridThreeColumns = {
  name: 'Card Grid - 3 Columns',
  render: () => (
    <div style={{ padding: '24px' }}>
      <CardGridLayout columns={3} gap="lg">
        {experiences.slice(0, 6).map((exp, i) => (
          <SampleCard key={i} {...exp} />
        ))}
      </CardGridLayout>
    </div>
  ),
};

export const CardGridTwoColumns = {
  name: 'Card Grid - 2 Columns',
  render: () => (
    <div style={{ padding: '24px' }}>
      <CardGridLayout columns={2} gap="md">
        {experiences.slice(0, 4).map((exp, i) => (
          <SampleCard key={i} {...exp} />
        ))}
      </CardGridLayout>
    </div>
  ),
};

export const CardGridLoading = {
  name: 'Card Grid - Loading State',
  render: () => (
    <div style={{ padding: '24px' }}>
      <CardGridLayout loading skeletonCount={8} columns={4} />
    </div>
  ),
};

export const CardGridEmpty = {
  name: 'Card Grid - Empty State',
  render: () => (
    <div style={{ padding: '24px' }}>
      <CardGridLayout
        columns={4}
        emptyMessage="No experiences found"
        emptyAction={<button className="btn btn-primary">Create Experience</button>}
      >
        {/* Empty children */}
      </CardGridLayout>
    </div>
  ),
};

// ============================================================
// FeaturedHeroLayout Stories
// ============================================================

export const HeroCenter = {
  name: 'Hero - Centered',
  render: () => (
    <FeaturedHeroLayout
      backgroundImage="https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1920"
      title="Discover Tokyo"
      subtitle="Experience the perfect blend of tradition and modernity"
      meta="5 days · $1,200 estimated · 12 activities"
      contentPosition="center"
      height="lg"
      actions={
        <>
          <button className="btn btn-primary btn-lg">Plan It</button>
          <button className="btn btn-outline-light btn-lg">Learn More</button>
        </>
      }
      badge={<span className="badge bg-warning">Featured</span>}
    />
  ),
};

export const HeroLeft = {
  name: 'Hero - Left Aligned',
  render: () => (
    <FeaturedHeroLayout
      backgroundImage="https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1920"
      title="Kyoto's Ancient Temples"
      subtitle="Walk through centuries of Japanese history"
      meta="3 days · $800 estimated"
      contentPosition="left"
      height="md"
      actions={
        <button className="btn btn-primary">Start Planning</button>
      }
    />
  ),
};

export const HeroXL = {
  name: 'Hero - Extra Large',
  render: () => (
    <FeaturedHeroLayout
      backgroundImage="https://images.unsplash.com/photo-1490806843957-31f4c9a91c65?w=1920"
      title="Mount Fuji Adventure"
      subtitle="Conquer Japan's iconic peak"
      meta="2 days · $450 estimated · Challenging"
      contentPosition="center"
      height="xl"
      overlayOpacity={0.6}
      actions={
        <>
          <button className="btn btn-primary btn-lg">Book Now</button>
          <button className="btn btn-link text-white">Watch Video</button>
        </>
      }
    />
  ),
};

export const HeroNoImage = {
  name: 'Hero - Gradient Background',
  render: () => (
    <FeaturedHeroLayout
      title="Create Your Own Adventure"
      subtitle="Start planning your perfect trip today"
      contentPosition="center"
      height="md"
      overlay={false}
      actions={
        <button className="btn btn-light btn-lg">Get Started</button>
      }
    />
  ),
};

// ============================================================
// MapListLayout Stories
// ============================================================

export const MapListBasic = {
  name: 'Map List - Basic',
  render: () => (
    <div style={{ height: '600px' }}>
      <MapListLayout
        map={<SampleMap />}
        list={<SampleList />}
      />
    </div>
  ),
};

export const MapListRight = {
  name: 'Map List - Map on Right',
  render: () => (
    <div style={{ height: '600px' }}>
      <MapListLayout
        map={<SampleMap />}
        list={<SampleList />}
        mapPosition="right"
      />
    </div>
  ),
};

export const MapListWideMap = {
  name: 'Map List - 70/30 Split',
  render: () => (
    <div style={{ height: '600px' }}>
      <MapListLayout
        map={<SampleMap />}
        list={<SampleList />}
        splitRatio="70-30"
      />
    </div>
  ),
};

export const MapListWideList = {
  name: 'Map List - 30/70 Split',
  render: () => (
    <div style={{ height: '600px' }}>
      <MapListLayout
        map={<SampleMap />}
        list={<SampleList />}
        splitRatio="30-70"
      />
    </div>
  ),
};

export const MapListDefaultMap = {
  name: 'Map List - Default to Map (Mobile)',
  render: () => (
    <div style={{ height: '600px' }}>
      <MapListLayout
        map={<SampleMap />}
        list={<SampleList />}
        defaultView="map"
        listLabel="Results"
        mapLabel="View Map"
      />
    </div>
  ),
};

/**
 * Mobile Layouts Stories
 * Storybook stories for mobile-first layout components.
 */

import React, { useState } from 'react';
import { FaHome, FaSearch, FaPlus, FaHeart, FaUser, FaMapMarkerAlt, FaClock, FaDollarSign, FaUtensils, FaCamera, FaHiking, FaSpa, FaShoppingBag, FaMusic, FaTheaterMasks } from 'react-icons/fa';
import BottomNavLayout, { NavItem } from '../../components/Layout/BottomNavLayout';
import CollapsibleSectionLayout, { Section } from '../../components/Layout/CollapsibleSectionLayout';

export default {
  title: 'Layouts/Mobile Views',
  parameters: {
    layout: 'fullscreen',
    viewport: {
      defaultViewport: 'mobile1',
    },
    docs: {
      description: {
        component: 'Mobile-first layout components optimized for touch interactions.',
      },
    },
  },
};

// Sample content for layouts
const SampleContent = ({ title = 'Content Area' }) => (
  <div style={{ padding: '16px' }}>
    <h2 style={{ margin: '0 0 16px', fontSize: '1.25rem', color: 'var(--color-text-primary)' }}>{title}</h2>
    {Array.from({ length: 5 }).map((_, i) => (
      <div
        key={i}
        style={{
          padding: '16px',
          marginBottom: '12px',
          background: 'var(--color-bg-secondary)',
          borderRadius: '8px',
        }}
      >
        <h3 style={{ margin: '0 0 8px', fontSize: '1rem', color: 'var(--color-text-primary)' }}>Item {i + 1}</h3>
        <p style={{ margin: 0, color: 'var(--color-text-tertiary)', fontSize: '0.875rem' }}>
          Sample content for mobile layout demonstration.
        </p>
      </div>
    ))}
  </div>
);

// Sample header
const SampleHeader = () => (
  <div
    style={{
      padding: '16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}
  >
    <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>Biensperience</h1>
    <button
      style={{
        background: 'none',
        border: 'none',
        fontSize: '1.5rem',
        cursor: 'pointer',
        color: 'var(--color-text-primary)',
      }}
    >
      🔔
    </button>
  </div>
);

// ============================================================
// BottomNavLayout Stories
// ============================================================

export const BottomNavBasic = {
  name: 'Bottom Nav - Basic',
  render: () => {
    const [active, setActive] = useState('home');

    return (
      <div style={{ height: '100vh' }}>
        <BottomNavLayout
          header={<SampleHeader />}
          nav={
            <>
              <NavItem
                icon={<FaHome />}
                label="Home"
                active={active === 'home'}
                onClick={() => setActive('home')}
              />
              <NavItem
                icon={<FaSearch />}
                label="Explore"
                active={active === 'explore'}
                onClick={() => setActive('explore')}
              />
              <NavItem
                icon={<FaPlus />}
                label="Add"
                active={active === 'add'}
                onClick={() => setActive('add')}
              />
              <NavItem
                icon={<FaHeart />}
                label="Saved"
                active={active === 'saved'}
                onClick={() => setActive('saved')}
              />
              <NavItem
                icon={<FaUser />}
                label="Profile"
                active={active === 'profile'}
                onClick={() => setActive('profile')}
              />
            </>
          }
        >
          <SampleContent title={`${active.charAt(0).toUpperCase() + active.slice(1)} Content`} />
        </BottomNavLayout>
      </div>
    );
  },
};

export const BottomNavWithBadges = {
  name: 'Bottom Nav - With Badges',
  render: () => {
    const [active, setActive] = useState('home');

    return (
      <div style={{ height: '100vh' }}>
        <BottomNavLayout
          header={<SampleHeader />}
          nav={
            <>
              <NavItem
                icon={<FaHome />}
                label="Home"
                active={active === 'home'}
                onClick={() => setActive('home')}
              />
              <NavItem
                icon={<FaSearch />}
                label="Explore"
                active={active === 'explore'}
                onClick={() => setActive('explore')}
              />
              <NavItem
                icon={<FaPlus />}
                label="Add"
                active={active === 'add'}
                onClick={() => setActive('add')}
              />
              <NavItem
                icon={<FaHeart />}
                label="Saved"
                badge={3}
                active={active === 'saved'}
                onClick={() => setActive('saved')}
              />
              <NavItem
                icon={<FaUser />}
                label="Profile"
                badge={1}
                active={active === 'profile'}
                onClick={() => setActive('profile')}
              />
            </>
          }
        >
          <SampleContent title="Content with Badge Notifications" />
        </BottomNavLayout>
      </div>
    );
  },
};

export const BottomNavBlurBackground = {
  name: 'Bottom Nav - Blur Background',
  render: () => {
    const [active, setActive] = useState('home');

    return (
      <div style={{ height: '100vh' }}>
        <BottomNavLayout
          header={<SampleHeader />}
          blurBackground
          nav={
            <>
              <NavItem
                icon={<FaHome />}
                label="Home"
                active={active === 'home'}
                onClick={() => setActive('home')}
              />
              <NavItem
                icon={<FaSearch />}
                label="Explore"
                active={active === 'explore'}
                onClick={() => setActive('explore')}
              />
              <NavItem
                icon={<FaPlus />}
                label="Add"
                active={active === 'add'}
                onClick={() => setActive('add')}
              />
              <NavItem
                icon={<FaHeart />}
                label="Saved"
                active={active === 'saved'}
                onClick={() => setActive('saved')}
              />
              <NavItem
                icon={<FaUser />}
                label="Profile"
                active={active === 'profile'}
                onClick={() => setActive('profile')}
              />
            </>
          }
        >
          <div style={{ padding: '16px' }}>
            <h2 style={{ margin: '0 0 16px', color: 'var(--color-text-primary)' }}>Blur Effect Background</h2>
            <p style={{ color: 'var(--color-text-tertiary)' }}>
              The bottom navigation has a blur effect background for a modern look.
              Scroll down to see content behind the nav.
            </p>
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                style={{
                  padding: '16px',
                  marginBottom: '12px',
                  background: `linear-gradient(135deg, hsl(${i * 15}, 70%, 60%), hsl(${i * 15 + 30}, 70%, 50%))`,
                  borderRadius: '12px',
                  color: 'white',
                }}
              >
                <h3 style={{ margin: '0 0 4px', color: 'white' }}>Colorful Card {i + 1}</h3>
                <p style={{ margin: 0, opacity: 0.9, fontSize: '0.875rem', color: 'white' }}>
                  Scroll to see blur effect
                </p>
              </div>
            ))}
          </div>
        </BottomNavLayout>
      </div>
    );
  },
};

export const BottomNavHideOnScroll = {
  name: 'Bottom Nav - Hide on Scroll',
  render: () => {
    const [active, setActive] = useState('home');

    return (
      <div style={{ height: '100vh' }}>
        <BottomNavLayout
          header={<SampleHeader />}
          hideNavOnScroll
          nav={
            <>
              <NavItem
                icon={<FaHome />}
                label="Home"
                active={active === 'home'}
                onClick={() => setActive('home')}
              />
              <NavItem
                icon={<FaSearch />}
                label="Explore"
                active={active === 'explore'}
                onClick={() => setActive('explore')}
              />
              <NavItem
                icon={<FaPlus />}
                label="Add"
                active={active === 'add'}
                onClick={() => setActive('add')}
              />
              <NavItem
                icon={<FaHeart />}
                label="Saved"
                active={active === 'saved'}
                onClick={() => setActive('saved')}
              />
              <NavItem
                icon={<FaUser />}
                label="Profile"
                active={active === 'profile'}
                onClick={() => setActive('profile')}
              />
            </>
          }
        >
          <div style={{ padding: '16px' }}>
            <h2 style={{ margin: '0 0 16px', color: 'var(--color-text-primary)' }}>Hide on Scroll</h2>
            <p style={{ color: 'var(--color-text-tertiary)', marginBottom: '16px' }}>
              The bottom navigation hides when scrolling down and reappears when scrolling up.
            </p>
            {Array.from({ length: 30 }).map((_, i) => (
              <div
                key={i}
                style={{
                  padding: '16px',
                  marginBottom: '12px',
                  background: 'var(--color-bg-secondary)',
                  borderRadius: '8px',
                }}
              >
                <h3 style={{ margin: '0 0 4px', color: 'var(--color-text-primary)' }}>Scroll Item {i + 1}</h3>
                <p style={{ margin: 0, color: 'var(--color-text-tertiary)', fontSize: '0.875rem' }}>
                  Scroll down to hide navigation
                </p>
              </div>
            ))}
          </div>
        </BottomNavLayout>
      </div>
    );
  },
};

// ============================================================
// CollapsibleSectionLayout Stories
// ============================================================

export const CollapsibleBasic = {
  name: 'Collapsible - Basic',
  render: () => (
    <div style={{ padding: '16px', maxWidth: '600px', margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 16px', color: 'var(--color-text-primary)' }}>Experience Details</h2>
      <CollapsibleSectionLayout>
        <Section title="Overview" defaultExpanded>
          <p style={{ margin: 0, lineHeight: 1.6, color: 'var(--color-text-secondary)' }}>
            Experience the vibrant culture of Tokyo through its food, temples, and modern attractions.
            This 5-day journey takes you through the best of Japan's capital city.
          </p>
        </Section>
        <Section title="Itinerary">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', color: 'var(--color-text-secondary)' }}>
            <div><strong>Day 1:</strong> Arrival & Shibuya</div>
            <div><strong>Day 2:</strong> Senso-ji & Asakusa</div>
            <div><strong>Day 3:</strong> Mount Fuji Day Trip</div>
            <div><strong>Day 4:</strong> Akihabara & Shopping</div>
            <div><strong>Day 5:</strong> Departure</div>
          </div>
        </Section>
        <Section title="What's Included">
          <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--color-text-secondary)' }}>
            <li>Hotel accommodation (4 nights)</li>
            <li>Daily breakfast</li>
            <li>Airport transfers</li>
            <li>Local guide</li>
            <li>Admission tickets</li>
          </ul>
        </Section>
        <Section title="Travel Tips">
          <p style={{ margin: 0, lineHeight: 1.6, color: 'var(--color-text-secondary)' }}>
            Get a JR Pass for unlimited train travel. Cash is still widely used, so bring yen.
            Download offline maps before arrival.
          </p>
        </Section>
      </CollapsibleSectionLayout>
    </div>
  ),
};

export const CollapsibleWithIcons = {
  name: 'Collapsible - With Icons',
  render: () => (
    <div style={{ padding: '16px', maxWidth: '600px', margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 16px', color: 'var(--color-text-primary)' }}>Plan Your Trip</h2>
      <CollapsibleSectionLayout bordered>
        <Section title="Location" icon={<FaMapMarkerAlt />} defaultExpanded>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', color: 'var(--color-text-secondary)' }}>
            <div>Tokyo, Japan</div>
            <div style={{ color: 'var(--color-text-tertiary)', fontSize: '0.875rem' }}>
              Shinjuku District
            </div>
          </div>
        </Section>
        <Section title="Duration" icon={<FaClock />} subtitle="5 days">
          <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
            Recommended duration for this experience. Can be extended to 7 days for a more relaxed pace.
          </p>
        </Section>
        <Section title="Budget" icon={<FaDollarSign />} subtitle="$1,200 estimated">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', color: 'var(--color-text-secondary)' }}>
            <div>Accommodation: $600</div>
            <div>Food: $300</div>
            <div>Activities: $200</div>
            <div>Transportation: $100</div>
          </div>
        </Section>
      </CollapsibleSectionLayout>
    </div>
  ),
};

export const CollapsibleWithBadges = {
  name: 'Collapsible - With Badges',
  render: () => (
    <div style={{ padding: '16px', maxWidth: '600px', margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 16px', color: 'var(--color-text-primary)' }}>Activity Categories</h2>
      <CollapsibleSectionLayout elevated>
        <Section
          title="Food & Dining"
          icon={<FaUtensils />}
          badge="12 items"
          defaultExpanded
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {['Sushi', 'Ramen', 'Tempura', 'Izakaya', 'Street Food'].map((item) => (
              <span
                key={item}
                style={{
                  padding: '4px 12px',
                  background: 'var(--color-bg-tertiary)',
                  borderRadius: '16px',
                  fontSize: '0.875rem',
                  color: 'var(--color-text-primary)',
                }}
              >
                {item}
              </span>
            ))}
          </div>
        </Section>
        <Section title="Sightseeing" icon={<FaCamera />} badge="8 items">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {['Temples', 'Gardens', 'Shrines', 'Views'].map((item) => (
              <span
                key={item}
                style={{
                  padding: '4px 12px',
                  background: 'var(--color-bg-tertiary)',
                  borderRadius: '16px',
                  fontSize: '0.875rem',
                  color: 'var(--color-text-primary)',
                }}
              >
                {item}
              </span>
            ))}
          </div>
        </Section>
        <Section title="Outdoor Activities" icon={<FaHiking />} badge="5 items">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {['Hiking', 'Parks', 'Beaches'].map((item) => (
              <span
                key={item}
                style={{
                  padding: '4px 12px',
                  background: 'var(--color-bg-tertiary)',
                  borderRadius: '16px',
                  fontSize: '0.875rem',
                  color: 'var(--color-text-primary)',
                }}
              >
                {item}
              </span>
            ))}
          </div>
        </Section>
        <Section title="Wellness" icon={<FaSpa />} badge="3 items">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {['Onsen', 'Spa', 'Meditation'].map((item) => (
              <span
                key={item}
                style={{
                  padding: '4px 12px',
                  background: 'var(--color-bg-tertiary)',
                  borderRadius: '16px',
                  fontSize: '0.875rem',
                  color: 'var(--color-text-primary)',
                }}
              >
                {item}
              </span>
            ))}
          </div>
        </Section>
      </CollapsibleSectionLayout>
    </div>
  ),
};

export const CollapsibleAllowMultiple = {
  name: 'Collapsible - Allow Multiple Open',
  render: () => (
    <div style={{ padding: '16px', maxWidth: '600px', margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 16px', color: 'var(--color-text-primary)' }}>FAQ</h2>
      <CollapsibleSectionLayout allowMultiple bordered>
        <Section title="What is the best time to visit?" defaultExpanded>
          <p style={{ margin: 0, lineHeight: 1.6, color: 'var(--color-text-secondary)' }}>
            Spring (March-May) and Autumn (September-November) offer the best weather and scenery.
            Cherry blossoms bloom in late March to early April.
          </p>
        </Section>
        <Section title="Do I need a visa?">
          <p style={{ margin: 0, lineHeight: 1.6, color: 'var(--color-text-secondary)' }}>
            Many countries have visa-free entry for up to 90 days. Check with your local embassy
            for specific requirements based on your nationality.
          </p>
        </Section>
        <Section title="What should I pack?">
          <ul style={{ margin: 0, paddingLeft: '20px', lineHeight: 1.8, color: 'var(--color-text-secondary)' }}>
            <li>Comfortable walking shoes</li>
            <li>Portable WiFi or SIM card</li>
            <li>Universal adapter</li>
            <li>Light layers (weather varies)</li>
            <li>Small bag for day trips</li>
          </ul>
        </Section>
        <Section title="How do I get around?">
          <p style={{ margin: 0, lineHeight: 1.6, color: 'var(--color-text-secondary)' }}>
            The train system is extensive and efficient. Get a JR Pass for unlimited travel
            on JR lines. IC cards (Suica/Pasmo) work for local trains and buses.
          </p>
        </Section>
        <Section title="Is it safe?">
          <p style={{ margin: 0, lineHeight: 1.6, color: 'var(--color-text-secondary)' }}>
            Japan is one of the safest countries in the world. Crime rates are very low,
            and you can walk around at night without worry.
          </p>
        </Section>
      </CollapsibleSectionLayout>
    </div>
  ),
};

export const CollapsibleDisabledSection = {
  name: 'Collapsible - With Disabled Section',
  render: () => (
    <div style={{ padding: '16px', maxWidth: '600px', margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 16px', color: 'var(--color-text-primary)' }}>Experience Categories</h2>
      <CollapsibleSectionLayout bordered>
        <Section
          title="Shopping"
          icon={<FaShoppingBag />}
          badge="Available"
          defaultExpanded
        >
          <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
            Explore Ginza, Harajuku, and Shibuya for world-class shopping experiences.
          </p>
        </Section>
        <Section
          title="Nightlife"
          icon={<FaMusic />}
          badge="Available"
        >
          <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
            Experience Tokyo's vibrant nightlife from Golden Gai to Roppongi.
          </p>
        </Section>
        <Section
          title="Theater & Shows"
          icon={<FaTheaterMasks />}
          badge="Coming Soon"
          disabled
        >
          <p style={{ margin: 0 }}>
            This section is coming soon with kabuki, concerts, and more.
          </p>
        </Section>
      </CollapsibleSectionLayout>
    </div>
  ),
};

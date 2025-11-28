/**
 * Detail Layouts Stories
 * Storybook stories for experience detail and swipe card layout components.
 */

import React, { useState } from 'react';
import { FaClock, FaDollarSign, FaMapMarkerAlt, FaStar, FaUsers } from 'react-icons/fa';
import ExperienceDetailLayout, {
  DetailHero,
  DetailSection,
  DetailMetrics,
  DetailActionBar,
} from '../../components/Layout/ExperienceDetailLayout';
import SwipeCardLayout, {
  SwipeCard,
  SwipeActions,
  SwipeEmpty,
} from '../../components/Layout/SwipeCardLayout';

export default {
  title: 'Layouts/Detail Pages',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Layout components for experience details and discovery swiping.',
      },
    },
  },
};

// Sample data
const sampleExperience = {
  title: 'Tokyo Food Tour',
  subtitle: 'Experience authentic Japanese cuisine in the heart of Tokyo',
  location: 'Tokyo, Japan',
  duration: '5 days',
  price: '$1,200',
  rating: 4.8,
  reviews: 234,
  image: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1920',
};

// ============================================================
// ExperienceDetailLayout Stories
// ============================================================

export const DetailComplete = {
  name: 'Experience Detail - Complete',
  render: () => (
    <ExperienceDetailLayout
      hero={
        <DetailHero
          image={sampleExperience.image}
          title={sampleExperience.title}
          subtitle={sampleExperience.location}
          badge="Featured"
          backAction={() => alert('Back clicked')}
          shareAction={() => alert('Share clicked')}
          favoriteAction={() => alert('Favorite clicked')}
        />
      }
      actionBar={
        <DetailActionBar
          price={sampleExperience.price}
          priceLabel="estimated total"
          primaryAction={{
            label: 'Plan It',
            onClick: () => alert('Plan It clicked'),
          }}
          secondaryAction={{
            label: 'Save',
            onClick: () => alert('Save clicked'),
          }}
        />
      }
    >
      <DetailMetrics
        metrics={[
          { icon: <FaClock />, value: '5 days', label: 'Duration' },
          { icon: <FaDollarSign />, value: '$1,200', label: 'Est. Cost' },
          { icon: <FaStar />, value: '4.8', label: '234 reviews' },
          { icon: <FaUsers />, value: '12', label: 'Travelers' },
        ]}
      />

      <DetailSection title="About This Experience">
        <p>
          Embark on a culinary journey through Tokyo's most famous food districts.
          From the bustling Tsukiji Market to hidden ramen shops, discover the
          authentic flavors that make Japanese cuisine world-renowned.
        </p>
      </DetailSection>

      <DetailSection title="Highlights" action={<a href="#">See all</a>}>
        <ul style={{ margin: 0, paddingLeft: '20px', lineHeight: 2 }}>
          <li>Visit 3 traditional markets</li>
          <li>Learn to make authentic ramen</li>
          <li>Sake tasting experience</li>
          <li>Meet local food artisans</li>
          <li>Private sushi masterclass</li>
        </ul>
      </DetailSection>

      <DetailSection title="Itinerary">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {['Arrival & Shibuya', 'Tsukiji & Ginza', 'Cooking Class', 'Asakusa & Ueno', 'Departure'].map(
            (day, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'var(--color-primary)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                  }}
                >
                  {i + 1}
                </span>
                <span>{day}</span>
              </div>
            )
          )}
        </div>
      </DetailSection>

      <DetailSection title="Location">
        <div
          style={{
            height: '200px',
            background: 'var(--color-bg-secondary)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <FaMapMarkerAlt style={{ fontSize: '2rem', color: 'var(--color-primary)' }} />
        </div>
      </DetailSection>
    </ExperienceDetailLayout>
  ),
};

export const DetailMinimal = {
  name: 'Experience Detail - Minimal',
  render: () => (
    <ExperienceDetailLayout
      hero={
        <DetailHero
          title="Weekend Hiking Adventure"
          subtitle="Explore scenic trails near you"
          backAction={() => alert('Back clicked')}
        />
      }
      actionBar={
        <DetailActionBar
          price="Free"
          primaryAction={{
            label: 'Join',
            onClick: () => alert('Join clicked'),
          }}
        />
      }
    >
      <DetailSection title="Description">
        <p>
          A beginner-friendly hiking experience perfect for those looking to
          explore nature without committing to a full day trip.
        </p>
      </DetailSection>

      <DetailSection title="What to Bring">
        <ul style={{ margin: 0, paddingLeft: '20px' }}>
          <li>Comfortable shoes</li>
          <li>Water bottle</li>
          <li>Snacks</li>
          <li>Sunscreen</li>
        </ul>
      </DetailSection>
    </ExperienceDetailLayout>
  ),
};

export const DetailNoActionBar = {
  name: 'Experience Detail - No Action Bar',
  render: () => (
    <ExperienceDetailLayout
      hero={
        <DetailHero
          image="https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1920"
          title="Kyoto Temple Walking Tour"
          subtitle="Kyoto, Japan"
          badge="Popular"
          backAction={() => alert('Back clicked')}
          shareAction={() => alert('Share clicked')}
        />
      }
    >
      <DetailMetrics
        metrics={[
          { icon: <FaClock />, value: '3 days', label: 'Duration' },
          { icon: <FaDollarSign />, value: '$800', label: 'Est. Cost' },
        ]}
      />

      <DetailSection title="Overview">
        <p>
          Walk through centuries of Japanese history as you visit Kyoto's most
          sacred temples and shrines. This self-guided tour allows you to explore
          at your own pace.
        </p>
      </DetailSection>

      <DetailSection title="Included Sites">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {['Kinkaku-ji', 'Fushimi Inari', 'Kiyomizu-dera', 'Arashiyama'].map((site) => (
            <span
              key={site}
              style={{
                padding: '6px 12px',
                background: 'var(--color-bg-secondary)',
                borderRadius: '20px',
                fontSize: '0.875rem',
              }}
            >
              {site}
            </span>
          ))}
        </div>
      </DetailSection>
    </ExperienceDetailLayout>
  ),
};

// ============================================================
// SwipeCardLayout Stories
// ============================================================

const sampleCards = [
  {
    id: 1,
    title: 'Tokyo Food Tour',
    location: 'Tokyo, Japan',
    price: '$1,200',
    image: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800',
    tags: ['Food', 'Culture'],
  },
  {
    id: 2,
    title: 'Kyoto Temples',
    location: 'Kyoto, Japan',
    price: '$800',
    image: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800',
    tags: ['History', 'Nature'],
  },
  {
    id: 3,
    title: 'Mount Fuji Hike',
    location: 'Yamanashi, Japan',
    price: '$450',
    image: 'https://images.unsplash.com/photo-1490806843957-31f4c9a91c65?w=800',
    tags: ['Adventure', 'Nature'],
  },
];

const CardContent = ({ card }) => (
  <>
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `url(${card.image})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    />
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.8) 100%)',
      }}
    />
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '24px',
        color: 'white',
        zIndex: 1,
      }}
    >
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        {card.tags.map((tag) => (
          <span
            key={tag}
            style={{
              padding: '4px 12px',
              background: 'rgba(255,255,255,0.2)',
              backdropFilter: 'blur(8px)',
              borderRadius: '16px',
              fontSize: '0.75rem',
            }}
          >
            {tag}
          </span>
        ))}
      </div>
      <h2 style={{ margin: '0 0 8px', fontSize: '1.5rem', fontWeight: 700, color: 'white' }}>{card.title}</h2>
      <p style={{ margin: '0 0 8px', opacity: 0.9, color: 'white', display: 'flex', alignItems: 'center' }}>
        <FaMapMarkerAlt style={{ marginRight: '4px' }} />
        {card.location}
      </p>
      <p style={{ margin: 0, fontWeight: 600, color: 'white' }}>{card.price}</p>
    </div>
  </>
);

export const SwipeBasic = {
  name: 'Swipe Cards - Basic',
  render: () => {
    const [cards, setCards] = useState(sampleCards);
    const [lastAction, setLastAction] = useState(null);

    const handleSwipe = (id, direction) => {
      setLastAction(`${direction} on card ${id}`);
      setCards((prev) => prev.filter((c) => c.id !== id));
    };

    return (
      <div style={{ height: '100vh' }}>
        <SwipeCardLayout
          header={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h1 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--color-text-primary)' }}>Discover</h1>
              {lastAction && (
                <span style={{ fontSize: '0.875rem', color: 'var(--color-text-tertiary)' }}>
                  {lastAction}
                </span>
              )}
            </div>
          }
          actions={
            cards.length > 0 && (
              <SwipeActions
                onReject={() => handleSwipe(cards[0].id, 'Pass')}
                onLike={() => handleSwipe(cards[0].id, 'Like')}
                onSuperLike={() => handleSwipe(cards[0].id, 'Super Like')}
              />
            )
          }
          emptyState={
            <SwipeEmpty
              title="All caught up!"
              message="You've seen all experiences. Check back later for more."
              action={
                <button
                  className="btn btn-primary"
                  onClick={() => setCards(sampleCards)}
                >
                  Reset Cards
                </button>
              }
            />
          }
        >
          {cards.slice(0, 3).map((card, index) => (
            <SwipeCard
              key={card.id}
              onSwipeLeft={() => handleSwipe(card.id, 'Pass')}
              onSwipeRight={() => handleSwipe(card.id, 'Like')}
              onSwipeUp={() => handleSwipe(card.id, 'Super Like')}
            >
              <CardContent card={card} />
            </SwipeCard>
          ))}
        </SwipeCardLayout>
      </div>
    );
  },
};

export const SwipeWithUndo = {
  name: 'Swipe Cards - With Undo',
  render: () => {
    const [cards, setCards] = useState(sampleCards);
    const [history, setHistory] = useState([]);

    const handleSwipe = (id, direction) => {
      const removedCard = cards.find((c) => c.id === id);
      setHistory((prev) => [...prev, { card: removedCard, action: direction }]);
      setCards((prev) => prev.filter((c) => c.id !== id));
    };

    const handleUndo = () => {
      if (history.length > 0) {
        const lastItem = history[history.length - 1];
        setHistory((prev) => prev.slice(0, -1));
        setCards((prev) => [lastItem.card, ...prev]);
      }
    };

    return (
      <div style={{ height: '100vh' }}>
        <SwipeCardLayout
          header={
            <div style={{ textAlign: 'center' }}>
              <h1 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--color-text-primary)' }}>Explore Experiences</h1>
              <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: 'var(--color-text-tertiary)' }}>
                Swipe right to save, left to pass
              </p>
            </div>
          }
          actions={
            cards.length > 0 && (
              <SwipeActions
                onReject={() => handleSwipe(cards[0].id, 'Pass')}
                onLike={() => handleSwipe(cards[0].id, 'Like')}
                onSuperLike={() => handleSwipe(cards[0].id, 'Super Like')}
                onUndo={history.length > 0 ? handleUndo : undefined}
              />
            )
          }
          emptyState={
            <SwipeEmpty
              action={
                history.length > 0 && (
                  <button className="btn btn-outline-primary" onClick={handleUndo}>
                    Undo Last Action
                  </button>
                )
              }
            />
          }
        >
          {cards.slice(0, 3).map((card) => (
            <SwipeCard
              key={card.id}
              onSwipeLeft={() => handleSwipe(card.id, 'Pass')}
              onSwipeRight={() => handleSwipe(card.id, 'Like')}
              onSwipeUp={() => handleSwipe(card.id, 'Super Like')}
            >
              <CardContent card={card} />
            </SwipeCard>
          ))}
        </SwipeCardLayout>
      </div>
    );
  },
};

export const SwipeEmptyState = {
  name: 'Swipe Cards - Empty State',
  render: () => (
    <div style={{ height: '100vh' }}>
      <SwipeCardLayout
        header={
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--color-text-primary)' }}>Discover</h1>
          </div>
        }
        emptyState={
          <SwipeEmpty
            title="No more experiences"
            message="You've viewed all available experiences. Expand your search or check back later."
            action={
              <button className="btn btn-primary">Browse Categories</button>
            }
          />
        }
      />
    </div>
  ),
};

import React from 'react';
import { Heading, Text } from '../design-system';
import { useUser } from '../../contexts/UserContext';
import DestinationCard from '../DestinationCard/DestinationCard';

export default function Favorites() {
  const { favoriteDestinations = [] } = useUser();

  return (
    <div style={{ height: '100%', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-primary)', border: '1px solid var(--color-border-light)' }}>
      <Heading level={4}>Favorites</Heading>
      <Text size="sm" className="mb-3">Your favorite destinations</Text>

      {favoriteDestinations.length === 0 ? (
        <div style={{ paddingTop: 'var(--space-3)' }}>
          <Text size="sm">No favorite destinations yet.</Text>
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', overflow: 'auto', maxHeight: '55vh', alignItems: 'flex-start' }}>
          {favoriteDestinations.map((dest) => {
            // dest may be an object or a string (id/slug). DestinationCard expects an object.
            const destinationObj = dest && typeof dest === 'object' ? dest : { _id: dest, name: String(dest) };
            const key = (destinationObj && (destinationObj._id || destinationObj.slug || destinationObj.name)) || Math.random();

            // Wrap card to provide consistent sizing in the grid
            return (
              <div key={key} style={{ width: '180px', flex: '0 0 180px' }}>
                <DestinationCard
                  destination={destinationObj}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

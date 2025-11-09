import React from 'react';
import TagPill from './TagPill';
import { Link, MemoryRouter, useInRouterContext } from 'react-router-dom';

export default {
  title: 'Components/TagPill/Context',
  component: TagPill,
  decorators: [
    (Story) => {
      const RouterGuard = ({ children }) => {
        const inRouter = useInRouterContext();
        return inRouter ? children : <MemoryRouter initialEntries={["/"]}>{children}</MemoryRouter>;
      };

      return (
        <div style={{ padding: 20, maxWidth: 800 }}>
          <RouterGuard>
            <Story />
          </RouterGuard>
        </div>
      );
    }
  ],
};

export const ExperienceDetail = {
  render: () => (
    <div style={{ border: '1px solid var(--color-border-medium)', borderRadius: 8, padding: 16 }}>
      <h3 style={{ marginTop: 0 }}>Sunrise Kayak Tour</h3>
      <p style={{ marginTop: 0, color: 'var(--color-text-secondary)' }}>A gentle morning paddle with local guides.</p>

      <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
        <TagPill as={Link} to="/experience-types/adventure" color="info" size="sm">Adventure</TagPill>
        <TagPill as={Link} to="/experience-types/outdoors" color="success" size="sm">Outdoors</TagPill>
        <TagPill as={Link} to="/experience-types/family" color="primary" size="sm">Family</TagPill>
      </div>
    </div>
  )
};

export const InlineLinkExample = {
  render: () => (
    <div style={{ padding: 8 }}>
      <TagPill as={Link} to="/destinations/123" color="primary">View Destination</TagPill>
    </div>
  )
};

import React from 'react';
import TagPill from './TagPill';
import { Link } from 'react-router-dom';
import { Button } from '../../components/design-system';

export default {
  title: 'Components/TagPill/ProfileCard',
  component: TagPill,
  decorators: [
    (Story) => (
      <div style={{ padding: 20 }}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: 'centered'
  }
};

const ProfileCard = ({ children }) => (
  <div style={{ width: 720, borderRadius: 12, padding: 24, background: 'linear-gradient(90deg,var(--color-primary),var(--color-primary-dark))', color: 'var(--color-on-primary, #fff)', boxShadow: 'var(--shadow-sm)' }}>
    <h2 style={{ margin: 0, textAlign: 'center' }}>Favorite Destinations</h2>
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
      <div style={{ background: 'var(--color-bg-surface, rgba(255,255,255,0.08))', padding: 16, borderRadius: 12, minWidth: 560 }}>
        {children}
      </div>
    </div>
  </div>
);

export const Light = {
  name: 'Light Mode',
  render: () => (
    <ProfileCard>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 12, alignItems: 'center' }}>
        <TagPill color="light" size="md" as={Link} to="/destinations/1">
          <span className="icon">🌍</span>
          Accra
        </TagPill>
      </div>
      <div style={{ marginTop: 20, textAlign: 'center' }}>
        <Button as={Link} to="/experiences" variant="gradient" size="sm">Add Some Experiences</Button>
      </div>
    </ProfileCard>
  )
};

export const Dark = {
  name: 'Dark Mode',
  render: () => (
    <div data-bs-theme="dark" style={{ padding: 20, background: 'var(--color-bg-default, #0b1220)' }}>
      <ProfileCard>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, alignItems: 'center' }}>
          <TagPill color="light" size="md" as={Link} to="/destinations/1">
            <span className="icon">🌍</span>
            Accra
          </TagPill>
        </div>
        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <Button as={Link} to="/experiences" variant="gradient" size="sm">Add Some Experiences</Button>
        </div>
      </ProfileCard>
    </div>
  )
};

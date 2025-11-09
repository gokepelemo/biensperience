import React from 'react';
import StarRating from './StarRating';

export default {
  title: 'Components/StarRating',
  component: StarRating,
  argTypes: {
    value: {
      control: { type: 'number', min: 0, max: 5, step: 0.5 },
      description: 'Rating value (0-5, supports half stars)'
    },
    max: {
      control: { type: 'number', min: 1, max: 10 },
      description: 'Maximum number of stars'
    },
    size: {
      control: { type: 'number', min: 8, max: 48 },
      description: 'Size of stars in pixels'
    },
    color: {
      control: { type: 'color' },
      description: 'Color of the stars'
    },
    className: {
      control: { type: 'text' },
      description: 'Additional CSS classes'
    }
  },
  parameters: {
    docs: {
      description: { component: 'Read-only star rating component with half-star support.' }
    }
  }
};

export const Playground = (args) => <StarRating {...args} />;
Playground.args = {
  value: 4.5,
  max: 5,
  size: 16,
  color: '#f59e0b',
  className: ''
};

export const Ratings = () => (
  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexDirection: 'column' }}>
    <div><StarRating value={5} /></div>
    <div><StarRating value={4.5} /></div>
    <div><StarRating value={3} /></div>
    <div><StarRating value={1.5} /></div>
  </div>
);

import React from 'react';
import RatingScale, { StarRating, DifficultyRating, PercentageRating } from './RatingScale';

export default {
  title: 'Components/RatingScale',
  component: RatingScale,
  argTypes: {
    value: {
      control: { type: 'number', min: 0, max: 10, step: 0.5 },
      description: 'Rating value'
    },
    scale: {
      control: { type: 'select' },
      options: ['star', 'difficulty', 'percentage', 'custom'],
      description: 'Type of rating scale'
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg', 'xl'],
      description: 'Size variant'
    },
    showValue: {
      control: { type: 'boolean' },
      description: 'Show numeric value'
    },
    showLabel: {
      control: { type: 'boolean' },
      description: 'Show descriptive label'
    }
  },
  parameters: {
    docs: {
      description: {
        component: 'Unified rating component supporting star ratings (0-5), difficulty ratings (1-10), and percentage displays (0-100).'
      }
    }
  }
};

// Generic RatingScale
export const Playground = (args) => <RatingScale {...args} />;
Playground.args = {
  value: 4.5,
  scale: 'star',
  size: 'md',
  showValue: false,
  showLabel: false
};

// Star Ratings
export const StarRatings = () => (
  <div style={{ display: 'flex', gap: '1.5rem', flexDirection: 'column' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <StarRating rating={5} />
      <span>5.0 - Excellent</span>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <StarRating rating={4.5} />
      <span>4.5 - Very Good</span>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <StarRating rating={3.5} />
      <span>3.5 - Good</span>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <StarRating rating={2} />
      <span>2.0 - Fair</span>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <StarRating rating={1} />
      <span>1.0 - Poor</span>
    </div>
  </div>
);

export const StarRatingSizes = () => (
  <div style={{ display: 'flex', gap: '1.5rem', flexDirection: 'column' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <StarRating rating={4} size="sm" />
      <span>Small</span>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <StarRating rating={4} size="md" />
      <span>Medium (default)</span>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <StarRating rating={4} size="lg" />
      <span>Large</span>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <StarRating rating={4} size="xl" />
      <span>Extra Large</span>
    </div>
  </div>
);

export const StarRatingWithValueAndLabel = () => (
  <div style={{ display: 'flex', gap: '1.5rem', flexDirection: 'column' }}>
    <StarRating rating={4.5} showValue />
    <StarRating rating={4.5} showLabel />
    <StarRating rating={4.5} showValue showLabel />
    <StarRating rating={4.5} showValue showLabel size="lg" />
  </div>
);

// Difficulty Ratings
export const DifficultyRatings = () => (
  <div style={{ display: 'flex', gap: '1.5rem', flexDirection: 'column', maxWidth: '300px' }}>
    <div>
      <span style={{ display: 'block', marginBottom: '0.5rem' }}>Easy (2/10)</span>
      <DifficultyRating difficulty={2} showValue showLabel />
    </div>
    <div>
      <span style={{ display: 'block', marginBottom: '0.5rem' }}>Moderate (5/10)</span>
      <DifficultyRating difficulty={5} showValue showLabel />
    </div>
    <div>
      <span style={{ display: 'block', marginBottom: '0.5rem' }}>Challenging (7/10)</span>
      <DifficultyRating difficulty={7} showValue showLabel />
    </div>
    <div>
      <span style={{ display: 'block', marginBottom: '0.5rem' }}>Extreme (10/10)</span>
      <DifficultyRating difficulty={10} showValue showLabel />
    </div>
  </div>
);

export const DifficultyVariants = () => (
  <div style={{ display: 'flex', gap: '2rem', flexDirection: 'column', maxWidth: '300px' }}>
    <div>
      <span style={{ display: 'block', marginBottom: '0.5rem' }}>Bar Variant (default)</span>
      <DifficultyRating difficulty={7} variant="bar" showValue showLabel />
    </div>
    <div>
      <span style={{ display: 'block', marginBottom: '0.5rem' }}>Dots Variant</span>
      <DifficultyRating difficulty={7} variant="dots" showValue showLabel />
    </div>
    <div>
      <span style={{ display: 'block', marginBottom: '0.5rem' }}>Numeric Variant</span>
      <DifficultyRating difficulty={7} variant="numeric" showLabel />
    </div>
  </div>
);

// Percentage Ratings
export const PercentageRatings = () => (
  <div style={{ display: 'flex', gap: '1.5rem', flexDirection: 'column', maxWidth: '300px' }}>
    <div>
      <span style={{ display: 'block', marginBottom: '0.5rem' }}>25% Complete</span>
      <PercentageRating value={25} />
    </div>
    <div>
      <span style={{ display: 'block', marginBottom: '0.5rem' }}>50% Complete</span>
      <PercentageRating value={50} />
    </div>
    <div>
      <span style={{ display: 'block', marginBottom: '0.5rem' }}>75% Complete</span>
      <PercentageRating value={75} />
    </div>
    <div>
      <span style={{ display: 'block', marginBottom: '0.5rem' }}>100% Complete</span>
      <PercentageRating value={100} color="success" />
    </div>
  </div>
);

export const PercentageColors = () => (
  <div style={{ display: 'flex', gap: '1.5rem', flexDirection: 'column', maxWidth: '300px' }}>
    <div>
      <span style={{ display: 'block', marginBottom: '0.5rem' }}>Primary</span>
      <PercentageRating value={60} color="primary" />
    </div>
    <div>
      <span style={{ display: 'block', marginBottom: '0.5rem' }}>Success</span>
      <PercentageRating value={60} color="success" />
    </div>
    <div>
      <span style={{ display: 'block', marginBottom: '0.5rem' }}>Warning</span>
      <PercentageRating value={60} color="warning" />
    </div>
    <div>
      <span style={{ display: 'block', marginBottom: '0.5rem' }}>Danger</span>
      <PercentageRating value={60} color="danger" />
    </div>
  </div>
);

// No Rating State
export const NoRating = () => (
  <div style={{ display: 'flex', gap: '1.5rem', flexDirection: 'column' }}>
    <div>
      <span style={{ display: 'block', marginBottom: '0.5rem' }}>Star Scale - No Rating</span>
      <RatingScale value={null} scale="star" />
    </div>
    <div>
      <span style={{ display: 'block', marginBottom: '0.5rem' }}>Difficulty Scale - No Rating</span>
      <RatingScale value={null} scale="difficulty" />
    </div>
  </div>
);

// Using Generic RatingScale
export const GenericRatingScale = () => (
  <div style={{ display: 'flex', gap: '2rem', flexDirection: 'column' }}>
    <div>
      <span style={{ display: 'block', marginBottom: '0.5rem' }}>scale="star"</span>
      <RatingScale value={4.5} scale="star" showValue showLabel />
    </div>
    <div style={{ maxWidth: '300px' }}>
      <span style={{ display: 'block', marginBottom: '0.5rem' }}>scale="difficulty"</span>
      <RatingScale value={7} scale="difficulty" showValue showLabel />
    </div>
    <div style={{ maxWidth: '300px' }}>
      <span style={{ display: 'block', marginBottom: '0.5rem' }}>scale="percentage"</span>
      <RatingScale value={75} scale="percentage" showValue />
    </div>
  </div>
);

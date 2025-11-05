import { BrowserRouter } from 'react-router-dom';
import ExperienceCard from '../components/ExperienceCard/ExperienceCard';

export default {
  title: 'Components/ExperienceCard',
  component: ExperienceCard,
  decorators: [
    (Story) => (
      <BrowserRouter>
        <div style={{ maxWidth: '400px' }}>
          <Story />
        </div>
      </BrowserRouter>
    ),
  ],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Experience card component for displaying travel experiences with images, titles, and metadata. Used throughout the application for browsing and selecting travel experiences.',
      },
    },
  },
  tags: ['autodocs'],
};

const sampleExperience = {
  _id: '1',
  name: 'Eiffel Tower Visit',
  destination: {
    name: 'Paris',
    country: 'France',
  },
  photos: [
    {
      url: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800',
      photo_credit: 'Unsplash',
      photo_credit_url: 'https://unsplash.com',
    },
  ],
  default_photo_id: null,
  experience_type: ['Sightseeing', 'Photography', 'Cultural'],
  cost_estimate: 50,
  max_planning_days: 7,
  user: {
    _id: 'user1',
    name: 'John Doe',
  },
};

export const Default = {
  args: {
    experience: sampleExperience,
    user: { _id: 'user1', name: 'John Doe' },
  },
};

export const WithMultiplePhotos = {
  args: {
    experience: {
      ...sampleExperience,
      photos: [
        {
          url: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800',
          photo_credit: 'Unsplash',
          photo_credit_url: 'https://unsplash.com',
        },
        {
          url: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800',
          photo_credit: 'Unsplash',
          photo_credit_url: 'https://unsplash.com',
        },
      ],
    },
    user: { _id: 'user1', name: 'John Doe' },
  },
};

export const LongTitle = {
  args: {
    experience: {
      ...sampleExperience,
      name: 'An Incredible Journey Through the Historic Streets of Paris Including Eiffel Tower',
    },
    user: { _id: 'user1', name: 'John Doe' },
  },
};

export const ManyTags = {
  args: {
    experience: {
      ...sampleExperience,
      experience_type: ['Sightseeing', 'Photography', 'Cultural', 'Historical', 'Romantic', 'Urban'],
    },
    user: { _id: 'user1', name: 'John Doe' },
  },
};

export const NoCostEstimate = {
  args: {
    experience: {
      ...sampleExperience,
      cost_estimate: 0,
    },
    user: { _id: 'user1', name: 'John Doe' },
  },
};

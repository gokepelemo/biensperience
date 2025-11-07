import DestinationCard from '../components/DestinationCard/DestinationCard';

export default {
  title: 'Components/DestinationCard',
  component: DestinationCard,
  decorators: [
    (Story) => (
      <div style={{ maxWidth: '400px' }}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Destination card component for displaying travel destinations with images, names, and metadata. Features favorite toggling and click interactions.',
      },
    },
  },
  tags: [],
};

const sampleDestination = {
  _id: '1',
  name: 'Paris',
  country: 'France',
  state: 'Île-de-France',
  photos: [
    {
      url: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800',
      photo_credit: 'Unsplash',
      photo_credit_url: 'https://unsplash.com',
    },
  ],
  default_photo_id: null,
  users_favorite: [],
  travel_tips: ['Language: French', 'Currency: Euro', 'Best time: Spring/Fall'],
};

const mockExperiences = [
  { _id: '1', name: 'Eiffel Tower', destination: '1' },
  { _id: '2', name: 'Louvre Museum', destination: '1' },
  { _id: '3', name: 'Arc de Triomphe', destination: '1' },
];

export const Default = {
  args: {
    destination: sampleDestination,
    experiences: mockExperiences,
    user: { _id: 'user1', name: 'John Doe' },
  },
};

export const Favorited = {
  args: {
    destination: {
      ...sampleDestination,
      users_favorite: ['user1'],
    },
    experiences: mockExperiences,
    user: { _id: 'user1', name: 'John Doe' },
  },
};

export const WithMultiplePhotos = {
  args: {
    destination: {
      ...sampleDestination,
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
        {
          url: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800',
          photo_credit: 'Unsplash',
          photo_credit_url: 'https://unsplash.com',
        },
      ],
    },
    experiences: mockExperiences,
    user: { _id: 'user1', name: 'John Doe' },
  },
};

export const NoExperiences = {
  args: {
    destination: sampleDestination,
    experiences: [],
    user: { _id: 'user1', name: 'John Doe' },
  },
};

export const ManyExperiences = {
  args: {
    destination: sampleDestination,
    experiences: [
      ...mockExperiences,
      { _id: '4', name: 'Notre-Dame', destination: '1' },
      { _id: '5', name: 'Sacré-Cœur', destination: '1' },
      { _id: '6', name: 'Versailles', destination: '1' },
    ],
    user: { _id: 'user1', name: 'John Doe' },
  },
};

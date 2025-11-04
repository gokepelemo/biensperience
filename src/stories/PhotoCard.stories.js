import PhotoCard from '../components/PhotoCard/PhotoCard';

export default {
  title: 'Components/PhotoCard',
  component: PhotoCard,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    altText: {
      control: 'text',
      description: 'Alternative text for the image',
    },
    title: {
      control: 'text',
      description: 'Title for the photo',
    },
    defaultPhotoIndex: {
      control: 'number',
      description: 'Index of the default photo to display',
    },
  },
};

// Sample photo data
const singlePhoto = {
  url: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800',
  photo_credit: 'Unsplash',
  photo_credit_url: 'https://unsplash.com',
};

const multiplePhotos = [
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
];

export const SinglePhoto = {
  args: {
    photo: singlePhoto,
    altText: 'Beautiful landscape',
    title: 'Sunset over Paris',
  },
};

export const MultiplePhotos = {
  args: {
    photos: multiplePhotos,
    defaultPhotoIndex: 0,
    altText: 'Travel destination photos',
    title: 'Paris Experience',
  },
};

export const WithoutPhotoCredit = {
  args: {
    photo: {
      url: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800',
    },
    altText: 'Photo without credit',
  },
};

export const PlaceholderImage = {
  args: {
    altText: 'Placeholder image',
    title: 'No photo provided',
  },
};

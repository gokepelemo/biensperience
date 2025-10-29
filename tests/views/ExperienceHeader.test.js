/**
 * Tests for ExperienceHeader component
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ExperienceHeader from '../ExperienceHeader';

const renderWithRouter = (component) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('ExperienceHeader', () => {
  const mockExperience = {
    _id: '123',
    name: 'Eiffel Tower Visit',
    description: 'Visit the iconic Eiffel Tower',
    destination: {
      _id: '456',
      name: 'Paris',
      country: 'France'
    },
    cost_estimate: 150,
    experience_type: ['Tourism', 'Sightseeing'],
    photos: [
      { _id: 'photo1', url: 'photo1.jpg' }
    ],
    default_photo_id: 'photo1'
  };

  const mockTravelTips = ['Best time is early morning', 'Buy tickets online'];

  it('should render experience title', () => {
    renderWithRouter(
      <ExperienceHeader experience={mockExperience} travelTips={[]} canEdit={false} />
    );

    expect(screen.getByText('Eiffel Tower Visit')).toBeInTheDocument();
  });

  it('should render description', () => {
    renderWithRouter(
      <ExperienceHeader experience={mockExperience} travelTips={[]} canEdit={false} />
    );

    expect(screen.getByText('Visit the iconic Eiffel Tower')).toBeInTheDocument();
  });

  it('should render destination link', () => {
    renderWithRouter(
      <ExperienceHeader experience={mockExperience} travelTips={[]} canEdit={false} />
    );

    const link = screen.getByText('Paris, France');
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', '/destinations/456');
  });

  it('should render cost estimate', () => {
    renderWithRouter(
      <ExperienceHeader experience={mockExperience} travelTips={[]} canEdit={false} />
    );

    expect(screen.getByText('$150')).toBeInTheDocument();
  });

  it('should not render cost if zero', () => {
    const experienceNoCost = { ...mockExperience, cost_estimate: 0 };

    renderWithRouter(
      <ExperienceHeader experience={experienceNoCost} travelTips={[]} canEdit={false} />
    );

    expect(screen.queryByText(/Estimated Cost:/)).not.toBeInTheDocument();
  });

  it('should render experience type tags', () => {
    renderWithRouter(
      <ExperienceHeader experience={mockExperience} travelTips={[]} canEdit={false} />
    );

    expect(screen.getByText('Tourism, Sightseeing')).toBeInTheDocument();
  });

  it('should render travel tips', () => {
    renderWithRouter(
      <ExperienceHeader
        experience={mockExperience}
        travelTips={mockTravelTips}
        canEdit={false}
      />
    );

    expect(screen.getByText('Travel Tips')).toBeInTheDocument();
    expect(screen.getByText('Best time is early morning')).toBeInTheDocument();
    expect(screen.getByText('Buy tickets online')).toBeInTheDocument();
  });

  it('should not render travel tips section when empty', () => {
    renderWithRouter(
      <ExperienceHeader experience={mockExperience} travelTips={[]} canEdit={false} />
    );

    expect(screen.queryByText('Travel Tips')).not.toBeInTheDocument();
  });

  it('should show edit button when canEdit is true', () => {
    renderWithRouter(
      <ExperienceHeader experience={mockExperience} travelTips={[]} canEdit={true} />
    );

    const editButton = screen.getByText('Edit Experience');
    expect(editButton).toBeInTheDocument();
    expect(editButton.closest('a')).toHaveAttribute('href', '/experiences/123/update');
  });

  it('should not show edit button when canEdit is false', () => {
    renderWithRouter(
      <ExperienceHeader experience={mockExperience} travelTips={[]} canEdit={false} />
    );

    expect(screen.queryByText('Edit Experience')).not.toBeInTheDocument();
  });

  it('should return null when no experience', () => {
    const { container } = renderWithRouter(
      <ExperienceHeader experience={null} travelTips={[]} canEdit={false} />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should handle experience without destination', () => {
    const experienceNoDestination = { ...mockExperience, destination: null };

    renderWithRouter(
      <ExperienceHeader experience={experienceNoDestination} travelTips={[]} canEdit={false} />
    );

    expect(screen.queryByText(/Destination:/)).not.toBeInTheDocument();
  });

  it('should handle experience without photos', () => {
    const experienceNoPhotos = { ...mockExperience, photos: [] };

    const { container } = renderWithRouter(
      <ExperienceHeader experience={experienceNoPhotos} travelTips={[]} canEdit={false} />
    );

    // PhotoCard should not render
    expect(container.querySelector('.photo-card')).not.toBeInTheDocument();
  });

  it('should handle experience without type tags', () => {
    const experienceNoTags = { ...mockExperience, experience_type: [] };

    renderWithRouter(
      <ExperienceHeader experience={experienceNoTags} travelTips={[]} canEdit={false} />
    );

    expect(screen.queryByText(/Type:/)).not.toBeInTheDocument();
  });
});

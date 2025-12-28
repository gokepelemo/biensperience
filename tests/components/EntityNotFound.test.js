import React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('../../src/utilities/paquette-utils', () => ({
  addEasterEgg: (text) => text
}));

import EntityNotFound from '../../src/components/EntityNotFound/EntityNotFound';

describe('EntityNotFound Component', () => {
  test('renders experience not found message', () => {
    render(
      <EntityNotFound
        entityType="experience"
        onPrimaryAction={jest.fn()}
        onSecondaryAction={jest.fn()}
      />
    );

    expect(screen.getByText('Experience Not Found')).toBeInTheDocument();
    expect(screen.getByText('This experience may have been deleted or you may not have permission to view it.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Browse Experiences' })).toBeInTheDocument();
  });

  test('renders destination not found message', () => {
    render(
      <EntityNotFound
        entityType="destination"
        onPrimaryAction={jest.fn()}
        onSecondaryAction={jest.fn()}
      />
    );

    expect(screen.getByText('Destination Not Found')).toBeInTheDocument();
    expect(screen.getByText('This destination may have been deleted or you may not have permission to view it.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Browse Destinations' })).toBeInTheDocument();
  });

  test('renders plan not found message', () => {
    render(
      <EntityNotFound
        entityType="plan"
        onPrimaryAction={jest.fn()}
        onSecondaryAction={jest.fn()}
      />
    );

    expect(screen.getByText('Plan Not Found')).toBeInTheDocument();
    expect(screen.getByText('This plan may have been deleted or you may not have permission to view it.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'My Plans' })).toBeInTheDocument();
  });

  test('renders user not found message', () => {
    render(
      <EntityNotFound
        entityType="user"
        onPrimaryAction={jest.fn()}
        onSecondaryAction={jest.fn()}
      />
    );

    expect(screen.getByText('User Not Found')).toBeInTheDocument();
    expect(screen.getByText('This user profile may have been deleted or you may not have permission to view it.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Browse Users' })).toBeInTheDocument();
  });

  test('renders with custom size', () => {
    render(
      <EntityNotFound
        entityType="experience"
        size="lg"
        onPrimaryAction={jest.fn()}
        onSecondaryAction={jest.fn()}
      />
    );

    const container = screen.getByText('Experience Not Found').closest('.entityNotFound');
    expect(container).toHaveClass('sizeLg');
  });

  test('renders with compact layout', () => {
    render(
      <EntityNotFound
        entityType="experience"
        compact
        onPrimaryAction={jest.fn()}
        onSecondaryAction={jest.fn()}
      />
    );

    const container = screen.getByText('Experience Not Found').closest('.entityNotFound');
    expect(container).toHaveClass('compact');
  });
});
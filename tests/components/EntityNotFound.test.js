import React from 'react';
import { render, screen } from '@testing-library/react';
import { EntityNotFound } from '../../src/components/EntityNotFound/EntityNotFound';

describe('EntityNotFound Component', () => {
  test('renders experience not found message', () => {
    render(<EntityNotFound entityType="experience" />);

    expect(screen.getByText('Experience Not Found')).toBeInTheDocument();
    expect(screen.getByText('This experience may have been deleted or you may not have permission to view it.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Browse Experiences' })).toBeInTheDocument();
  });

  test('renders destination not found message', () => {
    render(<EntityNotFound entityType="destination" />);

    expect(screen.getByText('Destination Not Found')).toBeInTheDocument();
    expect(screen.getByText('This destination may have been deleted or you may not have permission to view it.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Browse Destinations' })).toBeInTheDocument();
  });

  test('renders plan not found message', () => {
    render(<EntityNotFound entityType="plan" />);

    expect(screen.getByText('Plan Not Found')).toBeInTheDocument();
    expect(screen.getByText('This plan may have been deleted or you may not have permission to view it.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'My Plans' })).toBeInTheDocument();
  });

  test('renders user not found message', () => {
    render(<EntityNotFound entityType="user" />);

    expect(screen.getByText('User Not Found')).toBeInTheDocument();
    expect(screen.getByText('This user profile may have been deleted or you may not have permission to view it.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Browse Users' })).toBeInTheDocument();
  });

  test('renders with custom size', () => {
    render(<EntityNotFound entityType="experience" size="lg" />);

    const container = screen.getByText('Experience Not Found').closest('.entity-not-found');
    expect(container).toHaveClass('sizeLg');
  });

  test('renders with compact layout', () => {
    render(<EntityNotFound entityType="experience" compact />);

    const container = screen.getByText('Experience Not Found').closest('.entity-not-found');
    expect(container).toHaveClass('compact');
  });
});
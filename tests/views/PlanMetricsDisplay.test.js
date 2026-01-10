/**
 * Tests for PlanMetricsDisplay component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PlanMetricsDisplay from '../PlanMetricsDisplay';

describe('PlanMetricsDisplay', () => {
  const defaultProps = {
    plannedDate: '2024-12-25',
    completionPercentage: 50,
    totalCost: 1500,
    onEditDate: jest.fn(),
    showEditButton: true
  };

  it('should render all metrics', () => {
    render(<PlanMetricsDisplay {...defaultProps} />);

    expect(screen.getByText('Planned Date')).toBeInTheDocument();
    expect(screen.getByText('Completion')).toBeInTheDocument();
    expect(screen.getByText('Estimated Cost')).toBeInTheDocument();
  });

  it('should display planned date', () => {
    render(<PlanMetricsDisplay {...defaultProps} />);

    // formatDateMetricCard should format the date
    const dateElement = screen.getByText(/25/);
    expect(dateElement).toBeInTheDocument();
  });

  it('should show "Not set" when no date', () => {
    render(<PlanMetricsDisplay {...defaultProps} plannedDate={null} />);

    expect(screen.getByText('Not set')).toBeInTheDocument();
  });

  it('should display completion percentage', () => {
    render(<PlanMetricsDisplay {...defaultProps} />);

    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('should render progress bar with correct width', () => {
    const { container } = render(<PlanMetricsDisplay {...defaultProps} />);

    const progressBar = container.querySelector('.progress-bar');
    expect(progressBar).toHaveStyle({ width: '50%' });
  });

  it('should display formatted cost', () => {
    render(<PlanMetricsDisplay {...defaultProps} />);

    expect(screen.getByText('$1,500')).toBeInTheDocument();
  });

  it('should call onEditDate when edit button clicked', () => {
    const onEditDate = jest.fn();
    render(<PlanMetricsDisplay {...defaultProps} onEditDate={onEditDate} />);

    const editButton = screen.getByText('Update Date');
    fireEvent.click(editButton);

    expect(onEditDate).toHaveBeenCalled();
  });

  it('should show "Set Date" when no date', () => {
    render(<PlanMetricsDisplay {...defaultProps} plannedDate={null} />);

    expect(screen.getByText('Set Date')).toBeInTheDocument();
  });

  it('should not show edit button when showEditButton is false', () => {
    render(<PlanMetricsDisplay {...defaultProps} showEditButton={false} />);

    expect(screen.queryByText('Update Date')).not.toBeInTheDocument();
    expect(screen.queryByText('Set Date')).not.toBeInTheDocument();
  });

  it('should handle zero cost', () => {
    render(<PlanMetricsDisplay {...defaultProps} totalCost={0} />);

    expect(screen.getByText('$0')).toBeInTheDocument();
  });

  it('should handle 100% completion', () => {
    const { container } = render(
      <PlanMetricsDisplay {...defaultProps} completionPercentage={100} />
    );

    expect(screen.getByText('100%')).toBeInTheDocument();

    const progressBar = container.querySelector('.progress-bar');
    expect(progressBar).toHaveStyle({ width: '100%' });
  });

  it('should handle 0% completion', () => {
    const { container } = render(
      <PlanMetricsDisplay {...defaultProps} completionPercentage={0} />
    );

    expect(screen.getByText('0%')).toBeInTheDocument();

    const progressBar = container.querySelector('.progress-bar');
    expect(progressBar).toHaveStyle({ width: '0%' });
  });
});

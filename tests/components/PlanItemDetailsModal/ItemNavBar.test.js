/**
 * Tests for ItemNavBar — extracted from PlanItemDetailsModal as part of bd 4590.
 *
 * Confirms:
 * - returns null when both onPrev and onNext are missing (rendered as nothing)
 * - prev/next buttons disabled when their respective callbacks are missing
 * - clicking enabled buttons fires the callbacks
 * - aria-labels are present (a11y contract)
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

jest.mock('../../../src/components/PlanItemDetailsModal/PlanItemDetailsModal.module.css', () => new Proxy({}, {
  get: (_, key) => key,
}), { virtual: true });

import ItemNavBar from '../../../src/components/PlanItemDetailsModal/ItemNavBar';

describe('ItemNavBar', () => {
  it('renders nothing when both onPrev and onNext are missing', () => {
    const { container } = render(<ItemNavBar />);
    expect(container.firstChild).toBeNull();
  });

  it('renders both nav buttons with the right aria-labels', () => {
    render(<ItemNavBar onPrev={jest.fn()} onNext={jest.fn()} />);
    expect(screen.getByLabelText('Previous plan item')).toBeInTheDocument();
    expect(screen.getByLabelText('Next plan item')).toBeInTheDocument();
  });

  it('disables prev when onPrev is missing but renders next', () => {
    render(<ItemNavBar onNext={jest.fn()} />);
    expect(screen.getByLabelText('Previous plan item')).toBeDisabled();
    expect(screen.getByLabelText('Next plan item')).not.toBeDisabled();
  });

  it('disables next when onNext is missing but renders prev', () => {
    render(<ItemNavBar onPrev={jest.fn()} />);
    expect(screen.getByLabelText('Next plan item')).toBeDisabled();
    expect(screen.getByLabelText('Previous plan item')).not.toBeDisabled();
  });

  it('fires callbacks on click', () => {
    const onPrev = jest.fn();
    const onNext = jest.fn();
    render(<ItemNavBar onPrev={onPrev} onNext={onNext} />);
    fireEvent.click(screen.getByLabelText('Previous plan item'));
    fireEvent.click(screen.getByLabelText('Next plan item'));
    expect(onPrev).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('renders the navigation hint text', () => {
    render(<ItemNavBar onPrev={jest.fn()} onNext={jest.fn()} />);
    expect(screen.getByText(/arrow keys or swipe/i)).toBeInTheDocument();
  });
});

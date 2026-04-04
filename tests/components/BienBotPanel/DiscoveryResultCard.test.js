import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// ─── Mock design-system components (avoid Chakra context requirement) ────────
jest.mock('../../../src/components/design-system', () => {
  const React = require('react');
  return {
    Button: ({ children, onClick, disabled, variant, size, ...props }) =>
      React.createElement('button', { onClick, disabled, 'data-variant': variant, ...props }, children),
    Text: ({ children, size, className, title, ...props }) =>
      React.createElement('span', { className, title, ...props }, children),
  };
});

import DiscoveryResultCard from '../../../src/components/BienBotPanel/DiscoveryResultCard';

const noopView = jest.fn();
const noopPlan = jest.fn();
const onEmpty = jest.fn();

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// Case a: destination_name present, no destination_id
// ---------------------------------------------------------------------------
describe('empty state — case a (destination unknown)', () => {
  const data = {
    results: [],
    query_metadata: {
      filters_applied: {
        destination_name: 'Rio de Janeiro',
        activity_types: ['cultural']
      }
    }
  };

  it('renders the destination name in the primary message', () => {
    render(
      <DiscoveryResultCard
        data={data}
        onView={noopView}
        onPlan={noopPlan}
        onEmpty={onEmpty}
      />
    );
    expect(screen.getByText(/No experiences found for Rio de Janeiro/i)).toBeInTheDocument();
  });

  it('renders the secondary hint', () => {
    render(
      <DiscoveryResultCard
        data={data}
        onView={noopView}
        onPlan={noopPlan}
        onEmpty={onEmpty}
      />
    );
    expect(screen.getByText(/may not be in your destinations yet/i)).toBeInTheDocument();
  });

  it('renders the correct CTA label', () => {
    render(
      <DiscoveryResultCard
        data={data}
        onView={noopView}
        onPlan={noopPlan}
        onEmpty={onEmpty}
      />
    );
    expect(screen.getByRole('button', { name: /Add Rio de Janeiro as a destination/i })).toBeInTheDocument();
  });

  it('calls onEmpty with filters_applied when CTA is clicked', () => {
    render(
      <DiscoveryResultCard
        data={data}
        onView={noopView}
        onPlan={noopPlan}
        onEmpty={onEmpty}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Add Rio de Janeiro as a destination/i }));
    expect(onEmpty).toHaveBeenCalledTimes(1);
    expect(onEmpty).toHaveBeenCalledWith(data.query_metadata.filters_applied);
  });
});

// ---------------------------------------------------------------------------
// Case b: destination_id present
// ---------------------------------------------------------------------------
describe('empty state — case b (destination exists, no matches)', () => {
  const data = {
    results: [],
    query_metadata: {
      filters_applied: {
        destination_name: 'Paris',
        destination_id: 'abc123',
        activity_types: ['adventure']
      }
    }
  };

  it('renders the destination name in the primary message', () => {
    render(
      <DiscoveryResultCard
        data={data}
        onView={noopView}
        onPlan={noopPlan}
        onEmpty={onEmpty}
      />
    );
    expect(screen.getByText(/No experiences found in Paris/i)).toBeInTheDocument();
  });

  it('renders the secondary hint', () => {
    render(
      <DiscoveryResultCard
        data={data}
        onView={noopView}
        onPlan={noopPlan}
        onEmpty={onEmpty}
      />
    );
    expect(screen.getByText(/Be the first to create one/i)).toBeInTheDocument();
  });

  it('renders the correct CTA label', () => {
    render(
      <DiscoveryResultCard
        data={data}
        onView={noopView}
        onPlan={noopPlan}
        onEmpty={onEmpty}
      />
    );
    expect(screen.getByRole('button', { name: /Create an experience here/i })).toBeInTheDocument();
  });

  it('calls onEmpty with filters_applied when CTA is clicked', () => {
    render(
      <DiscoveryResultCard
        data={data}
        onView={noopView}
        onPlan={noopPlan}
        onEmpty={onEmpty}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Create an experience here/i }));
    expect(onEmpty).toHaveBeenCalledWith(data.query_metadata.filters_applied);
  });

  it('falls back to "this destination" in primary text when destination_name is absent', () => {
    const dataNoName = {
      results: [],
      query_metadata: {
        filters_applied: { destination_id: 'abc123' }
      }
    };
    render(
      <DiscoveryResultCard
        data={dataNoName}
        onView={noopView}
        onPlan={noopPlan}
        onEmpty={onEmpty}
      />
    );
    expect(screen.getByText(/No experiences found in this destination/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Case c: no destination context
// ---------------------------------------------------------------------------
describe('empty state — case c (cross-destination, no matches)', () => {
  const data = {
    results: [],
    query_metadata: {
      filters_applied: { activity_types: ['wellness'] }
    }
  };

  it('renders the generic primary message', () => {
    render(
      <DiscoveryResultCard
        data={data}
        onView={noopView}
        onPlan={noopPlan}
        onEmpty={onEmpty}
      />
    );
    expect(screen.getByText(/No matching experiences found/i)).toBeInTheDocument();
  });

  it('renders the secondary hint', () => {
    render(
      <DiscoveryResultCard
        data={data}
        onView={noopView}
        onPlan={noopPlan}
        onEmpty={onEmpty}
      />
    );
    expect(screen.getByText(/Try broadening your search or start fresh/i)).toBeInTheDocument();
  });

  it('renders the correct CTA label', () => {
    render(
      <DiscoveryResultCard
        data={data}
        onView={noopView}
        onPlan={noopPlan}
        onEmpty={onEmpty}
      />
    );
    expect(screen.getByRole('button', { name: /Create a destination to get started/i })).toBeInTheDocument();
  });

  it('calls onEmpty with filters_applied when CTA is clicked', () => {
    render(
      <DiscoveryResultCard
        data={data}
        onView={noopView}
        onPlan={noopPlan}
        onEmpty={onEmpty}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Create a destination to get started/i }));
    expect(onEmpty).toHaveBeenCalledWith(data.query_metadata.filters_applied);
  });
});

// ---------------------------------------------------------------------------
// Skeleton mode (data === null) still renders skeletons — no regression
// ---------------------------------------------------------------------------
describe('skeleton mode', () => {
  it('renders skeleton cards when data is null', () => {
    render(
      <DiscoveryResultCard
        data={null}
        onView={noopView}
        onPlan={noopPlan}
        onEmpty={onEmpty}
      />
    );
    // aria-hidden skeleton cards are present, no buttons rendered
    expect(screen.queryByRole('button')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Fallback: data with no query_metadata key
// ---------------------------------------------------------------------------
describe('empty state — missing query_metadata fallback', () => {
  it('renders the generic empty state when query_metadata is absent', () => {
    const data = { results: [] };
    render(
      <DiscoveryResultCard
        data={data}
        onView={noopView}
        onPlan={noopPlan}
        onEmpty={onEmpty}
      />
    );
    expect(screen.getByText(/No matching experiences found/i)).toBeInTheDocument();
  });
});

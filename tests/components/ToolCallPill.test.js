/**
 * Tests for ToolCallPill component (T16)
 *
 * Mocks the @chakra-ui/react primitives to plain HTML to avoid
 * recipe/structuredClone errors in jsdom (the same workaround used by
 * BaseDropdown / BaseAccordion tests).
 *
 * Covers the three render states (pending, success, error) and verifies the
 * data-status attribute is wired correctly so consumers can target each state.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('@chakra-ui/react', () => {
  const ReactInner = require('react');
  // Drop Chakra-only style props so we don't trigger React DOM-attribute warnings
  // when our mock renders to plain HTML. We keep only attributes React tolerates
  // on DOM nodes plus any data-/aria- attributes we set explicitly.
  const KEEP = new Set(['children', 'className', 'role', 'tabIndex', 'onClick', 'onKeyDown']);
  const filterProps = (props) => {
    const out = {};
    for (const [k, v] of Object.entries(props)) {
      if (KEEP.has(k) || k.startsWith('data-') || k.startsWith('aria-')) out[k] = v;
    }
    return out;
  };
  const passthrough = (tag) => ({ children, ...props }) =>
    ReactInner.createElement(tag, filterProps(props), children);
  return {
    HStack: passthrough('div'),
    Text: passthrough('span'),
    Box: passthrough('div'),
    Spinner: (props) =>
      ReactInner.createElement('div', {
        'data-testid': 'spinner',
        role: 'status',
        ...filterProps(props),
      }),
  };
});

import ToolCallPill from '../../src/components/BienBotPanel/ToolCallPill';

describe('ToolCallPill', () => {
  it('renders the label in pending state with a spinner', () => {
    render(<ToolCallPill label="Fetching plan items…" status="pending" />);
    expect(screen.getByText('Fetching plan items…')).toBeInTheDocument();
    const pill = screen.getByText('Fetching plan items…').closest('[data-status]');
    expect(pill).toHaveAttribute('data-status', 'pending');
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('renders error variant when status=error', () => {
    render(<ToolCallPill label="Fetching plan items…" status="error" />);
    const pill = screen.getByText('Fetching plan items…').closest('[data-status]');
    expect(pill).toHaveAttribute('data-status', 'error');
    expect(screen.getByLabelText('failed')).toBeInTheDocument();
    expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
  });

  it('renders success variant when status=success', () => {
    render(<ToolCallPill label="Fetching plan items…" status="success" />);
    const pill = screen.getByText('Fetching plan items…').closest('[data-status]');
    expect(pill).toHaveAttribute('data-status', 'success');
    expect(screen.getByLabelText('done')).toBeInTheDocument();
    expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
  });

  it('defaults to pending status when status prop is omitted', () => {
    render(<ToolCallPill label="Loading…" />);
    const pill = screen.getByText('Loading…').closest('[data-status]');
    expect(pill).toHaveAttribute('data-status', 'pending');
  });
});

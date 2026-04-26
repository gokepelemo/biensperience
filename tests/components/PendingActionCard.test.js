/**
 * Tests for PendingActionCard tool_metadata wiring (T14).
 *
 * Verifies the registry-driven irreversible UX path:
 *   - tool_metadata.confirmDescription is interpolated against action.payload
 *   - tool_metadata.irreversible flips the confirm button to danger styling
 *     and sets data-irreversible="true" so consumers can target the state
 *
 * Mocks the design-system Button/Text exports to plain HTML so we don't have
 * to set up the full Chakra recipe + feature-flag context inside jsdom.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('../../src/components/design-system', () => {
  const ReactInner = require('react');
  const KEEP = new Set(['children', 'className', 'role', 'tabIndex', 'onClick', 'onKeyDown', 'disabled', 'type']);
  const filterProps = (props) => {
    const out = {};
    for (const [k, v] of Object.entries(props)) {
      if (KEEP.has(k) || k.startsWith('data-') || k.startsWith('aria-')) out[k] = v;
    }
    return out;
  };
  // Button: emit data-variant so tests can assert variant selection without
  // having to load Chakra recipes.
  const Button = ({ children, variant, size, ...rest }) =>
    ReactInner.createElement(
      'button',
      { 'data-variant': variant, 'data-size': size, ...filterProps(rest) },
      children
    );
  const Text = ({ children, ...rest }) =>
    ReactInner.createElement('span', filterProps(rest), children);
  return { Button, Text };
});

import PendingActionCard, { interpolateTemplate } from '../../src/components/BienBotPanel/PendingActionCard';

describe('interpolateTemplate', () => {
  it('substitutes payload values into {field} placeholders', () => {
    expect(interpolateTemplate('Send a "{alert_type}" to {channel}', {
      alert_type: 'departure_reminder',
      channel: 'team'
    })).toBe('Send a "departure_reminder" to team');
  });

  it('leaves unresolved placeholders as-is so missing fields are visible', () => {
    expect(interpolateTemplate('Send {missing_field} to {known}', { known: 'team' }))
      .toBe('Send {missing_field} to team');
  });

  it('returns the template unchanged if not a string or no payload', () => {
    expect(interpolateTemplate(null, { x: 1 })).toBe(null);
    expect(interpolateTemplate('Hello {name}', null)).toBe('Hello {name}');
  });

  it('coerces non-string payload values', () => {
    expect(interpolateTemplate('Days: {n}', { n: 5 })).toBe('Days: 5');
  });
});

describe('PendingActionCard tool_metadata', () => {
  const baseAction = {
    id: 'action_abc12345',
    type: 'send_trip_alert',
    description: 'LLM-authored fallback prose',
    payload: {
      alert_type: 'departure_reminder',
      trip_name: 'Tokyo',
      plan_id: 'p1'
    }
  };

  const noop = () => {};

  it('renders interpolated confirmDescription from tool_metadata', () => {
    const action = {
      ...baseAction,
      tool_metadata: {
        irreversible: true,
        confirmDescription: 'Send {alert_type} for {trip_name}'
      }
    };
    render(
      <PendingActionCard
        action={action}
        onExecute={noop}
        onUpdate={noop}
        onCancel={noop}
      />
    );
    expect(screen.getByText('Send departure_reminder for Tokyo')).toBeInTheDocument();
    // Manifest copy wins over LLM-authored description.
    expect(screen.queryByText('LLM-authored fallback prose')).not.toBeInTheDocument();
  });

  it('marks the confirm button as irreversible (danger variant + data attr)', () => {
    const action = {
      ...baseAction,
      tool_metadata: {
        irreversible: true,
        confirmDescription: 'Send {alert_type} for {trip_name}'
      }
    };
    render(
      <PendingActionCard
        action={action}
        onExecute={noop}
        onUpdate={noop}
        onCancel={noop}
      />
    );
    const irreversibleBtn = document.querySelector('[data-irreversible="true"]');
    expect(irreversibleBtn).not.toBeNull();
    expect(irreversibleBtn).toHaveAttribute('data-variant', 'danger');
  });

  it('does not apply irreversible styling when tool_metadata is absent', () => {
    render(
      <PendingActionCard
        action={baseAction}
        onExecute={noop}
        onUpdate={noop}
        onCancel={noop}
      />
    );
    expect(document.querySelector('[data-irreversible="true"]')).toBeNull();
  });
});

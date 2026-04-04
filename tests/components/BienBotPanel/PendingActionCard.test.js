import React from 'react';
import { render, screen } from '@testing-library/react';

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

// ─── Mock CSS module ──────────────────────────────────────────────────────────
jest.mock('../../../src/components/BienBotPanel/BienBotPanel.module.css', () => ({}));

import PendingActionCard from '../../../src/components/BienBotPanel/PendingActionCard';

const noop = jest.fn();

beforeEach(() => jest.clearAllMocks());

function buildAction(type, payload = {}) {
  return { id: 'action_test01', type, payload, description: `${type} action` };
}

// ─── shift_plan_item_dates ────────────────────────────────────────────────────

describe('shift_plan_item_dates action type', () => {
  it('renders with confirm_label "Shift Dates"', () => {
    render(
      <PendingActionCard
        action={buildAction('shift_plan_item_dates', { plan_id: 'plan_abc', diff_days: 3 })}
        onExecute={noop}
        onUpdate={noop}
        onCancel={noop}
      />
    );
    expect(screen.getByRole('button', { name: /Shift Dates/i })).toBeInTheDocument();
  });

  it('renders with dismiss_label "Keep Current"', () => {
    render(
      <PendingActionCard
        action={buildAction('shift_plan_item_dates', { plan_id: 'plan_abc', diff_days: 3 })}
        onExecute={noop}
        onUpdate={noop}
        onCancel={noop}
      />
    );
    expect(screen.getByRole('button', { name: /Keep Current/i })).toBeInTheDocument();
  });

  it('card_intent is confirmation — renders Cancel button', () => {
    render(
      <PendingActionCard
        action={buildAction('shift_plan_item_dates', { plan_id: 'plan_abc', diff_days: 3 })}
        onExecute={noop}
        onUpdate={noop}
        onCancel={noop}
      />
    );
    // confirmation intent always renders a Cancel button
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
  });
});

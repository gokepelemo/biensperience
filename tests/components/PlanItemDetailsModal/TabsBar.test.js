/**
 * Tests for TabsBar — extracted from PlanItemDetailsModal as part of bd 4590.
 *
 * Covers:
 * - desktop tab buttons render in order with the right a11y wiring
 *   (role=tab, aria-selected reflects activeTab, aria-controls=tabpanel-<key>)
 * - clicking a tab fires onChange with the right key
 * - badge counts render when totalDetailsCount > 0 and notesCount > 0
 * - location badge ✓ renders when hasLocation=true
 *
 * Mocks: design-system Dropdown stub + the CSS module.
 */

import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';

jest.mock('../../../src/components/PlanItemDetailsModal/PlanItemDetailsModal.module.css', () => new Proxy({}, {
  get: (_, key) => key,
}), { virtual: true });

jest.mock('../../../src/components/design-system', () => {
  const ReactLib = require('react');
  const Dropdown = ({ children, onSelect }) => (
    <div data-testid="dropdown">
      {ReactLib.Children.map(children, (child) =>
        ReactLib.isValidElement(child) ? ReactLib.cloneElement(child, { onSelect }) : child
      )}
    </div>
  );
  Dropdown.Toggle = ({ children }) => <button data-testid="dropdown-toggle">{children}</button>;
  Dropdown.Menu = ({ children, onSelect }) => (
    <div data-testid="dropdown-menu">
      {ReactLib.Children.map(children, (child) =>
        ReactLib.isValidElement(child) ? ReactLib.cloneElement(child, { onSelect }) : child
      )}
    </div>
  );
  Dropdown.Item = ({ eventKey, children, onSelect }) => (
    <button data-testid={`dropdown-item-${eventKey}`} onClick={() => onSelect && onSelect(eventKey)}>
      {children}
    </button>
  );
  return { Dropdown };
});

import TabsBar from '../../../src/components/PlanItemDetailsModal/TabsBar';

function renderBar(overrides = {}) {
  const props = {
    activeTab: 'notes',
    onChange: jest.fn(),
    totalDetailsCount: 0,
    notesCount: 0,
    hasLocation: false,
    ...overrides,
  };
  return { props, ...render(<TabsBar {...props} />) };
}

describe('TabsBar', () => {
  it('renders all six tabs with role=tab and the correct a11y wiring', () => {
    renderBar();
    const tablist = screen.getByRole('tablist', { name: /plan item details/i });
    const tabs = within(tablist).getAllByRole('tab');
    expect(tabs).toHaveLength(6);
    tabs.forEach((tab) => {
      const id = tab.getAttribute('id');
      expect(id).toMatch(/^tab-/);
      expect(tab).toHaveAttribute('aria-controls', `tabpanel-${id.replace('tab-', '')}`);
    });
  });

  it('marks the active tab with aria-selected=true', () => {
    renderBar({ activeTab: 'photos' });
    const tablist = screen.getByRole('tablist');
    const photosTab = within(tablist).getByRole('tab', { name: /photos/i });
    expect(photosTab).toHaveAttribute('aria-selected', 'true');
    const notesTab = within(tablist).getByRole('tab', { name: /notes/i });
    expect(notesTab).toHaveAttribute('aria-selected', 'false');
  });

  it('clicking a desktop tab calls onChange with the right key', () => {
    const { props } = renderBar();
    const tablist = screen.getByRole('tablist');
    fireEvent.click(within(tablist).getByRole('tab', { name: /chat/i }));
    expect(props.onChange).toHaveBeenCalledWith('chat');
  });

  it('renders badges for details and notes counts', () => {
    renderBar({ totalDetailsCount: 3, notesCount: 5 });
    const tablist = screen.getByRole('tablist');
    expect(within(tablist).getByRole('tab', { name: /details \(3\)/i })).toBeInTheDocument();
    expect(within(tablist).getByRole('tab', { name: /notes \(5\)/i })).toBeInTheDocument();
  });

  it('renders the ✓ location badge when hasLocation=true', () => {
    renderBar({ hasLocation: true });
    const tablist = screen.getByRole('tablist');
    expect(within(tablist).getByRole('tab', { name: /location ✓/i })).toBeInTheDocument();
  });

  it('clicking a mobile dropdown item calls onChange with the right key', () => {
    const { props } = renderBar();
    fireEvent.click(screen.getByTestId('dropdown-item-documents'));
    expect(props.onChange).toHaveBeenCalledWith('documents');
  });
});

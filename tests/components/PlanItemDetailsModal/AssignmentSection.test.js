/**
 * Tests for AssignmentSection — extracted from PlanItemDetailsModal as part of bd 4590.
 *
 * The high-risk surface is the a11y wiring on the autocomplete combobox
 * (commit d7eebfc2). These tests assert the contract survives extraction:
 * - role="combobox" + aria-controls + aria-activedescendant + aria-autocomplete on the input
 * - role="listbox" with matching id on the dropdown
 * - role="option" with stable indexed ids that aria-activedescendant points at
 *
 * Also covers the read-only path (canEdit=false), the unassign + select-collaborator
 * paths, and the completion toggle.
 *
 * Mocks: Button (avoid Chakra entanglement), sanitize, the CSS module.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

jest.mock('../../../src/components/PlanItemDetailsModal/PlanItemDetailsModal.module.css', () => new Proxy({}, {
  get: (_, key) => key,
}), { virtual: true });

jest.mock('../../../src/components/Button/Button', () => ({
  __esModule: true,
  default: ({ as: As = 'button', children, onClick, disabled, leftIcon, rightIcon, ...rest }) => (
    <As onClick={onClick} disabled={As === 'button' ? disabled : undefined} {...rest}>{children}</As>
  ),
}));

jest.mock('../../../src/utilities/sanitize', () => ({
  sanitizeUrl: (url) => url,
}));

import AssignmentSection from '../../../src/components/PlanItemDetailsModal/AssignmentSection';

const ALICE = { _id: 'u-1', name: 'Alice' };
const BOB = { _id: 'u-2', name: 'Bob' };

function renderSection(overrides = {}) {
  const props = {
    planItem: { _id: 'item-1', text: 'Visit', complete: false, assignedTo: null },
    canEdit: true,
    collaborators: [ALICE, BOB],
    onAssign: jest.fn(),
    onUnassign: jest.fn(),
    onToggleComplete: jest.fn(),
    ...overrides,
  };
  return { props, ...render(<AssignmentSection {...props} />) };
}

describe('AssignmentSection', () => {
  it('renders read-only assignee name when canEdit=false', () => {
    renderSection({
      canEdit: false,
      planItem: { _id: 'item-1', text: 'Visit', assignedTo: ALICE },
    });
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('renders "Unassigned" when no assignee', () => {
    renderSection();
    expect(screen.getByRole('button', { name: /unassigned/i })).toBeInTheDocument();
  });

  it('opens the autocomplete combobox on click and exposes the full a11y contract', () => {
    renderSection();
    fireEvent.click(screen.getByRole('button', { name: /unassigned/i }));

    const input = screen.getByRole('combobox');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(input).toHaveAttribute('aria-autocomplete', 'list');

    const listboxId = input.getAttribute('aria-controls');
    expect(listboxId).toBeTruthy();

    const listbox = document.getElementById(listboxId);
    expect(listbox).not.toBeNull();
    expect(listbox).toHaveAttribute('role', 'listbox');

    // aria-activedescendant must point at an existing option id
    const activeId = input.getAttribute('aria-activedescendant');
    expect(activeId).toMatch(new RegExp(`^${listboxId}-opt-\\d+$`));
    expect(document.getElementById(activeId)).not.toBeNull();
  });

  it('arrow-down moves the highlighted option (aria-activedescendant updates)', () => {
    renderSection();
    fireEvent.click(screen.getByRole('button', { name: /unassigned/i }));
    const input = screen.getByRole('combobox');
    const initial = input.getAttribute('aria-activedescendant');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.getAttribute('aria-activedescendant')).not.toBe(initial);
  });

  it('clicking a collaborator option calls onAssign with the user id', () => {
    const { props } = renderSection();
    fireEvent.click(screen.getByRole('button', { name: /unassigned/i }));
    fireEvent.mouseDown(screen.getByText('Alice'));
    expect(props.onAssign).toHaveBeenCalledWith('u-1');
  });

  it('clicking the unassign sentinel option calls onUnassign', () => {
    const { props } = renderSection({
      planItem: { _id: 'item-1', text: 'Visit', assignedTo: ALICE },
    });
    fireEvent.click(screen.getByRole('button', { name: /alice/i }));
    fireEvent.mouseDown(screen.getByText(/-- Unassigned --/));
    expect(props.onUnassign).toHaveBeenCalled();
  });

  it('renders the completion toggle and fires onToggleComplete', () => {
    const { props } = renderSection();
    const toggle = screen.getByRole('button', { name: /mark.*complete/i, pressed: false });
    fireEvent.click(toggle);
    expect(props.onToggleComplete).toHaveBeenCalledWith(props.planItem);
  });

  it('renders the external link button when planItem.url is set', () => {
    renderSection({
      planItem: { _id: 'item-1', text: 'Visit', complete: false, url: 'https://example.com' },
    });
    expect(screen.getByText('View Link').closest('a')).toHaveAttribute('href', 'https://example.com');
  });

  it('omits the external link button when planItem.url is missing', () => {
    renderSection();
    expect(screen.queryByText('View Link')).not.toBeInTheDocument();
  });
});

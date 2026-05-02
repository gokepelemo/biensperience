/**
 * Tests for EditableTitle — extracted from PlanItemDetailsModal as part of bd 4590.
 *
 * Covers the three rendering modes:
 * - plain text fallback when canEdit=false or onUpdateTitle missing
 * - clickable role="button" span when editable + not currently editing
 * - <input> with aria-label when editing
 *
 * Also confirms the click handler enters edit mode and that Enter on the
 * span activates click (the keyboard-equivalent for non-button elements).
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

jest.mock('../../../src/components/PlanItemDetailsModal/PlanItemDetailsModal.module.css', () => new Proxy({}, {
  get: (_, key) => key,
}), { virtual: true });

import EditableTitle from '../../../src/components/PlanItemDetailsModal/EditableTitle';

const basePlanItem = { _id: 'item-1', text: 'Visit the Louvre' };

describe('EditableTitle', () => {
  it('renders the title as plain text when canEdit is false', () => {
    const { container } = render(
      <EditableTitle planItem={basePlanItem} canEdit={false} onUpdateTitle={jest.fn()} />
    );
    expect(container.textContent).toBe('Visit the Louvre');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders the title as plain text when onUpdateTitle is missing', () => {
    const { container } = render(
      <EditableTitle planItem={basePlanItem} canEdit={true} onUpdateTitle={undefined} />
    );
    expect(container.textContent).toBe('Visit the Louvre');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders a clickable role="button" span when canEdit and onUpdateTitle are provided', () => {
    render(<EditableTitle planItem={basePlanItem} canEdit={true} onUpdateTitle={jest.fn()} />);
    const trigger = screen.getByRole('button', { name: /Visit the Louvre/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger.tagName).toBe('SPAN');
    expect(trigger).toHaveAttribute('tabIndex', '0');
    expect(trigger).toHaveAttribute('title', 'Click to edit title');
  });

  it('switches to an input with the editing aria-label on click', () => {
    render(<EditableTitle planItem={basePlanItem} canEdit={true} onUpdateTitle={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Visit the Louvre/i }));
    const input = screen.getByLabelText('Update plan item title');
    expect(input.tagName).toBe('INPUT');
    expect(input).toHaveValue('Visit the Louvre');
  });

  it('switches to an input when Enter is pressed on the span (keyboard activation)', () => {
    render(<EditableTitle planItem={basePlanItem} canEdit={true} onUpdateTitle={jest.fn()} />);
    fireEvent.keyDown(screen.getByRole('button', { name: /Visit the Louvre/i }), { key: 'Enter' });
    expect(screen.getByLabelText('Update plan item title')).toBeInTheDocument();
  });

  it('falls back to "Plan Item" when planItem.text is missing', () => {
    const { container } = render(
      <EditableTitle planItem={{ _id: 'item-2' }} canEdit={false} onUpdateTitle={jest.fn()} />
    );
    expect(container.textContent).toBe('Plan Item');
  });
});

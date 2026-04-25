/**
 * Tests for PlanSelector component
 *
 * Tests cover:
 * - Auto-executes a single-action selector exactly once across re-renders
 * - Does not auto-execute when there are multiple actions
 * - Renders group UI when actions.length > 1
 * - Confirm and Cancel buttons work correctly
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// CSS modules are handled by identity-obj-proxy in Jest config
import PlanSelector from '../../src/components/BienBotPanel/PlanSelector';

const makeSingleAction = () => ({
  _id: 'a1',
  type: 'select_plan',
  payload: { plan_id: 'p1', experience_name: 'Tokyo', destination_name: 'Japan' },
});

const makeAction = (id, name, dest = 'Japan') => ({
  _id: id,
  type: 'select_plan',
  payload: { plan_id: id, experience_name: name, destination_name: dest },
});

describe('PlanSelector', () => {
  it('auto-executes a single-action selector exactly once across re-renders', () => {
    const onExecute = jest.fn();
    const action = makeSingleAction();

    const { rerender } = render(
      <PlanSelector actions={[action]} onExecute={onExecute} onCancel={jest.fn()} disabled={false} />
    );
    rerender(<PlanSelector actions={[action]} onExecute={onExecute} onCancel={jest.fn()} disabled={true} />);
    rerender(<PlanSelector actions={[action]} onExecute={onExecute} onCancel={jest.fn()} disabled={false} />);

    expect(onExecute).toHaveBeenCalledTimes(1);
  });

  it('does not auto-execute when there are multiple actions', () => {
    const onExecute = jest.fn();
    const actions = [makeAction('a1', 'Tokyo'), makeAction('a2', 'Kyoto')];

    render(
      <PlanSelector actions={actions} onExecute={onExecute} onCancel={jest.fn()} disabled={false} />
    );

    expect(onExecute).not.toHaveBeenCalled();
  });

  it('renders the selector UI for multiple actions', () => {
    const actions = [makeAction('a1', 'Tokyo'), makeAction('a2', 'Kyoto')];

    render(
      <PlanSelector actions={actions} onExecute={jest.fn()} onCancel={jest.fn()} disabled={false} />
    );

    expect(screen.getByText('Tokyo')).toBeInTheDocument();
    expect(screen.getByText('Kyoto')).toBeInTheDocument();
    expect(screen.getByText('Confirm')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('calls onExecute with the selected action id on Confirm', () => {
    const onExecute = jest.fn();
    const actions = [makeAction('a1', 'Tokyo'), makeAction('a2', 'Kyoto')];

    render(
      <PlanSelector actions={actions} onExecute={onExecute} onCancel={jest.fn()} disabled={false} />
    );

    fireEvent.click(screen.getByText('Tokyo'));
    fireEvent.click(screen.getByText('Confirm'));

    expect(onExecute).toHaveBeenCalledWith('a1');
  });

  it('calls onCancel for all actions when Cancel is clicked', () => {
    const onCancel = jest.fn();
    const actions = [makeAction('a1', 'Tokyo'), makeAction('a2', 'Kyoto')];

    render(
      <PlanSelector actions={actions} onExecute={jest.fn()} onCancel={onCancel} disabled={false} />
    );

    fireEvent.click(screen.getByText('Cancel'));

    expect(onCancel).toHaveBeenCalledWith('a1');
    expect(onCancel).toHaveBeenCalledWith('a2');
  });
});

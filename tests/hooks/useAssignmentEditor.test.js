/**
 * Tests for useAssignmentEditor — the assignment-dropdown state machine.
 *
 * Covers the surface that the modal relies on: filtering via the trie,
 * keyboard navigation through the dropdown, click-handler gating on canEdit,
 * and the assign/unassign callbacks.
 *
 * The DOM positioning effect (requestAnimationFrame + getBoundingClientRect)
 * is exercised indirectly when isEditingAssignment toggles to true; we don't
 * assert on the position values because jsdom returns zero rects.
 */

import { renderHook, act } from '@testing-library/react';
import useAssignmentEditor from '../../src/hooks/useAssignmentEditor';

const collaborators = [
  { _id: 'u1', user: { _id: 'u1', name: 'Alice Anderson' } },
  { _id: 'u2', user: { _id: 'u2', name: 'Bob Brown' } },
  { _id: 'u3', user: { _id: 'u3', name: 'Carol Carter' } },
];

function setup(overrides = {}) {
  const props = {
    collaborators,
    canEdit: true,
    onAssign: jest.fn().mockResolvedValue(undefined),
    onUnassign: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  const hook = renderHook(() => useAssignmentEditor(props));
  return { props, ...hook };
}

describe('useAssignmentEditor', () => {
  it('starts collapsed with the full collaborator list and zero highlighted index', () => {
    const { result } = setup();
    expect(result.current.isEditingAssignment).toBe(false);
    expect(result.current.filteredCollaborators).toHaveLength(3);
    expect(result.current.highlightedIndex).toBe(0);
  });

  it('handleAssignmentClick opens the dropdown when canEdit is true', () => {
    const { result } = setup();
    act(() => result.current.handleAssignmentClick());
    expect(result.current.isEditingAssignment).toBe(true);
    expect(result.current.assignmentSearch).toBe('');
  });

  it('handleAssignmentClick is a no-op when canEdit is false', () => {
    const { result } = setup({ canEdit: false });
    act(() => result.current.handleAssignmentClick());
    expect(result.current.isEditingAssignment).toBe(false);
  });

  it('filters collaborators when assignmentSearch changes', () => {
    const { result } = setup();
    act(() => result.current.setAssignmentSearch('alice'));
    expect(result.current.filteredCollaborators.map((c) => c.name)).toEqual([
      'Alice Anderson',
    ]);
  });

  it('handleSelectCollaborator calls onAssign with the user id and resets state', async () => {
    const { result, props } = setup();
    act(() => result.current.handleAssignmentClick());
    await act(async () => {
      await result.current.handleSelectCollaborator(collaborators[1]);
    });
    expect(props.onAssign).toHaveBeenCalledWith('u2');
    expect(result.current.isEditingAssignment).toBe(false);
  });

  it('handleUnassign calls onUnassign and resets state', async () => {
    const { result, props } = setup();
    act(() => result.current.handleAssignmentClick());
    await act(async () => {
      await result.current.handleUnassign();
    });
    expect(props.onUnassign).toHaveBeenCalledTimes(1);
    expect(result.current.isEditingAssignment).toBe(false);
  });

  it('ArrowDown advances highlighted index up to filteredCollaborators.length', () => {
    const { result } = setup();
    const preventDefault = jest.fn();
    act(() => result.current.handleAssignmentKeyDown({ key: 'ArrowDown', preventDefault }));
    expect(result.current.highlightedIndex).toBe(1);
    act(() => result.current.handleAssignmentKeyDown({ key: 'ArrowDown', preventDefault }));
    act(() => result.current.handleAssignmentKeyDown({ key: 'ArrowDown', preventDefault }));
    act(() => result.current.handleAssignmentKeyDown({ key: 'ArrowDown', preventDefault }));
    expect(result.current.highlightedIndex).toBe(3);
  });

  it('ArrowUp decrements highlighted index but not below zero', () => {
    const { result } = setup();
    const preventDefault = jest.fn();
    act(() => result.current.setHighlightedIndex(2));
    act(() => result.current.handleAssignmentKeyDown({ key: 'ArrowUp', preventDefault }));
    expect(result.current.highlightedIndex).toBe(1);
    act(() => result.current.handleAssignmentKeyDown({ key: 'ArrowUp', preventDefault }));
    act(() => result.current.handleAssignmentKeyDown({ key: 'ArrowUp', preventDefault }));
    expect(result.current.highlightedIndex).toBe(0);
  });

  it('Enter on highlighted index 0 triggers unassign', async () => {
    const { result, props } = setup();
    const preventDefault = jest.fn();
    act(() => result.current.handleAssignmentClick());
    await act(async () => {
      result.current.handleAssignmentKeyDown({ key: 'Enter', preventDefault });
    });
    expect(props.onUnassign).toHaveBeenCalled();
  });

  it('Enter on highlighted index N selects collaborator at index N-1', async () => {
    const { result, props } = setup();
    const preventDefault = jest.fn();
    act(() => result.current.handleAssignmentClick());
    act(() => result.current.setHighlightedIndex(2));
    await act(async () => {
      result.current.handleAssignmentKeyDown({ key: 'Enter', preventDefault });
    });
    expect(props.onAssign).toHaveBeenCalledWith('u2');
  });

  it('Tab traps focus within the dropdown by advancing highlight (forward and shift+back)', () => {
    const { result } = setup();
    const preventDefault = jest.fn();
    act(() => result.current.handleAssignmentClick());
    act(() => result.current.handleAssignmentKeyDown({ key: 'Tab', shiftKey: false, preventDefault }));
    expect(result.current.highlightedIndex).toBe(1);
    act(() => result.current.handleAssignmentKeyDown({ key: 'Tab', shiftKey: false, preventDefault }));
    expect(result.current.highlightedIndex).toBe(2);
    act(() => result.current.handleAssignmentKeyDown({ key: 'Tab', shiftKey: true, preventDefault }));
    expect(result.current.highlightedIndex).toBe(1);
    expect(preventDefault).toHaveBeenCalledTimes(3);
  });

  it('Escape closes the dropdown and clears the search', () => {
    const { result } = setup();
    const preventDefault = jest.fn();
    act(() => result.current.handleAssignmentClick());
    act(() => result.current.setAssignmentSearch('al'));
    act(() => result.current.handleAssignmentKeyDown({ key: 'Escape', preventDefault }));
    expect(result.current.isEditingAssignment).toBe(false);
    expect(result.current.assignmentSearch).toBe('');
  });
});

import React, { useRef } from 'react';
import { render, fireEvent } from '@testing-library/react';
import { useFocusTrap } from '../../src/hooks/useFocusTrap';

function TestPanel({ active }) {
  const ref = useRef(null);
  useFocusTrap(ref, active);
  return (
    <div ref={ref}>
      <button>First</button>
      <button>Middle</button>
      <button>Last</button>
    </div>
  );
}

describe('useFocusTrap', () => {
  it('cycles Tab from last focusable to first when active', () => {
    const { getByText } = render(<TestPanel active={true} />);
    const first = getByText('First');
    const last = getByText('Last');
    last.focus();
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
  });

  it('cycles Shift+Tab from first focusable to last when active', () => {
    const { getByText } = render(<TestPanel active={true} />);
    const first = getByText('First');
    const last = getByText('Last');
    first.focus();
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('does nothing when inactive', () => {
    const { getByText } = render(<TestPanel active={false} />);
    const last = getByText('Last');
    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(document.activeElement).toBe(last);
  });
});

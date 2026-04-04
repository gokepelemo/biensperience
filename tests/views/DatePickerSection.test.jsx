import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// ─── Mock @chakra-ui/react to avoid ChakraProvider requirement ───────────────
jest.mock('@chakra-ui/react', () => {
  const React = require('react');
  return {
    Flex: ({ children, ...props }) => React.createElement('div', props, children),
    Text: ({ children, ...props }) => React.createElement('p', props, children),
    parseDate: jest.fn((s) => s),
    DatePicker: {
      Root: ({ children, ...props }) => React.createElement('div', { 'data-testid': 'date-picker-input', ...props }, children),
      Label: ({ children }) => React.createElement('label', null, children),
      Content: ({ children }) => React.createElement('div', null, children),
      View: ({ children }) => React.createElement('div', null, children),
      Header: () => React.createElement('div', null),
      DayTable: () => React.createElement('div', null),
      MonthTable: () => React.createElement('div', null),
      YearTable: () => React.createElement('div', null),
    },
  };
});

// ─── Mock design-system Modal and Alert ──────────────────────────────────────
jest.mock('../../src/components/design-system', () => {
  const React = require('react');
  return {
    Modal: ({ children, footer, show, onClose }) =>
      show !== false
        ? React.createElement(
            'div',
            { 'data-testid': 'modal' },
            React.createElement('button', { 'aria-label': 'close', onClick: onClose }, 'Close'),
            children,
            footer
          )
        : null,
    Alert: ({ message, type }) =>
      React.createElement('div', { 'data-testid': `alert-${type}`, role: 'alert' }, message),
    Button: ({ children, onClick, variant, ...props }) =>
      React.createElement('button', { onClick, 'data-variant': variant, ...props }, children),
  };
});

// ─── Mock utilities ───────────────────────────────────────────────────────────
jest.mock('../../src/utilities/date-utils', () => ({
  getMinimumPlanningDate: jest.fn(() => null),
  isValidPlannedDate: jest.fn(() => true),
}));

jest.mock('../../src/utilities/planning-time-utils', () => ({
  formatPlanningTime: jest.fn(() => null),
}));

import DatePickerSection from '../../src/views/SingleExperience/components/DatePickerSection';

// Minimal props to render DatePickerSection in the normal (non-shift) state
const baseProps = {
  plannedDate: '',
  setPlannedDate: jest.fn(),
  handleDateUpdate: jest.fn(),
  isEditingDate: false,
  closeModal: jest.fn(),
};

describe('DatePickerSection — shift confirmation banner', () => {
  const pendingShift = {
    planId: 'plan123',
    count: 3,
    diffDays: 5,
    diffMs: 5 * 24 * 60 * 60 * 1000,
    oldDate: '2026-04-01T00:00:00.000Z',
    newDate: '2026-04-06T00:00:00.000Z',
  };

  it('shows the shift confirmation banner when pendingShift is set', () => {
    render(
      <DatePickerSection
        {...baseProps}
        pendingShift={pendingShift}
        onShiftDates={jest.fn()}
        onKeepDates={jest.fn()}
      />
    );
    expect(screen.getByText(/shift them all by/i)).toBeInTheDocument();
    expect(screen.getByText(/3 plan item/i)).toBeInTheDocument();
  });

  it('hides the date picker when pendingShift is set', () => {
    const { queryByTestId } = render(
      <DatePickerSection
        {...baseProps}
        pendingShift={pendingShift}
        onShiftDates={jest.fn()}
        onKeepDates={jest.fn()}
      />
    );
    // The calendar/datepicker should not be in the DOM
    expect(queryByTestId('date-picker-input')).not.toBeInTheDocument();
  });

  it('calls onShiftDates when Shift Dates button is clicked', () => {
    const onShiftDates = jest.fn();
    render(
      <DatePickerSection
        {...baseProps}
        pendingShift={pendingShift}
        onShiftDates={onShiftDates}
        onKeepDates={jest.fn()}
      />
    );
    fireEvent.click(screen.getByText(/shift dates/i));
    expect(onShiftDates).toHaveBeenCalledTimes(1);
  });

  it('calls onKeepDates when Keep Current Dates button is clicked', () => {
    const onKeepDates = jest.fn();
    render(
      <DatePickerSection
        {...baseProps}
        pendingShift={pendingShift}
        onShiftDates={jest.fn()}
        onKeepDates={onKeepDates}
      />
    );
    fireEvent.click(screen.getByText(/keep current dates/i));
    expect(onKeepDates).toHaveBeenCalledTimes(1);
  });

  it('does not show the banner when pendingShift is null', () => {
    render(<DatePickerSection {...baseProps} />);
    expect(screen.queryByText(/shift them all by/i)).not.toBeInTheDocument();
  });

  it('shows +N days label when diffDays is positive', () => {
    render(
      <DatePickerSection
        {...baseProps}
        pendingShift={pendingShift}
        onShiftDates={jest.fn()}
        onKeepDates={jest.fn()}
      />
    );
    expect(screen.getByText(/\+5/)).toBeInTheDocument();
  });

  it('shows negative days label when diffDays is negative', () => {
    const negShift = { ...pendingShift, diffDays: -3, diffMs: -3 * 24 * 60 * 60 * 1000 };
    render(
      <DatePickerSection
        {...baseProps}
        pendingShift={negShift}
        onShiftDates={jest.fn()}
        onKeepDates={jest.fn()}
      />
    );
    expect(screen.getByText(/-3/)).toBeInTheDocument();
  });

  it('calls onKeepDates when modal is closed while pendingShift is set', () => {
    const onKeepDates = jest.fn();
    render(
      <DatePickerSection
        {...baseProps}
        pendingShift={pendingShift}
        onShiftDates={jest.fn()}
        onKeepDates={onKeepDates}
      />
    );
    const closeBtn = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeBtn);
    expect(onKeepDates).toHaveBeenCalledTimes(1);
  });
});

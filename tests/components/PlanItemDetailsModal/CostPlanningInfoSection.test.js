/**
 * Tests for CostPlanningInfoSection — extracted from PlanItemDetailsModal as part of bd 4590.
 *
 * The behavior with state to verify is the Add dropdown:
 * - opens on toggle click
 * - filter input narrows the option list
 * - selecting an item calls onSelectDetailType with the right type AND closes the dropdown
 *
 * Plus the conditional rendering surface:
 * - returns null when no info is present
 * - scheduled date card is interactive (calls onEditDate)
 * - share / bienbot buttons render when their gates pass
 *
 * Mocks: design-system Tooltip + Button (avoid Chakra), the info-card
 * formatters (return predictable strings), DETAIL_TYPE_CONFIG (so the
 * dropdown option list is deterministic).
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';

jest.mock('../../../src/components/PlanItemDetailsModal/PlanItemDetailsModal.module.css', () => new Proxy({}, {
  get: (_, key) => key,
}), { virtual: true });

jest.mock('../../../src/components/design-system', () => ({
  Tooltip: ({ children }) => children,
}));

jest.mock('../../../src/components/Button/Button', () => ({
  __esModule: true,
  default: ({ as: As = 'button', children, onClick, leftIcon, rightIcon, ...rest }) => (
    <As onClick={onClick} {...rest}>{children}</As>
  ),
}));

jest.mock('../../../src/components/AddPlanItemDetailModal', () => ({
  DETAIL_TYPE_CONFIG: {
    cost: { label: 'Cost', icon: '💰', description: 'Track an expense' },
    flight: { label: 'Flight', icon: '✈️', description: 'Reservation details' },
    hotel: { label: 'Hotel', icon: '🏨', description: 'Lodging' },
  },
}));

jest.mock('../../../src/utilities/planning-time-utils', () => ({
  formatPlanningTime: (d) => `${d}d`,
  getPlanningTimeTooltip: () => 'planning tip',
}));

jest.mock('../../../src/utilities/cost-utils', () => ({
  formatCostEstimate: (n) => `$${n}`,
  formatActualCost: (n) => `$${n}`,
  getCostEstimateTooltip: () => 'estimate tip',
  getTrackedCostTooltip: () => 'tracked tip',
}));

jest.mock('../../../src/utilities/time-utils', () => ({
  displayInTimezone: () => 'Mon Jan 15',
}));

import CostPlanningInfoSection from '../../../src/components/PlanItemDetailsModal/CostPlanningInfoSection';

function renderSection(overrides = {}) {
  const props = {
    planItem: { _id: 'item-1', text: 'Visit' },
    currentUser: { _id: 'u-1' },
    scheduledDate: null,
    scheduledTime: null,
    planningDays: 0,
    costEstimate: 0,
    currency: 'USD',
    actualCosts: [],
    totalActualCost: 0,
    canEdit: true,
    onShare: jest.fn(),
    onAddCostForItem: jest.fn(),
    onAddDetail: jest.fn(),
    onEditDate: jest.fn(),
    onSelectDetailType: jest.fn(),
    hasBienBot: false,
    bienbotLabel: 'Discuss',
    onBienBot: jest.fn(),
    ...overrides,
  };
  return { props, ...render(<CostPlanningInfoSection {...props} />) };
}

describe('CostPlanningInfoSection', () => {
  it('returns null when there is nothing to display and no add/share/bienbot buttons', () => {
    const { container } = renderSection({
      canEdit: false,
      onShare: undefined,
      onAddCostForItem: undefined,
      onAddDetail: undefined,
      hasBienBot: false,
    });
    expect(container.firstChild).toBeNull();
  });

  it('renders the scheduled date card and calls onEditDate when clicked', () => {
    const { props } = renderSection({ scheduledDate: '2026-01-15', scheduledTime: '14:30' });
    expect(screen.getByText('Mon Jan 15')).toBeInTheDocument();
    expect(screen.getByText(/at 2:30 PM/)).toBeInTheDocument();
    fireEvent.click(screen.getByTitle(/click to edit scheduled date/i));
    expect(props.onEditDate).toHaveBeenCalled();
  });

  it('renders planning days and cost estimate when present', () => {
    renderSection({ planningDays: 3, costEstimate: 250 });
    expect(screen.getByText('3d')).toBeInTheDocument();
    expect(screen.getByText('$250')).toBeInTheDocument();
  });

  it('renders tracked costs when actualCosts is non-empty', () => {
    renderSection({ actualCosts: [{ _id: 'c1' }, { _id: 'c2' }], totalActualCost: 500 });
    expect(screen.getByText('$500')).toBeInTheDocument();
  });

  it('opens the Add dropdown on toggle click and shows all options', () => {
    renderSection({ planningDays: 1 });
    fireEvent.click(screen.getByRole('button', { name: /add/i, expanded: false }));
    expect(screen.getByLabelText(/filter detail types/i)).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /cost/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /flight/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /hotel/i })).toBeInTheDocument();
  });

  it('filter input narrows the option list', () => {
    renderSection({ planningDays: 1 });
    fireEvent.click(screen.getByRole('button', { name: /add/i, expanded: false }));
    fireEvent.change(screen.getByLabelText(/filter detail types/i), { target: { value: 'flig' } });
    expect(screen.getByRole('menuitem', { name: /flight/i })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /^hotel$/i })).not.toBeInTheDocument();
  });

  it('selecting a detail type calls onSelectDetailType and closes the dropdown', () => {
    const { props } = renderSection({ planningDays: 1 });
    fireEvent.click(screen.getByRole('button', { name: /add/i, expanded: false }));
    fireEvent.click(screen.getByRole('menuitem', { name: /flight/i }));
    expect(props.onSelectDetailType).toHaveBeenCalledWith('flight');
    expect(screen.queryByRole('menuitem', { name: /flight/i })).not.toBeInTheDocument();
  });

  it('renders share button and calls onShare(planItem)', () => {
    const { props } = renderSection({ planningDays: 1 });
    fireEvent.click(screen.getByRole('button', { name: /share/i }));
    expect(props.onShare).toHaveBeenCalledWith(props.planItem);
  });

  it('renders bienbot button when hasBienBot=true and calls onBienBot', () => {
    const { props } = renderSection({ planningDays: 1, hasBienBot: true, bienbotLabel: 'Discuss' });
    fireEvent.click(screen.getByRole('button', { name: 'Discuss' }));
    expect(props.onBienBot).toHaveBeenCalled();
  });

  it('omits the action stack when no add/share/bienbot affordances apply', () => {
    renderSection({
      planningDays: 1,
      canEdit: false,
      onShare: undefined,
      onAddCostForItem: undefined,
      onAddDetail: undefined,
      hasBienBot: false,
    });
    expect(screen.queryByRole('button', { name: /add/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /share/i })).not.toBeInTheDocument();
  });
});

/**
 * Tests for exportPlanItemDetailsPDF — the print-window-driven PDF export.
 *
 * The function builds a printable DOM tree from groupedDetails and either
 * opens a print window (success path) or returns popupBlocked=true.
 */

jest.mock('../../src/components/PlanItemDetailsModal/getDetailDisplayFields', () => ({
  __esModule: true,
  default: () => [{ label: 'Vendor', value: 'United' }],
}));

jest.mock('../../src/utilities/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

import exportPlanItemDetailsPDF from '../../src/utilities/exportPlanItemDetailsPDF';

const baseArgs = {
  planItem: { text: 'Flight to JFK' },
  experienceName: 'NYC Trip',
  groupedDetails: {
    transportation: {
      icon: '✈️',
      label: 'Transport',
      items: [
        {
          typeConfig: { icon: '✈️', label: 'Flight' },
          _displayTitle: 'UA101',
          vendor: 'United',
        },
      ],
    },
  },
  collaborators: [],
};

describe('exportPlanItemDetailsPDF', () => {
  let originalOpen;

  beforeEach(() => {
    originalOpen = window.open;
  });

  afterEach(() => {
    window.open = originalOpen;
  });

  it('returns popupBlocked: true when window.open is blocked', () => {
    window.open = jest.fn(() => null);
    const result = exportPlanItemDetailsPDF(baseArgs);
    expect(result.popupBlocked).toBe(true);
  });

  it('renders the title with experience name when provided', () => {
    const printDoc = {
      title: '',
      body: { appendChild: jest.fn() },
      close: jest.fn(),
    };
    const printWin = {
      document: printDoc,
      print: jest.fn(),
      close: jest.fn(),
    };
    window.open = jest.fn(() => printWin);

    const result = exportPlanItemDetailsPDF(baseArgs);

    expect(result.popupBlocked).toBe(false);
    expect(printDoc.title).toBe('NYC Trip - Flight to JFK');
    expect(printDoc.body.appendChild).toHaveBeenCalledTimes(1);
    expect(printWin.print).toHaveBeenCalled();
    expect(printWin.close).toHaveBeenCalled();
  });

  it('falls back to plan item text only when experienceName is missing', () => {
    const printDoc = {
      title: '',
      body: { appendChild: jest.fn() },
      close: jest.fn(),
    };
    window.open = jest.fn(() => ({
      document: printDoc,
      print: jest.fn(),
      close: jest.fn(),
    }));

    exportPlanItemDetailsPDF({ ...baseArgs, experienceName: '' });

    expect(printDoc.title).toBe('Flight to JFK');
  });

  it('uses "Plan Item" placeholder when planItem.text is empty', () => {
    const printDoc = {
      title: '',
      body: { appendChild: jest.fn() },
      close: jest.fn(),
    };
    window.open = jest.fn(() => ({
      document: printDoc,
      print: jest.fn(),
      close: jest.fn(),
    }));

    exportPlanItemDetailsPDF({ ...baseArgs, planItem: {}, experienceName: 'Trip' });

    expect(printDoc.title).toBe('Trip - Plan Item');
  });

  it('does not throw when groupedDetails is empty', () => {
    window.open = jest.fn(() => ({
      document: { title: '', body: { appendChild: jest.fn() }, close: jest.fn() },
      print: jest.fn(),
      close: jest.fn(),
    }));

    expect(() => exportPlanItemDetailsPDF({ ...baseArgs, groupedDetails: {} })).not.toThrow();
  });
});

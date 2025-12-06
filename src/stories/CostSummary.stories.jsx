/**
 * CostSummary Component Stories
 *
 * Demonstrates the CostSummary component for displaying cost breakdowns in a plan.
 * Shows various states including summary cards, expandable sections, and export functionality.
 */

import CostSummary from '../components/CostSummary/CostSummary';

export default {
  title: 'Components/Data Display/Cost Summary',
  component: CostSummary,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Displays a comprehensive cost breakdown with totals, per-person splits, category breakdown, and export functionality.',
      },
    },
  },
  argTypes: {
    summary: { control: 'object', description: 'Summary data from API' },
    costs: { control: 'object', description: 'Array of cost objects for manual calculation' },
    collaborators: { control: 'object', description: 'Array of collaborators for per-person split' },
    planItems: { control: 'object', description: 'Array of plan items for item breakdown' },
    showBreakdowns: { control: 'boolean', description: 'Show detailed breakdowns' },
    showCategoryBreakdown: { control: 'boolean', description: 'Show category breakdown' },
    showPerPersonSplit: { control: 'boolean', description: 'Show per-person split table' },
    showExport: { control: 'boolean', description: 'Show CSV export button' },
    compact: { control: 'boolean', description: 'Show compact view (total only)' },
    currency: { control: 'select', options: ['USD', 'EUR', 'GBP', 'JPY'], description: 'Currency code' },
    loading: { control: 'boolean', description: 'Show loading state' },
    onCostClick: { action: 'costClicked', description: 'Called when a cost item is clicked' },
    onExportCsv: { action: 'exportCsv', description: 'Called when export button is clicked' },
  },
};

// Sample data for stories
const sampleCollaborators = [
  { _id: 'user1', name: 'Alice Johnson', email: 'alice@example.com' },
  { _id: 'user2', name: 'Bob Smith', email: 'bob@example.com' },
  { _id: 'user3', name: 'Charlie Brown', email: 'charlie@example.com' },
];

const samplePlanItems = [
  { _id: 'item1', text: 'Book flights to Paris' },
  { _id: 'item2', text: 'Reserve hotel accommodation' },
  { _id: 'item3', text: 'Purchase museum tickets' },
  { _id: 'item4', text: 'Rent a car' },
];

const sampleCosts = [
  { _id: 'cost1', title: 'Flight tickets', cost: 850, currency: 'USD', category: 'transport', collaborator: 'user1', plan_item: 'item1', date: new Date().toISOString() },
  { _id: 'cost2', title: 'Hotel booking', cost: 1200, currency: 'USD', category: 'accommodation', collaborator: 'user2', plan_item: 'item2', date: new Date().toISOString() },
  { _id: 'cost3', title: 'Museum entrance', cost: 75, currency: 'USD', category: 'activities', plan_item: 'item3', date: new Date().toISOString() },
  { _id: 'cost4', title: 'Dinner reservation', cost: 180, currency: 'USD', category: 'food', date: new Date().toISOString() },
  { _id: 'cost5', title: 'Car rental', cost: 450, currency: 'USD', category: 'transport', collaborator: 'user3', plan_item: 'item4', date: new Date().toISOString() },
  { _id: 'cost6', title: 'Travel insurance', cost: 95, currency: 'USD', category: 'other', date: new Date().toISOString() },
];

// API-style summary object
const sampleApiSummary = {
  planId: 'plan123',
  experienceName: 'Paris Adventure',
  totalCost: 2850,
  costCount: 6,
  currency: 'USD',
  costsByCollaborator: [
    { collaborator: sampleCollaborators[0], total: 850, costs: [sampleCosts[0]] },
    { collaborator: sampleCollaborators[1], total: 1200, costs: [sampleCosts[1]] },
    { collaborator: sampleCollaborators[2], total: 450, costs: [sampleCosts[4]] },
  ],
  costsByPlanItem: [
    { item: samplePlanItems[0], total: 850, costs: [sampleCosts[0]] },
    { item: samplePlanItems[1], total: 1200, costs: [sampleCosts[1]] },
    { item: samplePlanItems[2], total: 75, costs: [sampleCosts[2]] },
    { item: samplePlanItems[3], total: 450, costs: [sampleCosts[4]] },
  ],
  costsByCategory: [
    { category: 'accommodation', label: 'Accommodation', total: 1200, costs: [sampleCosts[1]] },
    { category: 'transport', label: 'Transport', total: 1300, costs: [sampleCosts[0], sampleCosts[4]] },
    { category: 'food', label: 'Food & Dining', total: 180, costs: [sampleCosts[3]] },
    { category: 'activities', label: 'Activities', total: 75, costs: [sampleCosts[2]] },
    { category: 'other', label: 'Other', total: 95, costs: [sampleCosts[5]] },
  ],
  sharedCosts: { total: 350, costs: [sampleCosts[2], sampleCosts[3], sampleCosts[5]] },
  generalCosts: { total: 275, costs: [sampleCosts[3], sampleCosts[5]] },
  perPersonShare: 116.67,
  perPersonSplit: [
    { collaborator: sampleCollaborators[0], individualTotal: 850, sharedPortion: 116.67, grandTotal: 966.67 },
    { collaborator: sampleCollaborators[1], individualTotal: 1200, sharedPortion: 116.67, grandTotal: 1316.67 },
    { collaborator: sampleCollaborators[2], individualTotal: 450, sharedPortion: 116.67, grandTotal: 566.67 },
  ],
  collaboratorCount: 3
};

/**
 * Full summary view with all sections
 */
export const FullSummary = {
  name: 'Full Summary',
  args: {
    summary: sampleApiSummary,
    showBreakdowns: true,
    showCategoryBreakdown: true,
    showPerPersonSplit: true,
    showExport: true,
    currency: 'USD',
  },
  parameters: {
    docs: {
      description: {
        story: 'Complete cost summary with all sections: total, per-person split, category breakdown, and detailed breakdowns.',
      },
    },
  },
};

/**
 * Using costs array instead of summary
 */
export const FromCostsArray = {
  name: 'From Costs Array',
  args: {
    costs: sampleCosts,
    collaborators: sampleCollaborators,
    planItems: samplePlanItems,
    showBreakdowns: true,
    showCategoryBreakdown: true,
    showPerPersonSplit: true,
    showExport: true,
    currency: 'USD',
  },
  parameters: {
    docs: {
      description: {
        story: 'Cost summary calculated from a raw costs array with collaborators and plan items.',
      },
    },
  },
};

/**
 * Compact view showing only total
 */
export const CompactView = {
  name: 'Compact View',
  args: {
    summary: sampleApiSummary,
    compact: true,
    currency: 'USD',
  },
  parameters: {
    docs: {
      description: {
        story: 'Minimal compact view showing only the total cost.',
      },
    },
  },
};

/**
 * Solo traveler (no per-person split)
 */
export const SoloTraveler = {
  name: 'Solo Traveler',
  args: {
    summary: {
      ...sampleApiSummary,
      perPersonSplit: [sampleApiSummary.perPersonSplit[0]],
      collaboratorCount: 1,
    },
    showBreakdowns: true,
    showCategoryBreakdown: true,
    showPerPersonSplit: true,
    currency: 'USD',
  },
  parameters: {
    docs: {
      description: {
        story: 'Cost summary for a solo traveler (per-person split is hidden when only one person).',
      },
    },
  },
};

/**
 * Different currency (EUR)
 */
export const EuroCurrency = {
  name: 'Euro Currency',
  args: {
    summary: {
      ...sampleApiSummary,
      currency: 'EUR',
    },
    currency: 'EUR',
    showBreakdowns: true,
    showCategoryBreakdown: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Cost summary displayed in Euros.',
      },
    },
  },
};

/**
 * Loading state
 */
export const Loading = {
  name: 'Loading State',
  args: {
    loading: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows the loading state while data is being fetched.',
      },
    },
  },
};

/**
 * No costs yet
 */
export const Empty = {
  name: 'No Costs',
  args: {
    summary: {
      totalCost: 0,
      costCount: 0,
      costsByCollaborator: [],
      costsByPlanItem: [],
      costsByCategory: [],
      sharedCosts: { total: 0, costs: [] },
      generalCosts: { total: 0, costs: [] },
      perPersonSplit: [],
      collaboratorCount: 1,
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Empty state when no costs have been tracked yet.',
      },
    },
  },
};

/**
 * Only categories (no breakdowns)
 */
export const CategoryOnly = {
  name: 'Category Breakdown Only',
  args: {
    summary: sampleApiSummary,
    showBreakdowns: false,
    showCategoryBreakdown: true,
    showPerPersonSplit: false,
    showExport: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows only the category breakdown without other detailed breakdowns.',
      },
    },
  },
};

/**
 * All shared costs
 */
export const AllShared = {
  name: 'All Shared Costs',
  args: {
    summary: {
      ...sampleApiSummary,
      costsByCollaborator: [],
      sharedCosts: { total: 2850, costs: sampleCosts },
      perPersonShare: 950,
      perPersonSplit: sampleCollaborators.map(c => ({
        collaborator: c,
        individualTotal: 0,
        sharedPortion: 950,
        grandTotal: 950,
      })),
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'All costs are shared equally among collaborators (no individual assignments).',
      },
    },
  },
};

/**
 * Mobile view
 */
export const MobileView = {
  name: 'Mobile View',
  args: {
    summary: sampleApiSummary,
    showBreakdowns: true,
    showCategoryBreakdown: true,
    showPerPersonSplit: true,
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
    docs: {
      description: {
        story: 'Cost summary optimized for mobile viewports with responsive layouts.',
      },
    },
  },
};

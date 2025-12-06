/**
 * CostEntry Component Stories
 *
 * Demonstrates the CostEntry modal form for adding and editing costs in a plan.
 * Shows various states including add mode, edit mode, with/without collaborators and plan items.
 */

import { useState } from 'react';
import CostEntry from '../components/CostEntry/CostEntry';
import { Button } from '../components/design-system';

export default {
  title: 'Components/Forms/Cost Entry',
  component: CostEntry,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Modal form for adding or editing cost entries in a plan. Supports categories, dates, collaborator assignment, and plan item linking.',
      },
    },
  },
  argTypes: {
    show: { control: 'boolean', description: 'Controls modal visibility' },
    loading: { control: 'boolean', description: 'Show loading state on submit button' },
    editingCost: { control: 'object', description: 'Existing cost object for edit mode' },
    collaborators: { control: 'object', description: 'Array of collaborators for assignment dropdown' },
    planItems: { control: 'object', description: 'Array of plan items for linking dropdown' },
    onSave: { action: 'saved', description: 'Called when form is submitted' },
    onHide: { action: 'hidden', description: 'Called when modal is closed' },
  },
};

// Sample data for stories
const sampleCollaborators = [
  { _id: 'user1', name: 'Alice Johnson' },
  { _id: 'user2', name: 'Bob Smith' },
  { _id: 'user3', name: 'Charlie Brown' },
  { _id: 'user4', name: 'Diana Prince' },
];

const samplePlanItems = [
  { _id: 'item1', text: 'Book flights to Paris' },
  { _id: 'item2', text: 'Reserve hotel accommodation' },
  { _id: 'item3', text: 'Purchase museum tickets' },
  { _id: 'item4', text: 'Rent a car' },
  { _id: 'item5', text: 'Book restaurant reservations' },
];

const sampleExistingCost = {
  _id: 'cost123',
  title: 'Flight tickets',
  description: 'Round trip tickets to Paris for 2 people',
  cost: 850.00,
  currency: 'USD',
  category: 'transport',
  date: new Date().toISOString(),
  collaborator: 'user1',
  plan_item: 'item1',
};

// Interactive wrapper to demonstrate the modal open/close functionality
const InteractiveWrapper = (args) => {
  const [show, setShow] = useState(false);

  return (
    <div>
      <Button variant="gradient" onClick={() => setShow(true)}>
        {args.editingCost ? 'Edit Cost' : 'Add Cost'}
      </Button>
      <CostEntry
        {...args}
        show={show}
        onHide={() => setShow(false)}
        onSave={(data) => {
          args.onSave?.(data);
          setShow(false);
        }}
      />
    </div>
  );
};

/**
 * Default add mode with all fields empty
 */
export const AddCost = {
  name: 'Add New Cost',
  render: InteractiveWrapper,
  args: {
    collaborators: sampleCollaborators,
    planItems: samplePlanItems,
    loading: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'Basic add cost mode with collaborators and plan items available for selection.',
      },
    },
  },
};

/**
 * Edit mode with existing cost data
 */
export const EditCost = {
  name: 'Edit Existing Cost',
  render: InteractiveWrapper,
  args: {
    editingCost: sampleExistingCost,
    collaborators: sampleCollaborators,
    planItems: samplePlanItems,
    loading: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'Edit mode with pre-populated fields from an existing cost entry.',
      },
    },
  },
};

/**
 * Minimal mode without collaborators or plan items
 */
export const MinimalMode = {
  name: 'Without Collaborators/Plan Items',
  render: InteractiveWrapper,
  args: {
    collaborators: [],
    planItems: [],
    loading: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'Simple mode when no collaborators or plan items are available - only shows essential fields.',
      },
    },
  },
};

/**
 * Loading state during save
 */
export const LoadingState = {
  name: 'Loading State',
  args: {
    show: true,
    collaborators: sampleCollaborators,
    planItems: samplePlanItems,
    loading: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows the loading state when the form is being submitted.',
      },
    },
  },
};

/**
 * With only collaborators (no plan items)
 */
export const OnlyCollaborators = {
  name: 'With Only Collaborators',
  render: InteractiveWrapper,
  args: {
    collaborators: sampleCollaborators,
    planItems: [],
    loading: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows the form when only collaborators are available (no plan items).',
      },
    },
  },
};

/**
 * With only plan items (no collaborators)
 */
export const OnlyPlanItems = {
  name: 'With Only Plan Items',
  render: InteractiveWrapper,
  args: {
    collaborators: [],
    planItems: samplePlanItems,
    loading: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows the form when only plan items are available (no collaborators).',
      },
    },
  },
};

/**
 * Edit with different currency
 */
export const DifferentCurrency = {
  name: 'Different Currency (EUR)',
  render: InteractiveWrapper,
  args: {
    editingCost: {
      ...sampleExistingCost,
      currency: 'EUR',
      cost: 780.50,
    },
    collaborators: sampleCollaborators,
    planItems: samplePlanItems,
    loading: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'Edit mode showing a cost entry in Euros.',
      },
    },
  },
};

/**
 * All categories demonstration
 */
export const AllCategories = {
  name: 'Categories Overview',
  render: () => {
    const [show, setShow] = useState(false);
    const [currentCategory, setCurrentCategory] = useState('');
    const categories = ['accommodation', 'transport', 'food', 'activities', 'equipment', 'other'];

    return (
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {categories.map((cat) => (
          <Button
            key={cat}
            variant="outline"
            size="sm"
            onClick={() => {
              setCurrentCategory(cat);
              setShow(true);
            }}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </Button>
        ))}
        <CostEntry
          show={show}
          onHide={() => setShow(false)}
          editingCost={{
            title: `Sample ${currentCategory} cost`,
            cost: 100,
            currency: 'USD',
            category: currentCategory,
          }}
          collaborators={sampleCollaborators}
          planItems={samplePlanItems}
          onSave={() => setShow(false)}
        />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Interactive demonstration of all available cost categories.',
      },
    },
  },
};

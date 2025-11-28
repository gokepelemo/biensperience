import React from 'react';
import { Row } from 'react-bootstrap';
import ActivePlansCard from '../../components/Dashboard/ActivePlansCard';

export default {
  title: 'Components/Cards/Plan Metrics',
  component: ActivePlansCard,
  decorators: [
    (Story) => (
      <div style={{ width: '1200px', padding: 'var(--space-4)' }}>
        <Row>
          <Story />
        </Row>
      </div>
    ),
  ],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Enhanced active plans metric card showing detailed plan statistics including owned plans, shared plans, and completion status. This card is designed to be used within a Bootstrap grid system (Row container).',
      },
    },
  },
  argTypes: {
    loading: {
      control: 'boolean',
      description: 'Whether the card is in loading state',
    },
  },
};

// Default state with sample data
export const Default = {
  args: {
    stats: {
      activePlansDetails: {
        totalPlans: 5,
        ownedPlans: 3,
        sharedPlans: 2,
        completedPlans: 1,
      },
    },
    loading: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'Active plans card with typical user data showing 5 total plans (3 owned, 2 shared, 1 completed).',
      },
    },
  },
};

// Loading state
export const Loading = {
  args: {
    stats: {},
    loading: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Loading state showing skeleton placeholders while data is being fetched.',
      },
    },
  },
};

// No plans
export const NoPlans = {
  args: {
    stats: {
      activePlansDetails: {
        totalPlans: 0,
        ownedPlans: 0,
        sharedPlans: 0,
        completedPlans: 0,
      },
    },
    loading: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'Empty state when user has no active plans.',
      },
    },
  },
};

// Only owned plans
export const OnlyOwnedPlans = {
  args: {
    stats: {
      activePlansDetails: {
        totalPlans: 4,
        ownedPlans: 4,
        sharedPlans: 0,
        completedPlans: 2,
      },
    },
    loading: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'User with only owned plans, showing completion progress.',
      },
    },
  },
};

// Only shared plans
export const OnlySharedPlans = {
  args: {
    stats: {
      activePlansDetails: {
        totalPlans: 3,
        ownedPlans: 0,
        sharedPlans: 3,
        completedPlans: 0,
      },
    },
    loading: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'User with only shared/collaborative plans.',
      },
    },
  },
};

// High completion rate
export const HighCompletion = {
  args: {
    stats: {
      activePlansDetails: {
        totalPlans: 8,
        ownedPlans: 5,
        sharedPlans: 3,
        completedPlans: 6,
      },
    },
    loading: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'User with high completion rate showing 6 out of 8 plans completed.',
      },
    },
  },
};

// Dark mode examples
export const DarkModeDefault = {
  args: {
    stats: {
      activePlansDetails: {
        totalPlans: 5,
        ownedPlans: 3,
        sharedPlans: 2,
        completedPlans: 1,
      },
    },
    loading: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'Active plans card in dark mode theme.',
      },
    },
    backgrounds: {
      default: 'dark',
    },
  },
};

// Responsive examples
export const MobileView = {
  args: {
    stats: {
      activePlansDetails: {
        totalPlans: 5,
        ownedPlans: 3,
        sharedPlans: 2,
        completedPlans: 1,
      },
    },
    loading: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'Active plans card in mobile viewport.',
      },
    },
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};

// Interactive hover state
export const HoverState = {
  args: {
    stats: {
      activePlansDetails: {
        totalPlans: 5,
        ownedPlans: 3,
        sharedPlans: 2,
        completedPlans: 1,
      },
    },
    loading: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'Hover state showing elevation and shadow effects.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const card = canvasElement.querySelector('[data-testid="active-plans-card"]') || canvasElement.querySelector('.card');
    if (card) {
      card.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 1000));
      card.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    }
  },
};
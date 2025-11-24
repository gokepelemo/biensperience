/**
 * ActionButtonsRow Component Stories
 * Displays action buttons for experiences and destinations
 */

import ActionButtonsRow from '../../views/SingleExperience/components/ActionButtonsRow';
import ActionButtonsRowDestination from '../../views/SingleDestination/components/ActionButtonsRow';
import { lang } from '../../lang.constants';

export default {
  title: 'Components/ActionButtonsRow',
  component: ActionButtonsRow,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
ActionButtonsRow displays action buttons for SingleExperience and SingleDestination views:

**Experience Actions:**
- Plan It / Planned button (with loading state)
- Edit Date button (for plan owners)
- Edit button (for experience owners)
- Delete button (for experience owners)

**Destination Actions:**
- Add Favorite / Favorited / Remove Favorite button (with loading state)
- Edit button (for destination owners)
- Delete button (for destination owners)

All buttons use:
- \`btn-sm\` for consistent sizing
- \`btn-icon\` for icon button styling
- \`my-1 my-sm-2\` for responsive margins
- \`ms-2\` for left margin spacing
- \`FadeIn\` animation wrapper
        `
      }
    }
  },
  argTypes: {
    userHasExperience: {
      control: 'boolean',
      description: 'Whether user has planned this experience'
    },
    loading: {
      control: 'boolean',
      description: 'Loading state for main action'
    },
    plansLoading: {
      control: 'boolean',
      description: 'Loading state for plans'
    },
    displayedPlannedDate: {
      control: 'text',
      description: 'Currently displayed planned date'
    },
    showDatePicker: {
      control: 'boolean',
      description: 'Whether date picker is shown'
    },
    favHover: {
      control: 'boolean',
      description: 'Hover state for favorite button'
    }
  }
};

// Mock user and experience data
const mockUser = {
  _id: 'user123',
  name: 'Test User',
  email: 'test@example.com'
};

const mockExperience = {
  _id: 'exp123',
  name: 'Tokyo Food Tour',
  user: 'user123',
  permissions: [{ user: 'user123', role: 'owner', priority: 100 }]
};

const mockDestination = {
  _id: 'dest123',
  name: 'Tokyo',
  country: 'Japan',
  user: 'user123',
  users_favorite: [] // Will be modified per story
};

// Mock handlers
const mockHandlers = {
  handleExperience: () => console.log('Handle experience clicked'),
  setShowDeleteModal: (show) => console.log('Delete modal:', show),
  setShowDatePicker: (show) => console.log('Date picker:', show),
  setIsEditingDate: (editing) => console.log('Editing date:', editing),
  setPlannedDate: (date) => console.log('Planned date:', date),
  setFavHover: (hover) => console.log('Hover:', hover),
  handleFavorite: () => console.log('Handle favorite clicked')
};

/**
 * Default state - Not planned
 */
export const NotPlanned = {
  args: {
    user: mockUser,
    experience: mockExperience,
    experienceId: 'exp123',
    userHasExperience: false,
    loading: false,
    plansLoading: false,
    displayedPlannedDate: null,
    selectedPlan: null,
    planBtnWidth: 120,
    favHover: false,
    showDatePicker: false,
    lang,
    ...mockHandlers
  }
};

/**
 * Planned state - User has planned
 */
export const Planned = {
  args: {
    ...NotPlanned.args,
    userHasExperience: true,
    selectedPlan: mockPlan,
    displayedPlannedDate: '2025-12-25'
  }
};

/**
 * Loading state
 */
export const Loading = {
  args: {
    ...NotPlanned.args,
    plansLoading: true
  }
};

/**
 * Hover state - Shows "Remove" text
 */
export const HoverState = {
  args: {
    ...Planned.args,
    favHover: true
  }
};

/**
 * With date picker open
 */
export const DatePickerOpen = {
  args: {
    ...Planned.args,
    showDatePicker: true
  }
};

/**
 * Full owner view - All buttons visible
 */
export const OwnerView = {
  args: {
    ...Planned.args,
    selectedPlan: mockPlan
  }
};

/**
 * Collaborator view - No edit/delete buttons
 */
export const CollaboratorView = {
  args: {
    ...Planned.args,
    selectedPlan: {
      ...mockPlan,
      user: { _id: 'otheruser', name: 'Other User' }
    }
  }
};

/**
 * Responsive mobile view
 */
export const MobileView = {
  args: {
    ...OwnerView.args
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1'
    }
  }
};

/**
 * Destination Action Buttons - Not Favorited
 */
export const DestinationNotFavorited = {
  args: {
    ...mockDestinationData,
    isUserFavorite: false,
    favLoading: false,
    favHover: false,
    isOwner: false,
    showDeleteModal: false,
    handleFavorite: mockDestinationHandlers.handleFavorite,
    handleEdit: mockDestinationHandlers.handleEdit,
    handleDelete: mockDestinationHandlers.handleDelete,
    setShowDeleteModal: mockDestinationHandlers.setShowDeleteModal
  }
};

/**
 * Destination Action Buttons - Favorited
 */
export const DestinationFavorited = {
  args: {
    ...mockDestinationData,
    isUserFavorite: true,
    favLoading: false,
    favHover: false,
    isOwner: false,
    showDeleteModal: false,
    handleFavorite: mockDestinationHandlers.handleFavorite,
    handleEdit: mockDestinationHandlers.handleEdit,
    handleDelete: mockDestinationHandlers.handleDelete,
    setShowDeleteModal: mockDestinationHandlers.setShowDeleteModal
  }
};

/**
 * Destination Action Buttons - Loading State
 */
export const DestinationLoading = {
  args: {
    ...mockDestinationData,
    isUserFavorite: false,
    favLoading: true,
    favHover: false,
    isOwner: false,
    showDeleteModal: false,
    handleFavorite: mockDestinationHandlers.handleFavorite,
    handleEdit: mockDestinationHandlers.handleEdit,
    handleDelete: mockDestinationHandlers.handleDelete,
    setShowDeleteModal: mockDestinationHandlers.setShowDeleteModal
  }
};

/**
 * Destination Action Buttons - Owner View
 */
export const DestinationOwnerView = {
  args: {
    ...mockDestinationData,
    isUserFavorite: true,
    favLoading: false,
    favHover: false,
    isOwner: true,
    showDeleteModal: false,
    handleFavorite: mockDestinationHandlers.handleFavorite,
    handleEdit: mockDestinationHandlers.handleEdit,
    handleDelete: mockDestinationHandlers.handleDelete,
    setShowDeleteModal: mockDestinationHandlers.setShowDeleteModal
  }
};

/**
 * Button styling showcase
 */
export const ButtonStyling = {
  render: () => (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h3>Action Button Styling</h3>

      <div>
        <h5>Primary Action - Plan It</h5>
        <button className="btn btn-sm btn-icon my-1 my-sm-2 btn-plan-add">
          Plan It
        </button>
      </div>

      <div>
        <h5>Primary Action - Planned (Hover to Remove)</h5>
        <button className="btn btn-sm btn-icon my-1 my-sm-2 btn-plan-remove">
          Planned
        </button>
      </div>

      <div>
        <h5>Icon Buttons - Edit Date, Edit, Delete</h5>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-sm btn-icon my-1 my-sm-2 ms-2" title="Edit Date">
            📅
          </button>
          <button className="btn btn-sm btn-icon my-1 my-sm-2 ms-2" title="Edit">
            ✏️
          </button>
          <button className="btn btn-sm btn-icon my-1 my-sm-2 ms-2" title="Delete">
            ❌
          </button>
        </div>
      </div>

      <div>
        <h5>Complete Button Row</h5>
        <div className="d-flex col-md-6 justify-content-center justify-content-md-end align-items-center flex-row experience-actions">
          <button className="btn btn-sm btn-icon my-1 my-sm-2 btn-plan-add">
            Plan It
          </button>
          <button className="btn btn-sm btn-icon my-1 my-sm-2 ms-2">
            📅
          </button>
          <button className="btn btn-sm btn-icon my-1 my-sm-2 ms-2">
            ✏️
          </button>
          <button className="btn btn-sm btn-icon my-1 my-sm-2 ms-2">
            ❌
          </button>
        </div>
      </div>

      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
        <h5>Design System Classes Used</h5>
        <ul style={{ fontSize: '14px', lineHeight: '1.8' }}>
          <li><code>.btn</code> - Base button class</li>
          <li><code>.btn-sm</code> - Small size variant</li>
          <li><code>.btn-icon</code> - Icon button styling</li>
          <li><code>.my-1</code> - Vertical margin (4px)</li>
          <li><code>.my-sm-2</code> - Vertical margin (8px) on sm+ breakpoints</li>
          <li><code>.ms-2</code> - Left margin (8px) for spacing between buttons</li>
          <li><code>.btn-plan-add</code> - Green "Plan It" styling</li>
          <li><code>.btn-plan-remove</code> - Purple "Planned" styling</li>
        </ul>
      </div>
    </div>
  )
};

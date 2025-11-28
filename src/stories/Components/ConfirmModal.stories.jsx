import { useState } from 'react';
import ConfirmModal from '../../components/ConfirmModal/ConfirmModal';
import { Button } from '../../components/design-system';

export default {
  title: 'Components/Modals/Confirm Dialog',
  component: ConfirmModal,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
Confirmation modal for dangerous or irreversible actions.
Matches the Storybook DeleteConfirmationModal design pattern with:
- Warning icon in title (for danger variants)
- "This action cannot be undone!" alert
- Item name in bold
- Optional list of additional consequences
- Cancel and Delete Permanently buttons with icons
        `,
      },
    },
  },
  argTypes: {
    title: { control: 'text', description: 'Modal title (e.g., "Delete Experience?")' },
    message: { control: 'text', description: 'Main message describing the action' },
    itemName: { control: 'text', description: 'Name of item being deleted (shown in bold)' },
    additionalInfo: { control: 'object', description: 'Array of additional consequences' },
    confirmText: { control: 'text', description: 'Label for the confirm action button' },
    cancelText: { control: 'text', description: 'Label for the cancel action button' },
    confirmVariant: {
      control: { type: 'select' },
      options: ['primary', 'secondary', 'success', 'danger', 'warning', 'info', 'light', 'dark'],
      description: 'Visual style of the confirm action',
    },
    showWarning: { control: 'boolean', description: 'Show "This action cannot be undone!" warning' },
    showIcon: { control: 'boolean', description: 'Show warning icon in title and trash icon in button' },
    warningText: { control: 'text', description: 'Custom warning text' },
  },
};

// Delete Experience - Full Featured
export const DeleteExperience = {
  render: (args) => {
    const [show, setShow] = useState(false);
    return (
      <>
        <Button variant="danger" onClick={() => setShow(true)}>
          Show Delete Modal
        </Button>
        <ConfirmModal
          {...args}
          show={show}
          onClose={() => setShow(false)}
          onConfirm={() => {
            alert('Experience deleted!');
            setShow(false);
          }}
        />
      </>
    );
  },
  args: {
    title: 'Delete Experience?',
    message: 'You are about to permanently delete',
    itemName: 'Cherry Blossom Viewing in Ueno Park',
    additionalInfo: [
      'All plan items',
      'Associated photos',
      'User plans (if any)'
    ],
    confirmText: 'Delete Permanently',
    confirmVariant: 'danger',
    showWarning: true,
    showIcon: true,
  }
};

// Delete Destination
export const DeleteDestination = {
  render: (args) => {
    const [show, setShow] = useState(false);
    return (
      <>
        <Button variant="danger" onClick={() => setShow(true)}>
          Show Delete Modal
        </Button>
        <ConfirmModal
          {...args}
          show={show}
          onClose={() => setShow(false)}
          onConfirm={() => {
            alert('Destination deleted!');
            setShow(false);
          }}
        />
      </>
    );
  },
  args: {
    title: 'Delete Destination?',
    message: 'You are about to permanently delete',
    itemName: 'Tokyo, Japan',
    additionalInfo: [
      'All associated experiences',
      'Photos and media',
      'Travel tips'
    ],
    confirmText: 'Delete Permanently',
    confirmVariant: 'danger',
  }
};

// Remove from Plans
export const RemoveFromPlans = {
  render: (args) => {
    const [show, setShow] = useState(false);
    return (
      <>
        <Button variant="danger" onClick={() => setShow(true)}>
          Show Remove Modal
        </Button>
        <ConfirmModal
          {...args}
          show={show}
          onClose={() => setShow(false)}
          onConfirm={() => {
            alert('Removed from plans!');
            setShow(false);
          }}
        />
      </>
    );
  },
  args: {
    title: 'Remove from Your Plans?',
    message: 'You are about to remove',
    itemName: 'Hiking Mount Fuji',
    additionalInfo: [
      'Your plan progress',
      'Completed items',
      'Personal notes'
    ],
    warningText: 'Your progress will be permanently deleted!',
    confirmText: 'Remove from Plans',
    confirmVariant: 'danger',
  }
};

// Delete Plan Item
export const DeletePlanItem = {
  render: (args) => {
    const [show, setShow] = useState(false);
    return (
      <>
        <Button variant="danger" onClick={() => setShow(true)}>
          Show Delete Modal
        </Button>
        <ConfirmModal
          {...args}
          show={show}
          onClose={() => setShow(false)}
          onConfirm={() => {
            alert('Plan item deleted!');
            setShow(false);
          }}
        />
      </>
    );
  },
  args: {
    title: 'Delete Plan Item?',
    message: 'You are about to delete this plan item',
    itemName: 'Book temple stay accommodation',
    confirmText: 'Delete Permanently',
    confirmVariant: 'danger',
  }
};

// Delete Photo
export const DeletePhoto = {
  render: (args) => {
    const [show, setShow] = useState(false);
    return (
      <>
        <Button variant="danger" onClick={() => setShow(true)}>
          Show Delete Modal
        </Button>
        <ConfirmModal
          {...args}
          show={show}
          onClose={() => setShow(false)}
          onConfirm={() => {
            alert('Photo deleted!');
            setShow(false);
          }}
        />
      </>
    );
  },
  args: {
    title: 'Delete Photo?',
    message: 'You are about to permanently delete this photo',
    confirmText: 'Delete Permanently',
    confirmVariant: 'danger',
  }
};

// Delete Note
export const DeleteNote = {
  render: (args) => {
    const [show, setShow] = useState(false);
    return (
      <>
        <Button variant="danger" onClick={() => setShow(true)}>
          Show Delete Modal
        </Button>
        <ConfirmModal
          {...args}
          show={show}
          onClose={() => setShow(false)}
          onConfirm={() => {
            alert('Note deleted!');
            setShow(false);
          }}
        />
      </>
    );
  },
  args: {
    title: 'Delete Note?',
    message: 'You are about to permanently delete this note',
    confirmText: 'Delete Permanently',
    confirmVariant: 'danger',
  }
};

// Simple Confirmation (no additional info)
export const SimpleConfirmation = {
  render: (args) => {
    const [show, setShow] = useState(false);
    return (
      <>
        <Button variant="danger" onClick={() => setShow(true)}>
          Show Simple Modal
        </Button>
        <ConfirmModal
          {...args}
          show={show}
          onClose={() => setShow(false)}
          onConfirm={() => {
            alert('Confirmed!');
            setShow(false);
          }}
        />
      </>
    );
  },
  args: {
    title: 'Delete Travel Tip?',
    message: 'You are about to permanently delete this travel tip',
    confirmText: 'Delete Permanently',
    confirmVariant: 'danger',
  }
};

// Without Warning (for less destructive actions)
export const WithoutWarning = {
  render: (args) => {
    const [show, setShow] = useState(false);
    return (
      <>
        <Button variant="primary" onClick={() => setShow(true)}>
          Show Save Modal
        </Button>
        <ConfirmModal
          {...args}
          show={show}
          onClose={() => setShow(false)}
          onConfirm={() => {
            alert('Saved!');
            setShow(false);
          }}
        />
      </>
    );
  },
  args: {
    title: 'Save Changes?',
    message: 'Do you want to save your changes before proceeding?',
    confirmText: 'Save Changes',
    confirmVariant: 'primary',
    showWarning: false,
    showIcon: false,
  }
};

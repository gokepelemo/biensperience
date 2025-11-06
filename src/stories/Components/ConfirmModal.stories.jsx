import { useState } from 'react';
import ConfirmModal from '../../components/ConfirmModal/ConfirmModal';

export default {
  title: 'Components/ConfirmModal',
  component: ConfirmModal,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Confirmation modal for dangerous or irreversible actions. Includes clear primary/secondary actions and supports contextual variants (danger, warning, etc.).',
      },
    },
  },
  argTypes: {
    confirmText: { control: 'text', description: 'Label for the confirm action button' },
    cancelText: { control: 'text', description: 'Label for the cancel action button' },
    confirmVariant: {
      control: { type: 'select' },
      options: ['primary', 'secondary', 'success', 'danger', 'warning', 'info', 'light', 'dark'],
      description: 'Visual style of the confirm action',
    },
    show: { control: 'boolean', description: 'Controls visibility (managed internally in stories)' },
  },
};

export const DangerConfirm = {
  render: (args) => {
    const [show, setShow] = useState(true);
    return (
      <ConfirmModal
        {...args}
        show={show}
        onClose={() => setShow(false)}
        onConfirm={() => alert('Confirmed')}
        title="Delete Experience"
        message="Are you sure you want to delete this experience? This action cannot be undone."
      />
    );
  },
  args: {
    confirmText: 'Delete',
    confirmVariant: 'danger',
    cancelText: 'Cancel',
  }
};

export const PrimaryConfirm = {
  render: (args) => {
    const [show, setShow] = useState(true);
    return (
      <ConfirmModal
        {...args}
        show={show}
        onClose={() => setShow(false)}
        onConfirm={() => alert('Confirmed')}
        title="Save Changes"
        message="Do you want to save your changes before proceeding?"
      />
    );
  },
  args: {
    confirmText: 'Save',
    confirmVariant: 'primary',
    cancelText: 'Discard',
  },
};

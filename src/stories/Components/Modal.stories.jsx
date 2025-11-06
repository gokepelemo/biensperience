import { useState } from 'react';
import Modal from '../../components/Modal/Modal';

export default {
  title: 'Components/Modal',
  component: Modal,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Accessible modal wrapper with consistent header, body, and footer composition. Supports size variants, centered layout, and scrollable bodies. Use for forms and confirmations.',
      },
    },
  },
};

export const Basic = {
  render: (args) => {
    const [show, setShow] = useState(true);
    return (
      <Modal
        {...args}
        show={show}
        onClose={() => setShow(false)}
        onSubmit={() => alert('Submitted')}
        title="Example Modal"
      >
        <p>This is an example modal body with some content.</p>
      </Modal>
    );
  },
  args: {
    submitText: 'Confirm',
    cancelText: 'Cancel',
    submitVariant: 'primary',
    size: undefined,
    centered: true,
    scrollable: false,
  },
  argTypes: {
    submitVariant: { control: { type: 'select' }, options: ['primary', 'secondary', 'success', 'danger', 'warning', 'info', 'light', 'dark'] },
    size: { control: { type: 'select' }, options: [undefined, 'sm', 'lg', 'xl'] },
    centered: { control: 'boolean' },
    scrollable: { control: 'boolean' },
  }
};

export const LargeScrollable = {
  render: (args) => {
    const [show, setShow] = useState(true);
    return (
      <Modal
        {...args}
        show={show}
        onClose={() => setShow(false)}
        onSubmit={() => alert('Submitted')}
        title="Privacy Policy"
      >
        <div style={{ maxHeight: 300 }}>
          {[...Array(12)].map((_, i) => (
            <p key={i}>Long content paragraph {i + 1}. This demonstrates a scrollable body within a larger modal.</p>
          ))}
        </div>
      </Modal>
    );
  },
  args: {
    submitText: 'Accept',
    cancelText: 'Decline',
    submitVariant: 'success',
    size: 'lg',
    centered: true,
    scrollable: true,
  },
};

import Alert from '../../components/Alert/Alert';

export default {
  title: 'Components/Alert',
  component: Alert,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Unified alert component used for inline status messages. Supports four types (info, success, warning, danger), optional title, icon, and dismiss behavior.',
      },
    },
  },
  args: {
    type: 'info',
    title: 'Heads up',
    message: 'This is an informational alert with helpful context.',
    dismissible: true,
    showIcon: true,
    size: 'md',
    bordered: false
  },
  argTypes: {
    type: { control: { type: 'select' }, options: ['info', 'success', 'warning', 'danger'] },
    size: { control: { type: 'select' }, options: ['sm', 'md', 'lg'] },
    dismissible: { control: 'boolean' },
    bordered: { control: 'boolean' },
    showIcon: { control: 'boolean' }
  }
};

export const Info = {};

export const Success = {
  args: { type: 'success', title: 'Done', message: 'Your changes have been saved successfully.' }
};

export const Warning = {
  args: { type: 'warning', title: 'Careful', message: 'Double-check your inputs before proceeding.' }
};

export const Danger = {
  args: { type: 'danger', title: 'Error', message: 'Something went wrong. Please try again.' }
};

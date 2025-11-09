import Alert from './Alert';

export default {
  title: 'Components/Alert',
  component: Alert,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Flexible alert component with multiple variants, sizes, and customization options. Supports dismissible alerts, custom icons, actions, and bordered styles.',
      },
    },
  },
  tags: [],
  argTypes: {
    type: {
      control: 'select',
      options: ['primary', 'secondary', 'success', 'danger', 'warning', 'info', 'light', 'dark'],
      description: 'Alert variant type',
      table: {
        type: { summary: 'string' },
        defaultValue: { summary: 'info' },
      },
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Alert size',
      table: {
        type: { summary: 'string' },
        defaultValue: { summary: 'md' },
      },
    },
    dismissible: {
      control: 'boolean',
      description: 'Whether alert can be dismissed',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: false },
      },
    },
    bordered: {
      control: 'boolean',
      description: 'Whether to show border',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: false },
      },
    },
    title: {
      control: 'text',
      description: 'Alert title (optional)',
    },
    message: {
      control: 'text',
      description: 'Alert message',
    },
    showIcon: {
      control: 'boolean',
      description: 'Whether to show icon',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: true },
      },
    },
  },
};

// Default alert
export const Default = {
  args: {
    type: 'info',
    message: 'This is an informational alert message.',
    dismissible: false,
  },
};

// With title
export const WithTitle = {
  args: {
    type: 'info',
    title: 'Important Information',
    message: 'This alert has a title to provide additional context.',
  },
};

// All variants
export const AllVariants = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <Alert type="primary" message="Primary alert for highlighting important information" />
      <Alert type="secondary" message="Secondary alert for less prominent messages" />
      <Alert type="success" icon="✅" message="Success! Your action was completed successfully" />
      <Alert type="danger" icon="❌" message="Danger! Something went wrong" />
      <Alert type="warning" icon="⚠️" message="Warning! Please review this information" />
      <Alert type="info" icon="ℹ️" message="Info: Here's some helpful information" />
      <Alert type="light" message="Light variant for subtle messages" />
      <Alert type="dark" message="Dark variant for emphasis" />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'All available alert variants with icons.',
      },
    },
  },
};

// Dismissible alerts
export const Dismissible = {
  args: {
    type: 'success',
    title: 'Success!',
    message: 'You can dismiss this alert by clicking the × button.',
    dismissible: true,
    icon: '✅',
  },
};

// Size variants
export const Sizes = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <Alert type="info" size="sm" message="Small alert for compact spaces" />
      <Alert type="info" size="md" message="Medium alert (default size)" />
      <Alert type="info" size="lg" message="Large alert for prominent messages" />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Three size variants: small, medium (default), and large.',
      },
    },
  },
};

// Bordered alerts
export const Bordered = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <Alert type="success" bordered icon="✅" message="Bordered success alert" />
      <Alert type="warning" bordered icon="⚠️" message="Bordered warning alert" />
      <Alert type="danger" bordered icon="❌" message="Bordered danger alert" />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Alerts with visible borders for additional emphasis.',
      },
    },
  },
};

// With actions
export const WithActions = {
  render: () => (
    <Alert
      type="warning"
      title="Confirmation Required"
      message="This action cannot be undone. Are you sure you want to proceed?"
      icon="⚠️"
      actions={
        <>
          <button className="btn btn-sm btn-danger">Delete</button>
          <button className="btn btn-sm btn-secondary">Cancel</button>
        </>
      }
    />
  ),
  parameters: {
    docs: {
      description: {
        story: 'Alert with action buttons. Useful for confirmations or inline forms.',
      },
    },
  },
};

// Complex content
export const ComplexContent = {
  render: () => (
    <Alert type="info" icon="ℹ️" bordered size="lg">
      <div>
        <strong>New Features Available</strong>
        <p className="mb-2">We've added several new features to improve your experience:</p>
        <ul className="mb-0">
          <li>Enhanced loading animations with 8 animation types</li>
          <li>Improved form utilities for consistent styling</li>
          <li>New button variants with gradients</li>
          <li>Better dark mode support</li>
        </ul>
      </div>
    </Alert>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Alert with complex HTML content including lists and formatting.',
      },
    },
  },
};

// Real-world examples
export const Examples = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '600px' }}>
      {/* Form validation error */}
      <Alert
        type="danger"
        icon="❌"
        title="Validation Error"
        message="Please fix the following errors before submitting:"
        size="md"
      >
        <ul className="mb-0 mt-2">
          <li>Email is required</li>
          <li>Password must be at least 8 characters</li>
        </ul>
      </Alert>

      {/* Email verification notice */}
      <Alert
        type="warning"
        icon="📧"
        title="Email Verification Required"
        bordered
        actions={
          <button className="btn btn-sm btn-primary">Resend Verification Email</button>
        }
      >
        <p className="mb-0">
          Please verify your email address to create or edit content. Check your inbox for the verification link.
        </p>
      </Alert>

      {/* Success message */}
      <Alert
        type="success"
        icon="✅"
        title="Experience Created Successfully"
        dismissible
      >
        <p className="mb-0">
          Your experience has been saved and is now visible to other users.
        </p>
      </Alert>

      {/* Unsaved changes warning */}
      <Alert
        type="info"
        icon="💾"
        title="Unsaved Changes"
        actions={
          <>
            <button className="btn btn-sm btn-primary">Restore</button>
            <button className="btn btn-sm btn-outline-secondary">Discard</button>
          </>
        }
      >
        <p className="mb-0">
          You have unsaved form data from 2 hours ago. Would you like to restore it?
        </p>
      </Alert>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Real-world alert examples from the Biensperience application.',
      },
    },
  },
};

// Interactive playground for testing all alert props
export const Playground = (args) => <Alert {...args}>This is a customizable alert message.</Alert>;
Playground.args = {
  type: 'info',
  size: 'md',
  dismissible: false,
  bordered: false,
  title: '',
  icon: null,
  className: ''
};

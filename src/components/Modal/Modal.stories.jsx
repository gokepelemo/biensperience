import { useState } from 'react';
import Modal from './Modal';
import FormField from '../FormField/FormField';

export default {
  title: 'Components/Modal',
  component: Modal,
  argTypes: {
    show: {
      control: { type: 'boolean' },
      description: 'Whether the modal is visible'
    },
    title: {
      control: { type: 'text' },
      description: 'Modal title'
    },
    submitText: {
      control: { type: 'text' },
      description: 'Text for submit button'
    },
    submitVariant: {
      control: { type: 'select' },
      options: ['primary', 'secondary', 'success', 'danger', 'warning', 'info', 'light', 'dark'],
      description: 'Bootstrap variant for submit button'
    },
    cancelText: {
      control: { type: 'text' },
      description: 'Text for cancel button'
    },
    showCancelButton: {
      control: { type: 'boolean' },
      description: 'Whether to show cancel button'
    },
    showSubmitButton: {
      control: { type: 'boolean' },
      description: 'Whether to show submit button'
    },
    disableSubmit: {
      control: { type: 'boolean' },
      description: 'Whether submit button is disabled'
    },
    loading: {
      control: { type: 'boolean' },
      description: 'Whether modal is in loading state'
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'lg', 'xl'],
      description: 'Modal size'
    },
    scrollable: {
      control: { type: 'boolean' },
      description: 'Whether modal content is scrollable'
    },
    centered: {
      control: { type: 'boolean' },
      description: 'Whether modal is vertically centered'
    }
  },
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Flexible modal dialog component with support for forms, custom footers, loading states, and various sizes. Built with React Bootstrap and portal rendering.',
      },
    },
  },
  tags: [],
};

// Basic modal
export const BasicModal = {
  render: () => {
    const [show, setShow] = useState(false);

    return (
      <>
        <button className="btn btn-primary" onClick={() => setShow(true)}>
          Open Basic Modal
        </button>

        <Modal
          show={show}
          onClose={() => setShow(false)}
          onSubmit={() => {
            console.log('Submitted');
            setShow(false);
          }}
          title="Basic Modal"
        >
          <p>This is a basic modal with default settings.</p>
          <p>It has a submit and cancel button.</p>
        </Modal>
      </>
    );
  },
};

// Interactive playground for testing modal props
export const Playground = (args) => (
  <Modal
    {...args}
    onClose={() => console.log('Modal closed')}
    onSubmit={() => console.log('Modal submitted')}
  >
    <p>This is modal content that can be customized using the controls panel.</p>
    <p>You can adjust the modal properties to see how they affect the appearance and behavior.</p>
  </Modal>
);
Playground.args = {
  show: true,
  title: 'Modal Playground',
  submitText: 'Submit',
  submitVariant: 'primary',
  cancelText: 'Cancel',
  showCancelButton: true,
  showSubmitButton: true,
  disableSubmit: false,
  loading: false,
  size: undefined,
  scrollable: false,
  centered: true
};

// Form modal with validation
export const FormModal = {
  render: () => {
    const [show, setShow] = useState(false);
    const [formData, setFormData] = useState({ name: '', email: '' });
    const [loading, setLoading] = useState(false);

    const handleSubmit = () => {
      setLoading(true);
      setTimeout(() => {
        console.log('Form submitted:', formData);
        setLoading(false);
        setShow(false);
      }, 1500);
    };

    return (
      <>
        <button className="btn btn-primary" onClick={() => setShow(true)}>
          Open Form Modal
        </button>

        <Modal
          show={show}
          onClose={() => setShow(false)}
          onSubmit={handleSubmit}
          title="Edit Profile"
          submitText="Save Changes"
          loading={loading}
          disableSubmit={!formData.name || !formData.email}
        >
          <FormField
            name="name"
            label="Name"
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Enter your name"
            required
          />

          <FormField
            name="email"
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="Enter your email"
            required
          />

          <small className="text-muted">Fill both fields to enable submit button</small>
        </Modal>
      </>
    );
  },
};

// Size variants
export const ModalSizes = {
  render: () => {
    const [showSm, setShowSm] = useState(false);
    const [showMd, setShowMd] = useState(false);
    const [showLg, setShowLg] = useState(false);
    const [showXl, setShowXl] = useState(false);

    return (
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={() => setShowSm(true)}>
          Small Modal
        </button>
        <button className="btn btn-primary" onClick={() => setShowMd(true)}>
          Medium Modal (Default)
        </button>
        <button className="btn btn-primary" onClick={() => setShowLg(true)}>
          Large Modal
        </button>
        <button className="btn btn-primary" onClick={() => setShowXl(true)}>
          Extra Large Modal
        </button>

        <Modal show={showSm} onClose={() => setShowSm(false)} title="Small Modal" size="sm" showSubmitButton={false} cancelText="Close">
          <p>This is a small modal for quick messages.</p>
        </Modal>

        <Modal show={showMd} onClose={() => setShowMd(false)} title="Medium Modal" showSubmitButton={false} cancelText="Close">
          <p>This is the default medium-sized modal.</p>
        </Modal>

        <Modal show={showLg} onClose={() => setShowLg(false)} title="Large Modal" size="lg" showSubmitButton={false} cancelText="Close">
          <p>This is a large modal for more content.</p>
          <p>It can accommodate forms, lists, or detailed information.</p>
        </Modal>

        <Modal show={showXl} onClose={() => setShowXl(false)} title="Extra Large Modal" size="xl" showSubmitButton={false} cancelText="Close">
          <p>This is an extra-large modal for complex content.</p>
          <p>Perfect for multi-column layouts or data tables.</p>
        </Modal>
      </div>
    );
  },
};

// Danger/confirmation modal
export const DangerModal = {
  render: () => {
    const [show, setShow] = useState(false);

    return (
      <>
        <button className="btn btn-danger" onClick={() => setShow(true)}>
          Delete Item
        </button>

        <Modal
          show={show}
          onClose={() => setShow(false)}
          onSubmit={() => {
            console.log('Item deleted');
            setShow(false);
          }}
          title="Confirm Deletion"
          submitText="Delete"
          submitVariant="danger"
          size="sm"
        >
          <p>Are you sure you want to delete this item?</p>
          <div className="alert alert-danger mb-0">
            <strong>Warning:</strong> This action cannot be undone.
          </div>
        </Modal>
      </>
    );
  },
};

// Info modal (no submit)
export const InfoModal = {
  render: () => {
    const [show, setShow] = useState(false);

    return (
      <>
        <button className="btn btn-info" onClick={() => setShow(true)}>
          View Information
        </button>

        <Modal
          show={show}
          onClose={() => setShow(false)}
          title="Information"
          showSubmitButton={false}
          cancelText="Got it"
        >
          <div className="alert alert-info mb-3">
            <strong>Did you know?</strong>
          </div>
          <p>This modal only has a close button, no submit action.</p>
          <ul className="mb-0">
            <li>Perfect for displaying information</li>
            <li>Terms and conditions</li>
            <li>Help content</li>
            <li>Announcements</li>
          </ul>
        </Modal>
      </>
    );
  },
};

// Custom footer
export const CustomFooter = {
  render: () => {
    const [show, setShow] = useState(false);

    return (
      <>
        <button className="btn btn-primary" onClick={() => setShow(true)}>
          Open Custom Footer Modal
        </button>

        <Modal
          show={show}
          onClose={() => setShow(false)}
          title="Custom Footer"
          footer={
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <button className="btn btn-link">Learn More</button>
              <div>
                <button className="btn btn-secondary me-2" onClick={() => setShow(false)}>
                  Maybe Later
                </button>
                <button className="btn btn-primary" onClick={() => setShow(false)}>
                  Yes, Continue
                </button>
              </div>
            </div>
          }
        >
          <p>This modal has a completely custom footer layout.</p>
          <p>You can customize the footer to show any buttons or content you need.</p>
        </Modal>
      </>
    );
  },
};

// Loading state
export const LoadingState = {
  render: () => {
    const [show, setShow] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = () => {
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        setShow(false);
      }, 3000);
    };

    return (
      <>
        <button className="btn btn-primary" onClick={() => setShow(true)}>
          Save with Loading State
        </button>

        <Modal
          show={show}
          onClose={() => !loading && setShow(false)}
          onSubmit={handleSubmit}
          title="Processing..."
          submitText="Save Changes"
          loading={loading}
        >
          <p>Click "Save Changes" to see the loading state.</p>
          <p>The button will show a spinner and be disabled during the operation.</p>
        </Modal>
      </>
    );
  },
};

// Scrollable content
export const ScrollableModal = {
  render: () => {
    const [show, setShow] = useState(false);

    return (
      <>
        <button className="btn btn-primary" onClick={() => setShow(true)}>
          Open Scrollable Modal
        </button>

        <Modal
          show={show}
          onClose={() => setShow(false)}
          title="Terms and Conditions"
          scrollable={true}
          showSubmitButton={false}
          cancelText="Close"
        >
          <h5>1. Agreement to Terms</h5>
          <p>By accessing and using this service, you accept and agree to be bound by the terms and provision of this agreement.</p>
          
          <h5>2. Use License</h5>
          <p>Permission is granted to temporarily download one copy of the materials on our website for personal, non-commercial transitory viewing only.</p>
          
          <h5>3. Disclaimer</h5>
          <p>The materials on our website are provided on an 'as is' basis. We make no warranties, expressed or implied, and hereby disclaim and negate all other warranties including, without limitation, implied warranties or conditions of merchantability.</p>
          
          <h5>4. Limitations</h5>
          <p>In no event shall our company or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on our website.</p>
          
          <h5>5. Accuracy of Materials</h5>
          <p>The materials appearing on our website could include technical, typographical, or photographic errors. We do not warrant that any of the materials on its website are accurate, complete, or current.</p>
          
          <h5>6. Links</h5>
          <p>We have not reviewed all of the sites linked to our website and are not responsible for the contents of any such linked site.</p>
          
          <h5>7. Modifications</h5>
          <p>We may revise these terms of service for its website at any time without notice. By using this website you are agreeing to be bound by the then current version of these terms of service.</p>
          
          <h5>8. Governing Law</h5>
          <p>These terms and conditions are governed by and construed in accordance with the laws and you irrevocably submit to the exclusive jurisdiction of the courts in that location.</p>
        </Modal>
      </>
    );
  },
};

// With icon
export const WithIcon = {
  render: () => {
    const [show, setShow] = useState(false);

    return (
      <>
        <button className="btn btn-success" onClick={() => setShow(true)}>
          Show Success Message
        </button>

        <Modal
          show={show}
          onClose={() => setShow(false)}
          title="Success!"
          icon="✅"
          showSubmitButton={false}
          cancelText="Close"
          size="sm"
        >
          <div className="text-center">
            <p className="mb-0">Your changes have been saved successfully!</p>
          </div>
        </Modal>
      </>
    );
  },
};

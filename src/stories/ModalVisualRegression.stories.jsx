/**
 * Modal Visual Regression Stories
 *
 * These stories render both Bootstrap and Chakra modal implementations
 * side-by-side for visual regression testing. Playwright captures
 * screenshots of each and compares them pixel-by-pixel.
 *
 * Story naming convention:
 *   Bootstrap__<Variant>  — Bootstrap (custom portal) implementation
 *   Chakra__<Variant>     — Chakra UI Dialog implementation
 *
 * Each pair should be visually identical. Any difference is a regression.
 *
 * Task: biensperience-cd21
 */

import { useEffect, useState } from 'react';
import BootstrapModal from '../../components/Modal/Modal';
import ChakraModal from '../../components/Modal/ChakraModal';

export default {
  title: 'Visual Regression/Modal',
  parameters: {
    layout: 'fullscreen',
    chromatic: { disableSnapshot: false },
    docs: {
      description: {
        component:
          'Visual regression test stories. Each variant is rendered with both Bootstrap and Chakra implementations. Screenshots should be pixel-identical.',
      },
    },
  },
  tags: ['visual-regression'],
};

// ---------------------------------------------------------------------------
// Helper: Auto-open wrapper — renders a modal that opens after mount
// ---------------------------------------------------------------------------
function AutoOpenModal({ ModalComponent, modalProps, children }) {
  const [show, setShow] = useState(false);

  // Auto-open after a brief delay so Storybook decorators are applied
  useEffect(() => {
    const timer = setTimeout(() => setShow(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <ModalComponent
      show={show}
      onClose={() => setShow(false)}
      {...modalProps}
    >
      {children}
    </ModalComponent>
  );
}

// ---------------------------------------------------------------------------
// VARIANT DEFINITIONS
// Each variant is an object with { name, modalProps, children }
// We generate a Bootstrap__ and Chakra__ story for each variant.
// ---------------------------------------------------------------------------
const MODAL_VARIANTS = [
  {
    name: 'Default',
    modalProps: {
      title: 'Default Modal',
      onSubmit: () => {},
      submitText: 'Submit',
    },
    children: (
      <>
        <p>This is a default modal with standard settings.</p>
        <p>It should have a header, body, and footer with Submit button.</p>
      </>
    ),
  },
  {
    name: 'SmallSize',
    modalProps: {
      title: 'Small Modal',
      size: 'sm',
      onSubmit: () => {},
      submitText: 'Confirm',
      submitVariant: 'danger',
    },
    children: <p>A compact modal for quick confirmations.</p>,
  },
  {
    name: 'LargeSize',
    modalProps: {
      title: 'Large Modal',
      size: 'lg',
      onSubmit: () => {},
      submitText: 'Save Changes',
    },
    children: (
      <>
        <p>A large modal for forms or detailed content.</p>
        <p>This uses size=&quot;lg&quot; which maps to max-width: 800px.</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label className="form-label">First Name</label>
            <input className="form-control" defaultValue="Jane" />
          </div>
          <div>
            <label className="form-label">Last Name</label>
            <input className="form-control" defaultValue="Doe" />
          </div>
        </div>
      </>
    ),
  },
  {
    name: 'ExtraLargeSize',
    modalProps: {
      title: 'Extra Large Modal',
      size: 'xl',
      showSubmitButton: false,
      cancelText: 'Close',
    },
    children: (
      <>
        <p>An extra-large modal for complex layouts or data tables.</p>
        <p>Uses size=&quot;xl&quot; which maps to max-width: 1200px / 95% width.</p>
        <table className="table table-striped">
          <thead>
            <tr>
              <th>Name</th>
              <th>Destination</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Beach Adventure</td><td>Malibu, CA</td><td>Planned</td></tr>
            <tr><td>Mountain Trek</td><td>Swiss Alps</td><td>Completed</td></tr>
            <tr><td>City Exploration</td><td>Tokyo, Japan</td><td>In Progress</td></tr>
          </tbody>
        </table>
      </>
    ),
  },
  {
    name: 'Fullscreen',
    modalProps: {
      title: 'Fullscreen Modal',
      size: 'fullscreen',
      showSubmitButton: false,
      cancelText: 'Close',
    },
    children: (
      <div style={{ minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p className="text-muted">Fullscreen modal takes up 100% width and height.</p>
      </div>
    ),
  },
  {
    name: 'WithIcon',
    modalProps: {
      title: 'Success!',
      icon: '✅',
      size: 'sm',
      showSubmitButton: false,
      cancelText: 'Close',
    },
    children: (
      <div className="text-center">
        <p className="mb-0">Your changes have been saved successfully!</p>
      </div>
    ),
  },
  {
    name: 'DangerVariant',
    modalProps: {
      title: 'Confirm Deletion',
      onSubmit: () => {},
      submitText: 'Delete',
      submitVariant: 'danger',
      size: 'sm',
    },
    children: (
      <>
        <p>Are you sure you want to delete this item?</p>
        <div className="alert alert-danger mb-0">
          <strong>Warning:</strong> This action cannot be undone.
        </div>
      </>
    ),
  },
  {
    name: 'LoadingState',
    modalProps: {
      title: 'Processing...',
      onSubmit: () => {},
      submitText: 'Save Changes',
      loading: true,
    },
    children: (
      <>
        <p>The submit button should show loading text and be disabled.</p>
        <p>The close button should also be disabled.</p>
      </>
    ),
  },
  {
    name: 'DisabledSubmit',
    modalProps: {
      title: 'Incomplete Form',
      onSubmit: () => {},
      submitText: 'Submit',
      disableSubmit: true,
    },
    children: (
      <>
        <p>The submit button should be disabled.</p>
        <div>
          <label className="form-label">Required Field</label>
          <input className="form-control" placeholder="Fill this to enable submit" />
        </div>
      </>
    ),
  },
  {
    name: 'NoHeader',
    modalProps: {
      showHeader: false,
      onSubmit: () => {},
      submitText: 'Continue',
    },
    children: (
      <div className="text-center py-4">
        <h4>Welcome!</h4>
        <p>This modal has no header bar.</p>
      </div>
    ),
  },
  {
    name: 'CustomFooter',
    modalProps: {
      title: 'Custom Footer',
      footer: (
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <button className="btn btn-link">Learn More</button>
          <div>
            <button className="btn btn-secondary me-2">Maybe Later</button>
            <button className="btn btn-primary">Yes, Continue</button>
          </div>
        </div>
      ),
    },
    children: (
      <>
        <p>This modal has a completely custom footer layout.</p>
        <p>Three buttons with different alignment.</p>
      </>
    ),
  },
  {
    name: 'ScrollableContent',
    modalProps: {
      title: 'Terms and Conditions',
      scrollable: true,
      showSubmitButton: false,
      cancelText: 'Close',
    },
    children: (
      <>
        <h5>1. Agreement to Terms</h5>
        <p>By accessing this service, you accept these terms and conditions.</p>
        <h5>2. Use License</h5>
        <p>Permission is granted to temporarily download one copy of the materials for personal use only.</p>
        <h5>3. Disclaimer</h5>
        <p>Materials are provided &quot;as is&quot;. We make no warranties, expressed or implied.</p>
        <h5>4. Limitations</h5>
        <p>In no event shall we be liable for any damages arising from use of the materials.</p>
        <h5>5. Accuracy of Materials</h5>
        <p>Materials could include technical, typographical, or photographic errors.</p>
        <h5>6. Links</h5>
        <p>We have not reviewed all linked sites and are not responsible for their contents.</p>
        <h5>7. Modifications</h5>
        <p>We may revise these terms at any time without notice.</p>
        <h5>8. Governing Law</h5>
        <p>These terms are governed by applicable law.</p>
      </>
    ),
  },
  {
    name: 'NotCentered',
    modalProps: {
      title: 'Top-Aligned Modal',
      centered: false,
      onSubmit: () => {},
      submitText: 'OK',
    },
    children: <p>This modal should appear at the top of the viewport, not vertically centered.</p>,
  },
  {
    name: 'InfoVariant',
    modalProps: {
      title: 'Information',
      onSubmit: () => {},
      submitText: 'Got it',
      submitVariant: 'info',
    },
    children: (
      <>
        <div className="alert alert-info mb-3">
          <strong>Did you know?</strong> This uses the &quot;info&quot; submit variant.
        </div>
        <p>Bootstrap &quot;info&quot; variant button styling test.</p>
      </>
    ),
  },
  {
    name: 'WarningVariant',
    modalProps: {
      title: 'Proceed with Caution',
      onSubmit: () => {},
      submitText: 'Proceed',
      submitVariant: 'warning',
    },
    children: (
      <div className="alert alert-warning mb-0">
        <strong>Heads up!</strong> This action may have unintended consequences.
      </div>
    ),
  },
  {
    name: 'SuccessVariant',
    modalProps: {
      title: 'Confirm Action',
      onSubmit: () => {},
      submitText: 'Approve',
      submitVariant: 'success',
    },
    children: <p>This modal uses a success-colored submit button.</p>,
  },
];

// ---------------------------------------------------------------------------
// Generate stories dynamically for each variant × implementation
// ---------------------------------------------------------------------------

// Bootstrap stories
export const Bootstrap__Default = {
  name: '🔵 Bootstrap — Default',
  render: () => (
    <AutoOpenModal ModalComponent={BootstrapModal} modalProps={MODAL_VARIANTS[0].modalProps}>
      {MODAL_VARIANTS[0].children}
    </AutoOpenModal>
  ),
};

export const Chakra__Default = {
  name: '🟣 Chakra — Default',
  render: () => (
    <AutoOpenModal ModalComponent={ChakraModal} modalProps={MODAL_VARIANTS[0].modalProps}>
      {MODAL_VARIANTS[0].children}
    </AutoOpenModal>
  ),
};

export const Bootstrap__SmallSize = {
  name: '🔵 Bootstrap — Small Size',
  render: () => (
    <AutoOpenModal ModalComponent={BootstrapModal} modalProps={MODAL_VARIANTS[1].modalProps}>
      {MODAL_VARIANTS[1].children}
    </AutoOpenModal>
  ),
};

export const Chakra__SmallSize = {
  name: '🟣 Chakra — Small Size',
  render: () => (
    <AutoOpenModal ModalComponent={ChakraModal} modalProps={MODAL_VARIANTS[1].modalProps}>
      {MODAL_VARIANTS[1].children}
    </AutoOpenModal>
  ),
};

export const Bootstrap__LargeSize = {
  name: '🔵 Bootstrap — Large Size',
  render: () => (
    <AutoOpenModal ModalComponent={BootstrapModal} modalProps={MODAL_VARIANTS[2].modalProps}>
      {MODAL_VARIANTS[2].children}
    </AutoOpenModal>
  ),
};

export const Chakra__LargeSize = {
  name: '🟣 Chakra — Large Size',
  render: () => (
    <AutoOpenModal ModalComponent={ChakraModal} modalProps={MODAL_VARIANTS[2].modalProps}>
      {MODAL_VARIANTS[2].children}
    </AutoOpenModal>
  ),
};

export const Bootstrap__ExtraLargeSize = {
  name: '🔵 Bootstrap — Extra Large Size',
  render: () => (
    <AutoOpenModal ModalComponent={BootstrapModal} modalProps={MODAL_VARIANTS[3].modalProps}>
      {MODAL_VARIANTS[3].children}
    </AutoOpenModal>
  ),
};

export const Chakra__ExtraLargeSize = {
  name: '🟣 Chakra — Extra Large Size',
  render: () => (
    <AutoOpenModal ModalComponent={ChakraModal} modalProps={MODAL_VARIANTS[3].modalProps}>
      {MODAL_VARIANTS[3].children}
    </AutoOpenModal>
  ),
};

export const Bootstrap__Fullscreen = {
  name: '🔵 Bootstrap — Fullscreen',
  render: () => (
    <AutoOpenModal ModalComponent={BootstrapModal} modalProps={MODAL_VARIANTS[4].modalProps}>
      {MODAL_VARIANTS[4].children}
    </AutoOpenModal>
  ),
};

export const Chakra__Fullscreen = {
  name: '🟣 Chakra — Fullscreen',
  render: () => (
    <AutoOpenModal ModalComponent={ChakraModal} modalProps={MODAL_VARIANTS[4].modalProps}>
      {MODAL_VARIANTS[4].children}
    </AutoOpenModal>
  ),
};

export const Bootstrap__WithIcon = {
  name: '🔵 Bootstrap — With Icon',
  render: () => (
    <AutoOpenModal ModalComponent={BootstrapModal} modalProps={MODAL_VARIANTS[5].modalProps}>
      {MODAL_VARIANTS[5].children}
    </AutoOpenModal>
  ),
};

export const Chakra__WithIcon = {
  name: '🟣 Chakra — With Icon',
  render: () => (
    <AutoOpenModal ModalComponent={ChakraModal} modalProps={MODAL_VARIANTS[5].modalProps}>
      {MODAL_VARIANTS[5].children}
    </AutoOpenModal>
  ),
};

export const Bootstrap__DangerVariant = {
  name: '🔵 Bootstrap — Danger Variant',
  render: () => (
    <AutoOpenModal ModalComponent={BootstrapModal} modalProps={MODAL_VARIANTS[6].modalProps}>
      {MODAL_VARIANTS[6].children}
    </AutoOpenModal>
  ),
};

export const Chakra__DangerVariant = {
  name: '🟣 Chakra — Danger Variant',
  render: () => (
    <AutoOpenModal ModalComponent={ChakraModal} modalProps={MODAL_VARIANTS[6].modalProps}>
      {MODAL_VARIANTS[6].children}
    </AutoOpenModal>
  ),
};

export const Bootstrap__LoadingState = {
  name: '🔵 Bootstrap — Loading State',
  render: () => (
    <AutoOpenModal ModalComponent={BootstrapModal} modalProps={MODAL_VARIANTS[7].modalProps}>
      {MODAL_VARIANTS[7].children}
    </AutoOpenModal>
  ),
};

export const Chakra__LoadingState = {
  name: '🟣 Chakra — Loading State',
  render: () => (
    <AutoOpenModal ModalComponent={ChakraModal} modalProps={MODAL_VARIANTS[7].modalProps}>
      {MODAL_VARIANTS[7].children}
    </AutoOpenModal>
  ),
};

export const Bootstrap__DisabledSubmit = {
  name: '🔵 Bootstrap — Disabled Submit',
  render: () => (
    <AutoOpenModal ModalComponent={BootstrapModal} modalProps={MODAL_VARIANTS[8].modalProps}>
      {MODAL_VARIANTS[8].children}
    </AutoOpenModal>
  ),
};

export const Chakra__DisabledSubmit = {
  name: '🟣 Chakra — Disabled Submit',
  render: () => (
    <AutoOpenModal ModalComponent={ChakraModal} modalProps={MODAL_VARIANTS[8].modalProps}>
      {MODAL_VARIANTS[8].children}
    </AutoOpenModal>
  ),
};

export const Bootstrap__NoHeader = {
  name: '🔵 Bootstrap — No Header',
  render: () => (
    <AutoOpenModal ModalComponent={BootstrapModal} modalProps={MODAL_VARIANTS[9].modalProps}>
      {MODAL_VARIANTS[9].children}
    </AutoOpenModal>
  ),
};

export const Chakra__NoHeader = {
  name: '🟣 Chakra — No Header',
  render: () => (
    <AutoOpenModal ModalComponent={ChakraModal} modalProps={MODAL_VARIANTS[9].modalProps}>
      {MODAL_VARIANTS[9].children}
    </AutoOpenModal>
  ),
};

export const Bootstrap__CustomFooter = {
  name: '🔵 Bootstrap — Custom Footer',
  render: () => (
    <AutoOpenModal ModalComponent={BootstrapModal} modalProps={MODAL_VARIANTS[10].modalProps}>
      {MODAL_VARIANTS[10].children}
    </AutoOpenModal>
  ),
};

export const Chakra__CustomFooter = {
  name: '🟣 Chakra — Custom Footer',
  render: () => (
    <AutoOpenModal ModalComponent={ChakraModal} modalProps={MODAL_VARIANTS[10].modalProps}>
      {MODAL_VARIANTS[10].children}
    </AutoOpenModal>
  ),
};

export const Bootstrap__ScrollableContent = {
  name: '🔵 Bootstrap — Scrollable Content',
  render: () => (
    <AutoOpenModal ModalComponent={BootstrapModal} modalProps={MODAL_VARIANTS[11].modalProps}>
      {MODAL_VARIANTS[11].children}
    </AutoOpenModal>
  ),
};

export const Chakra__ScrollableContent = {
  name: '🟣 Chakra — Scrollable Content',
  render: () => (
    <AutoOpenModal ModalComponent={ChakraModal} modalProps={MODAL_VARIANTS[11].modalProps}>
      {MODAL_VARIANTS[11].children}
    </AutoOpenModal>
  ),
};

export const Bootstrap__NotCentered = {
  name: '🔵 Bootstrap — Not Centered',
  render: () => (
    <AutoOpenModal ModalComponent={BootstrapModal} modalProps={MODAL_VARIANTS[12].modalProps}>
      {MODAL_VARIANTS[12].children}
    </AutoOpenModal>
  ),
};

export const Chakra__NotCentered = {
  name: '🟣 Chakra — Not Centered',
  render: () => (
    <AutoOpenModal ModalComponent={ChakraModal} modalProps={MODAL_VARIANTS[12].modalProps}>
      {MODAL_VARIANTS[12].children}
    </AutoOpenModal>
  ),
};

export const Bootstrap__InfoVariant = {
  name: '🔵 Bootstrap — Info Variant',
  render: () => (
    <AutoOpenModal ModalComponent={BootstrapModal} modalProps={MODAL_VARIANTS[13].modalProps}>
      {MODAL_VARIANTS[13].children}
    </AutoOpenModal>
  ),
};

export const Chakra__InfoVariant = {
  name: '🟣 Chakra — Info Variant',
  render: () => (
    <AutoOpenModal ModalComponent={ChakraModal} modalProps={MODAL_VARIANTS[13].modalProps}>
      {MODAL_VARIANTS[13].children}
    </AutoOpenModal>
  ),
};

export const Bootstrap__WarningVariant = {
  name: '🔵 Bootstrap — Warning Variant',
  render: () => (
    <AutoOpenModal ModalComponent={BootstrapModal} modalProps={MODAL_VARIANTS[14].modalProps}>
      {MODAL_VARIANTS[14].children}
    </AutoOpenModal>
  ),
};

export const Chakra__WarningVariant = {
  name: '🟣 Chakra — Warning Variant',
  render: () => (
    <AutoOpenModal ModalComponent={ChakraModal} modalProps={MODAL_VARIANTS[14].modalProps}>
      {MODAL_VARIANTS[14].children}
    </AutoOpenModal>
  ),
};

export const Bootstrap__SuccessVariant = {
  name: '🔵 Bootstrap — Success Variant',
  render: () => (
    <AutoOpenModal ModalComponent={BootstrapModal} modalProps={MODAL_VARIANTS[15].modalProps}>
      {MODAL_VARIANTS[15].children}
    </AutoOpenModal>
  ),
};

export const Chakra__SuccessVariant = {
  name: '🟣 Chakra — Success Variant',
  render: () => (
    <AutoOpenModal ModalComponent={ChakraModal} modalProps={MODAL_VARIANTS[15].modalProps}>
      {MODAL_VARIANTS[15].children}
    </AutoOpenModal>
  ),
};

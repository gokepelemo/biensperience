import { useState } from 'react';
import SuccessModal from '../../components/SuccessModal/SuccessModal';
import { Button } from '../../components/design-system';

export default {
  title: 'Components/Modals/Success Dialog',
  component: SuccessModal,
  // Note: MemoryRouter is provided globally by Storybook preview.js
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
Success modal for celebrating successful form submissions.
Matches the Storybook SuccessModal design pattern with:
- Large success checkmark icon in green circle
- Bold "Success!" title
- Message describing what was created
- Entity name displayed in bold
- "View [Entity]" button to navigate to the created resource
- "Create Another" button to reset the form
        `,
      },
    },
  },
  argTypes: {
    title: { control: 'text', description: 'Success title (e.g., "Success!", "Experience Created!")' },
    message: { control: 'text', description: 'Success message describing what was created' },
    entityName: { control: 'text', description: 'Name of the created entity (displayed in bold)' },
    entityType: { control: 'text', description: 'Type of entity (e.g., "experience", "destination")' },
    entityId: { control: 'text', description: 'ID of the created entity for navigation' },
    continueText: { control: 'text', description: 'Text for the continue button (default: "Continue")' },
    showViewButton: { control: 'boolean', description: 'Show the "Create Another" button' },
  },
};

// Experience Created
export const ExperienceCreated = {
  render: (args) => {
    const [show, setShow] = useState(false);
    return (
      <>
        <Button variant="success" onClick={() => setShow(true)}>
          Show Success Modal
        </Button>
        <SuccessModal
          {...args}
          show={show}
          onClose={() => {
            setShow(false);
            alert('Form reset for creating another experience!');
          }}
        />
      </>
    );
  },
  args: {
    title: 'Experience Created!',
    message: 'Your experience has been created successfully',
    entityName: 'Cherry Blossom Viewing in Ueno Park',
    entityType: 'experience',
    entityId: '64f1234567890abcdef12345',
  },
};

// Destination Created
export const DestinationCreated = {
  render: (args) => {
    const [show, setShow] = useState(false);
    return (
      <>
        <Button variant="success" onClick={() => setShow(true)}>
          Show Success Modal
        </Button>
        <SuccessModal
          {...args}
          show={show}
          onClose={() => {
            setShow(false);
            alert('Form reset for creating another destination!');
          }}
        />
      </>
    );
  },
  args: {
    title: 'Destination Created!',
    message: 'Your destination has been created successfully',
    entityName: 'Tokyo, Japan',
    entityType: 'destination',
    entityId: '64f1234567890abcdef67890',
  },
};

// Simple Success (no entity)
export const SimpleSuccess = {
  render: (args) => {
    const [show, setShow] = useState(false);
    return (
      <>
        <Button variant="success" onClick={() => setShow(true)}>
          Show Success Modal
        </Button>
        <SuccessModal
          {...args}
          show={show}
          onClose={() => setShow(false)}
        />
      </>
    );
  },
  args: {
    title: 'Success!',
    message: 'Your changes have been saved successfully',
    showViewButton: false,
  },
};

// Profile Updated
export const ProfileUpdated = {
  render: (args) => {
    const [show, setShow] = useState(false);
    return (
      <>
        <Button variant="success" onClick={() => setShow(true)}>
          Show Success Modal
        </Button>
        <SuccessModal
          {...args}
          show={show}
          onClose={() => setShow(false)}
        />
      </>
    );
  },
  args: {
    title: 'Profile Updated!',
    message: 'Your profile has been updated successfully',
    entityName: 'John Doe',
    continueText: 'Continue',
    showViewButton: false,
  },
};

// Plan Created
export const PlanCreated = {
  render: (args) => {
    const [show, setShow] = useState(false);
    return (
      <>
        <Button variant="success" onClick={() => setShow(true)}>
          Show Success Modal
        </Button>
        <SuccessModal
          {...args}
          show={show}
          onClose={() => {
            setShow(false);
            alert('Navigating to plan...');
          }}
        />
      </>
    );
  },
  args: {
    title: 'You\'re Planning This!',
    message: 'You\'ve added this experience to your plans',
    entityName: 'Hiking Mount Fuji',
    entityType: 'experience',
    entityId: '64f1234567890abcdef11111',
    showViewButton: false,
  },
};

// Custom Navigation
export const CustomNavigation = {
  render: (args) => {
    const [show, setShow] = useState(false);
    return (
      <>
        <Button variant="success" onClick={() => setShow(true)}>
          Show Success Modal
        </Button>
        <SuccessModal
          {...args}
          show={show}
          onClose={() => setShow(false)}
        />
      </>
    );
  },
  args: {
    title: 'Photo Uploaded!',
    message: 'Your photo has been uploaded successfully',
    entityName: 'sunset_tokyo.jpg',
    navigateTo: '/profile/photos',
    continueText: 'View My Photos',
    showViewButton: false,
  },
};

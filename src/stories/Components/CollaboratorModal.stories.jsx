import React, { useState } from 'react';
import CollaboratorModal from '../../views/SingleExperience/components/CollaboratorModal';

export default {
  title: 'Components/CollaboratorModal',
  component: CollaboratorModal,
};

const mockCollaborators = [
  { _id: 'u1', name: 'Alice Johnson', email: 'alice@example.com' },
  { _id: 'u2', name: 'Bob Smith', email: 'bob@example.com' },
];

const Template = (args) => {
  const [show, setShow] = useState(true);

  return (
    <div style={{ padding: 20 }}>
      <button onClick={() => setShow(true)}>Open Modal</button>

      {/* Light mode example */}
      <div style={{ marginTop: 16 }}>
        <CollaboratorModal
          {...args}
          show={show}
          onHide={() => setShow(false)}
        />
      </div>
    </div>
  );
};

export const Default = Template.bind({});
Default.args = {
  onSearch: () => {},
  onAddCollaborators: () => {},
  onRemoveCollaborator: () => {},
  onSendEmailInvite: async (email, name) => {
    // simulate network
    return new Promise((resolve) => setTimeout(resolve, 600));
  },
  context: 'experience',
  searchResults: [],
  selectedCollaborators: [],
  existingCollaborators: mockCollaborators,
  removedCollaborators: [],
  experienceName: 'Cappadocia Hot Air Balloons',
  destinationName: 'Cappadocia, Türkiye',
};

export const DarkMode = (args) => {
  const [show, setShow] = useState(true);
  return (
    <div data-theme="dark" style={{ padding: 20, background: 'var(--color-bg-primary)' }}>
      <button onClick={() => setShow(true)} style={{ marginBottom: 12 }}>Open Modal (dark)</button>
      <CollaboratorModal
        {...args}
        show={show}
        onHide={() => setShow(false)}
      />
    </div>
  );
};

DarkMode.args = { ...Default.args };

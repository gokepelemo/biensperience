import UsersListDisplay from '../components/UsersListDisplay/UsersListDisplay';

export default {
  title: 'Components/UsersListDisplay',
  component: UsersListDisplay,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Displays an owner and collaborators as overlapping avatars with an optional count message. Includes a loading state that reserves space with animated placeholders to prevent layout shifts.',
      },
    },
  },
  argTypes: {
    size: { control: { type: 'select' }, options: ['sm', 'md', 'lg', 'xl'], description: 'Avatar size' },
    maxVisible: { control: { type: 'number' }, description: 'Maximum visible avatars before +N badge' },
    showMessage: { control: 'boolean', description: 'Show the collaborators count message' },
    showHeading: { control: 'boolean', description: 'Show section heading' },
    loading: { control: 'boolean', description: 'Render loading placeholders' },
    reserveSpace: { control: 'boolean', description: 'Reserve space when no users' },
    messageKey: { control: 'text', description: 'Message key for lang constants (e.g., PlanningExperience)' },
  },
};

const owner = { _id: 'u1', name: 'Alice Example' };
const users = [
  { _id: 'u2', name: 'Bob' },
  { _id: 'u3', name: 'Charlie' },
  { _id: 'u4', name: 'Diana' },
  { _id: 'u5', name: 'Evan' },
  { _id: 'u6', name: 'Faye' },
  { _id: 'u7', name: 'Gio' },
  { _id: 'u8', name: 'Hana' },
];

export const LoadingState = {
  args: {
    owner,
    users,
    loading: true,
    size: 'md',
    maxVisible: 5,
    showMessage: true,
    showHeading: true,
    messageKey: 'PlanningExperience',
  },
};

export const OwnerOnly = {
  args: {
    owner,
    users: [],
    size: 'md',
    showMessage: false,
    showHeading: true,
  },
};

export const WithUsers = {
  args: {
    owner,
    users: users.slice(0, 3),
    size: 'md',
    maxVisible: 7,
    showMessage: true,
  },
};

export const ManyUsersOverflow = {
  args: {
    owner,
    users,
    size: 'md',
    maxVisible: 4,
    showMessage: true,
    messageKey: 'PlanningExperience',
  },
};

export const ReserveSpaceEmpty = {
  args: {
    owner: null,
    users: [],
    reserveSpace: true,
    showHeading: true,
  },
};

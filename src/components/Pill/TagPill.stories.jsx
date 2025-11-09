import React from 'react';
import TagPill from './TagPill';

export default {
  title: 'Components/TagPill',
  component: TagPill,
  parameters: {
    docs: {
      description: {
        component: 'Rounded gradient pill used for experience tags, planned-date badges and favorite markers. Supports removable icon and size variants.',
      },
    },
  },
};

export const Default = {
  render: () => (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
      <TagPill color="primary">Adventure</TagPill>
      <TagPill color="info" gradient>Planned: Jun 21</TagPill>
      <TagPill color="neutral">Local</TagPill>
    </div>
  )
};

export const Removable = {
  render: () => (
    <div style={{ display: 'flex', gap: '0.5rem' }}>
      <TagPill removable onRemove={() => alert('removed')} color="primary">Remove me</TagPill>
      <TagPill removable color="warning">Dismiss</TagPill>
    </div>
  )
};

export const Playground = {
  args: {
    children: 'Interactive Tag',
    color: 'primary',
    gradient: true,
    rounded: true,
    removable: false,
    size: 'md'
  },
  argTypes: {
    color: { control: { type: 'select', options: ['primary','success','warning','danger','info','neutral'] } },
    gradient: { control: 'boolean' },
    rounded: { control: 'boolean' },
    removable: { control: 'boolean' },
    size: { control: { type: 'radio', options: ['sm','md','lg'] } },
    children: { control: 'text' }
  },
  render: (args) => (
    <div style={{ padding: 16 }}>
      <TagPill {...args} onRemove={() => alert('removed')}>{args.children}</TagPill>
    </div>
  )
};

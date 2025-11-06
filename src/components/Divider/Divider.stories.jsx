import React from 'react';
import Divider from './Divider';

export default {
  title: 'Components/Divider',
  component: Divider,
  argTypes: {
    shadow: { control: { type: 'radio' }, options: ['none','sm','md','lg'] }
  },
  parameters: {
    docs: {
      description: {
        component: 'Opt-in divider with centered label and tokenized shadows (none/sm/md/lg). Uses var(--color-border-light) and var(--color-bg-primary).',
      },
    },
  },
};

export const Playground = (args) => (
  <div style={{ background: 'var(--color-bg-secondary)', padding: '2rem' }}>
    <div style={{ background: 'var(--color-bg-primary)', padding: '2rem', borderRadius: 'var(--radius-lg)' }}>
      <Divider {...args} />
    </div>
  </div>
);
Playground.args = { label: 'Or continue with', shadow: 'md' };

export const Variants = () => (
  <div style={{ display: 'grid', gap: '1.5rem' }}>
    <Divider label="No shadow" shadow="none" />
    <Divider label="Small shadow" shadow="sm" />
    <Divider label="Medium shadow" shadow="md" />
    <Divider label="Large shadow" shadow="lg" />
  </div>
);

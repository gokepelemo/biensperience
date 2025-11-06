import React, { useState } from 'react';
import Checkbox from './Checkbox';

export default {
  title: 'Components/Checkbox',
  component: Checkbox,
  parameters: {
    docs: {
      description: {
        component: 'Tokenized checkbox using design tokens for size, radius, colors, and focus ring. Heights: 20/24/28px by size. Radius: var(--radius-md). Checked background: var(--gradient-primary).',
      },
    },
  },
  argTypes: {
    size: { control: { type: 'radio' }, options: ['sm','md','lg'] },
    disabled: { control: 'boolean' }
  }
};

export const Playground = (args) => {
  const [checked, setChecked] = useState(false);
  return (
    <Checkbox
      id="demo"
      {...args}
      checked={checked}
      onChange={(e) => setChecked(e.target.checked)}
      label={args.label || 'Remember me'}
    />
  );
};
Playground.args = { size: 'md' };

export const States = () => (
  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
    <Checkbox id="c1" defaultChecked label="Default checked" />
    <Checkbox id="c2" label="Default" />
    <Checkbox id="c3" disabled label="Disabled" />
  </div>
);

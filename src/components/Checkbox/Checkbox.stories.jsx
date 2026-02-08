import React, { useState } from 'react';
import Checkbox from './Checkbox';

export default {
  title: 'Components/Checkbox',
  component: Checkbox,
  parameters: {
    docs: {
      description: {
        component:
          'Chakra-inspired checkbox with three variants (outline, subtle, solid), ' +
          'four color schemes, three sizes, and indeterminate support. ' +
          'Uses design tokens for consistent theming.',
      },
    },
  },
  argTypes: {
    size: { control: { type: 'radio' }, options: ['sm', 'md', 'lg'] },
    variant: { control: { type: 'radio' }, options: ['outline', 'subtle', 'solid'] },
    colorScheme: { control: { type: 'radio' }, options: ['primary', 'success', 'warning', 'danger'] },
    disabled: { control: 'boolean' },
    indeterminate: { control: 'boolean' },
  },
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
Playground.args = { size: 'md', variant: 'outline' };

export const Variants = () => (
  <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
    {['outline', 'subtle', 'solid'].map((v) => (
      <div key={v} style={{ textAlign: 'center' }}>
        <div style={{ marginBottom: '0.5rem', fontWeight: 600 }}>{v}</div>
        <Checkbox id={`var-${v}`} variant={v} defaultChecked label="Checkbox" />
      </div>
    ))}
  </div>
);

export const Sizes = () => (
  <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
    {['sm', 'md', 'lg'].map((s) => (
      <Checkbox key={s} id={`size-${s}`} size={s} defaultChecked label={s} />
    ))}
  </div>
);

export const ColorSchemes = () => (
  <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
    {['primary', 'success', 'warning', 'danger'].map((c) => (
      <Checkbox key={c} id={`color-${c}`} colorScheme={c} defaultChecked label={c} />
    ))}
  </div>
);

export const States = () => (
  <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
    <Checkbox id="c1" defaultChecked label="Checked" />
    <Checkbox id="c2" label="Unchecked" />
    <Checkbox id="c3" disabled label="Disabled" />
    <Checkbox id="c4" disabled defaultChecked label="Disabled checked" />
    <Checkbox id="c5" indeterminate label="Indeterminate" />
  </div>
);

import { useState } from 'react';
import Toggle, { ToggleGroup } from './Toggle';

export default {
  title: 'Components/Toggle',
  component: Toggle,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'A flexible toggle/switch component with multiple variants, sizes, and label options.',
      },
    },
  },
  argTypes: {
    checked: {
      control: 'boolean',
      description: 'Whether the toggle is checked',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the toggle is disabled',
    },
    size: {
      control: 'select',
      options: ['xs', 'sm', 'md', 'lg', 'xl'],
      description: 'Size of the toggle',
    },
    variant: {
      control: 'select',
      options: ['default', 'primary', 'success', 'outline', 'filled', 'minimal'],
      description: 'Visual variant of the toggle',
    },
    showIcons: {
      control: 'boolean',
      description: 'Whether to show check/x icons inside the toggle',
    },
    label: {
      control: 'text',
      description: 'Label text for the toggle',
    },
    labelPosition: {
      control: 'select',
      options: ['left', 'right'],
      description: 'Position of the label relative to toggle',
    },
    description: {
      control: 'text',
      description: 'Description text below the label',
    },
  },
};

// Interactive toggle that manages its own state
const InteractiveToggle = (args) => {
  const [checked, setChecked] = useState(args.checked || false);
  return <Toggle {...args} checked={checked} onChange={setChecked} />;
};

// Default story
export const Default = {
  render: InteractiveToggle,
  args: {
    checked: false,
    size: 'md',
    variant: 'default',
  },
};

// All Sizes
export const Sizes = {
  render: () => {
    const [states, setStates] = useState({
      xs: false,
      sm: false,
      md: true,
      lg: true,
      xl: false,
    });

    const handleChange = (size) => (checked) => {
      setStates((prev) => ({ ...prev, [size]: checked }));
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <h3 style={{ margin: 0, color: 'var(--color-text-primary)' }}>Toggle Sizes</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <Toggle size="xs" checked={states.xs} onChange={handleChange('xs')} />
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>XS</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <Toggle size="sm" checked={states.sm} onChange={handleChange('sm')} />
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>SM</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <Toggle size="md" checked={states.md} onChange={handleChange('md')} />
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>MD</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <Toggle size="lg" checked={states.lg} onChange={handleChange('lg')} />
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>LG</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <Toggle size="xl" checked={states.xl} onChange={handleChange('xl')} />
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>XL</span>
          </div>
        </div>
      </div>
    );
  },
};

// All Variants
export const Variants = {
  render: () => {
    const [states, setStates] = useState({
      default: true,
      primary: true,
      success: true,
      outline: true,
      filled: true,
      minimal: true,
    });

    const handleChange = (variant) => (checked) => {
      setStates((prev) => ({ ...prev, [variant]: checked }));
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <h3 style={{ margin: 0, color: 'var(--color-text-primary)' }}>Toggle Variants</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '24px' }}>
          {Object.keys(states).map((variant) => (
            <div key={variant} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <Toggle
                variant={variant}
                size="lg"
                checked={states[variant]}
                onChange={handleChange(variant)}
              />
              <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)', textTransform: 'capitalize' }}>
                {variant}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  },
};

// With Icons
export const WithIcons = {
  render: () => {
    const [states, setStates] = useState({
      default: false,
      primary: true,
      success: false,
    });

    const handleChange = (key) => (checked) => {
      setStates((prev) => ({ ...prev, [key]: checked }));
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <h3 style={{ margin: 0, color: 'var(--color-text-primary)' }}>Toggles with Icons</h3>
        <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
          <Toggle
            variant="default"
            size="lg"
            showIcons
            checked={states.default}
            onChange={handleChange('default')}
          />
          <Toggle
            variant="primary"
            size="lg"
            showIcons
            checked={states.primary}
            onChange={handleChange('primary')}
          />
          <Toggle
            variant="success"
            size="lg"
            showIcons
            checked={states.success}
            onChange={handleChange('success')}
          />
        </div>
      </div>
    );
  },
};

// Disabled States
export const DisabledStates = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <h3 style={{ margin: 0, color: 'var(--color-text-primary)' }}>Disabled Toggles</h3>
      <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <Toggle disabled checked={false} size="lg" />
          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Disabled Off</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <Toggle disabled checked={true} size="lg" />
          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Disabled On</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <Toggle disabled checked={false} size="lg" showIcons />
          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Disabled with Icons</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <Toggle disabled checked={true} size="lg" showIcons />
          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Disabled On with Icons</span>
        </div>
      </div>
    </div>
  ),
};

// With Labels
export const WithLabels = {
  render: () => {
    const [states, setStates] = useState({
      labelRight: true,
      labelLeft: false,
      withDescription: true,
      leftWithDescription: false,
    });

    const handleChange = (key) => (checked) => {
      setStates((prev) => ({ ...prev, [key]: checked }));
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <h3 style={{ margin: 0, color: 'var(--color-text-primary)' }}>Toggles with Labels</h3>

        <ToggleGroup>
          <Toggle
            label="Main Text"
            labelPosition="right"
            checked={states.labelRight}
            onChange={handleChange('labelRight')}
          />
          <Toggle
            label="Main Text"
            labelPosition="left"
            checked={states.labelLeft}
            onChange={handleChange('labelLeft')}
          />
        </ToggleGroup>

        <h4 style={{ margin: 0, color: 'var(--color-text-secondary)' }}>With Description</h4>

        <ToggleGroup>
          <Toggle
            label="Main Text"
            description="This is a supporting text."
            labelPosition="right"
            checked={states.withDescription}
            onChange={handleChange('withDescription')}
          />
          <Toggle
            label="Main Text"
            description="This is a supporting text."
            labelPosition="left"
            checked={states.leftWithDescription}
            onChange={handleChange('leftWithDescription')}
          />
        </ToggleGroup>
      </div>
    );
  },
};

// Toggle Only Grid (matches the design reference)
export const ToggleOnlyGrid = {
  render: () => {
    const sizes = ['xs', 'sm', 'md', 'lg', 'xl'];
    const variants = ['default', 'primary', 'success', 'outline', 'filled', 'minimal'];

    // Create state for all toggles
    const [states, setStates] = useState(() => {
      const initial = {};
      sizes.forEach((size) => {
        variants.forEach((variant) => {
          initial[`${size}-${variant}-off`] = false;
          initial[`${size}-${variant}-on`] = true;
        });
      });
      return initial;
    });

    const handleChange = (key) => (checked) => {
      setStates((prev) => ({ ...prev, [key]: checked }));
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <h3 style={{ margin: 0, color: 'var(--color-text-primary)' }}>Toggle Only</h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${variants.length * 2}, auto)`,
            gap: '16px',
            padding: '24px',
            border: '2px dashed var(--color-border-medium)',
            borderRadius: '12px',
            justifyContent: 'start',
          }}
        >
          {sizes.map((size) => (
            variants.map((variant) => (
              <>
                <Toggle
                  key={`${size}-${variant}-off`}
                  size={size}
                  variant={variant}
                  checked={states[`${size}-${variant}-off`]}
                  onChange={handleChange(`${size}-${variant}-off`)}
                />
                <Toggle
                  key={`${size}-${variant}-on`}
                  size={size}
                  variant={variant}
                  checked={states[`${size}-${variant}-on`]}
                  onChange={handleChange(`${size}-${variant}-on`)}
                />
              </>
            ))
          ))}
        </div>
      </div>
    );
  },
};

// Toggle + Text Grid (matches the design reference)
export const ToggleWithTextGrid = {
  render: () => {
    const [states, setStates] = useState({
      row1: [false, true, false, true, false, true],
      row2: [true, false, true, false, true, false],
      row3: [false, true, false, true, false, true],
      row4: [true, true, false, false, true, true],
    });

    const handleChange = (row, index) => (checked) => {
      setStates((prev) => {
        const newRow = [...prev[row]];
        newRow[index] = checked;
        return { ...prev, [row]: newRow };
      });
    };

    const positions = ['left', 'right'];
    const variants = ['default', 'primary', 'success'];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <h3 style={{ margin: 0, color: 'var(--color-text-primary)' }}>Toggle + Text</h3>

        {/* Simple labels */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }}>
          {positions.map((position) =>
            variants.map((variant, vi) => (
              <Toggle
                key={`simple-${position}-${variant}`}
                label="Main Text"
                labelPosition={position}
                variant={variant}
                checked={states.row1[vi + (position === 'right' ? 3 : 0)]}
                onChange={handleChange('row1', vi + (position === 'right' ? 3 : 0))}
              />
            ))
          )}
        </div>

        {/* With icons */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }}>
          {positions.map((position) =>
            variants.map((variant, vi) => (
              <Toggle
                key={`icons-${position}-${variant}`}
                label="Main Text"
                labelPosition={position}
                variant={variant}
                showIcons
                checked={states.row2[vi + (position === 'right' ? 3 : 0)]}
                onChange={handleChange('row2', vi + (position === 'right' ? 3 : 0))}
              />
            ))
          )}
        </div>

        {/* With description */}
        <h4 style={{ margin: 0, color: 'var(--color-text-secondary)' }}>With Description</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
          {variants.map((variant, vi) => (
            <Toggle
              key={`desc-left-${variant}`}
              label="Main Text"
              description="This is a supporting text."
              labelPosition="left"
              variant={variant}
              checked={states.row3[vi]}
              onChange={handleChange('row3', vi)}
            />
          ))}
          {variants.map((variant, vi) => (
            <Toggle
              key={`desc-right-${variant}`}
              label="Main Text"
              description="This is a supporting text."
              labelPosition="right"
              variant={variant}
              checked={states.row4[vi]}
              onChange={handleChange('row4', vi)}
            />
          ))}
        </div>
      </div>
    );
  },
};

// Real-world Usage Examples
export const RealWorldExamples = {
  render: () => {
    const [settings, setSettings] = useState({
      notifications: true,
      darkMode: false,
      autoSave: true,
      twoFactor: false,
      apiAccess: true,
      marketing: false,
    });

    const handleChange = (key) => (checked) => {
      setSettings((prev) => ({ ...prev, [key]: checked }));
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '400px' }}>
        <h3 style={{ margin: 0, color: 'var(--color-text-primary)' }}>Settings Panel</h3>

        <div
          style={{
            background: 'var(--color-bg-secondary)',
            padding: '24px',
            borderRadius: '12px',
            border: '1px solid var(--color-border-light)',
          }}
        >
          <ToggleGroup>
            <Toggle
              label="Push Notifications"
              description="Receive notifications for new updates"
              variant="success"
              checked={settings.notifications}
              onChange={handleChange('notifications')}
            />
            <Toggle
              label="Dark Mode"
              description="Use dark theme across the app"
              variant="primary"
              checked={settings.darkMode}
              onChange={handleChange('darkMode')}
            />
            <Toggle
              label="Auto-save"
              description="Automatically save your work"
              variant="success"
              checked={settings.autoSave}
              onChange={handleChange('autoSave')}
            />
            <Toggle
              label="Two-Factor Authentication"
              description="Add an extra layer of security"
              variant="success"
              checked={settings.twoFactor}
              onChange={handleChange('twoFactor')}
            />
            <Toggle
              label="API Access"
              description="Enable programmatic access to your account"
              variant="primary"
              checked={settings.apiAccess}
              onChange={handleChange('apiAccess')}
            />
            <Toggle
              label="Marketing Emails"
              description="Receive news and promotional content"
              variant="default"
              checked={settings.marketing}
              onChange={handleChange('marketing')}
            />
          </ToggleGroup>
        </div>
      </div>
    );
  },
};

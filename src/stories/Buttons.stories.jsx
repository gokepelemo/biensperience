import React from 'react';
import { Button } from '../components/design-system';
import '../styles/utilities.scss';
import '../styles/design-tokens.css';
import '../views/SingleExperience/SingleExperience.module.scss'; // Plan button styles

export default {
  title: 'Components/Forms/Buttons',
  parameters: {
    layout: 'centered',
    docs: {
      page: () => (
        <div style={{ maxWidth: 920, margin: '0 auto', padding: '1rem' }}>
          <h1 style={{ marginBottom: '0.5rem' }}>Buttons</h1>
          <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
            Unified button styles and patterns, built on design tokens for consistent theming and dark mode support.
          </p>
          <hr style={{ margin: '1.25rem 0' }} />

          <h2 style={{ marginBottom: '0.5rem' }}>Design Tokens</h2>
          <ul>
            <li><code>--gradient-primary</code> – Primary CTA gradient</li>
            <li><code>--color-primary</code> – Brand color for borders/accents</li>
            <li><code>--radius-full</code> – Fully rounded CTA buttons</li>
            <li><code>--shadow-md</code> / <code>--shadow-lg</code> – Depth for emphasis</li>
          </ul>

          <h2 style={{ marginBottom: '0.5rem' }}>Variants</h2>
          <ul>
            <li><strong>Gradient</strong>: .btn-gradient – primary CTAs</li>
            <li><strong>Outline</strong>: .btn-outline-custom – secondary actions</li>
            <li><strong>Bootstrap</strong>: .btn, .btn-outline-* – integrated palette</li>
          </ul>

          <h2 style={{ marginBottom: '0.5rem' }}>Accessibility</h2>
          <ul>
            <li>Min. target size: 44×44px</li>
            <li>Visible focus ring; no color-only state changes</li>
            <li>ARIA labels for icon-only buttons</li>
          </ul>

          <p style={{ marginTop: '1rem', color: 'var(--color-text-muted)' }}>
            Tip: Prefer semantic <code>&lt;button&gt;</code> elements over clickable <code>&lt;div&gt;</code>s for keyboard and screen reader support.
          </p>
        </div>
      ),
      description: {
        component: 'Button utilities from the design system. Includes gradient buttons, outline buttons, and file input styling. All buttons support dark mode and are fully accessible.',
      },
    },
  },
  tags: [],
};

// Gradient Button
export const GradientButton = {
  name: 'Gradient Button',
  render: () => (
    <button className="btn-gradient">
      Primary Action
    </button>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Primary action button with gradient background. Use for main CTAs and important actions. Automatically uses design tokens for consistent styling.',
      },
    },
  },
};

export const GradientButtonWithIcon = {
  name: 'Gradient Button with Icon',
  render: () => (
    <button className="btn-gradient">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 0L10 6L16 8L10 10L8 16L6 10L0 8L6 6L8 0Z" />
      </svg>
      With Icon
    </button>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Gradient button with icon. Icons are automatically spaced with gap utility.',
      },
    },
  },
};

export const GradientButtonDisabled = {
  name: 'Gradient Button (Disabled)',
  render: () => (
    <button className="btn-gradient" disabled>
      Disabled State
    </button>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Disabled state with reduced opacity and no pointer events.',
      },
    },
  },
};

// Outline Button
export const OutlineButton = {
  name: 'Outline Button',
  render: () => (
    <button className="btn-outline-custom">
      Secondary Action
    </button>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Secondary button with outline style. Use for less prominent actions or toggles.',
      },
    },
  },
};

export const OutlineButtonWithIcon = {
  name: 'Outline Button with Icon',
  render: () => (
    <button className="btn-outline-custom">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M2 2h12v12H2z" stroke="currentColor" fill="none" strokeWidth="2" />
      </svg>
      Settings
    </button>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Outline button with icon.',
      },
    },
  },
};

export const OutlineButtonDisabled = {
  name: 'Outline Button (Disabled)',
  render: () => (
    <button className="btn-outline-custom" disabled>
      Disabled State
    </button>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Disabled outline button.',
      },
    },
  },
};

// Bootstrap Button Integration
export const BootstrapPrimary = {
  name: 'Bootstrap Primary',
  render: () => (
    <button className="btn btn-primary">
      Bootstrap Primary
    </button>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Bootstrap primary button with theme customization. Uses purple brand color.',
      },
    },
  },
};

export const BootstrapSecondary = {
  name: 'Bootstrap Secondary',
  render: () => (
    <button className="btn btn-secondary">
      Bootstrap Secondary
    </button>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Bootstrap secondary button with dark mode support. Uses design token colors.',
      },
    },
  },
};

export const BootstrapSuccess = {
  name: 'Bootstrap Success',
  render: () => (
    <button className="btn btn-success">
      Bootstrap Success
    </button>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Bootstrap success button.',
      },
    },
  },
};

export const BootstrapDanger = {
  name: 'Bootstrap Danger',
  render: () => (
    <button className="btn btn-danger">
      Bootstrap Danger
    </button>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Bootstrap danger button for destructive actions.',
      },
    },
  },
};

// Button Sizes
export const ButtonSizes = {
  name: 'Button Sizes',
  render: () => (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
      <button className="btn btn-primary btn-sm">Small</button>
      <button className="btn btn-primary">Default</button>
      <button className="btn btn-primary btn-lg">Large</button>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Button size variants: small, default, and large.',
      },
    },
  },
};

// Button States
export const ButtonStates = {
  name: 'Button States',
  render: () => (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div>
        <h4 style={{ marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>Normal State</h4>
        <button className="btn-gradient">Click Me</button>
      </div>
      <div>
        <h4 style={{ marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>Hover State</h4>
        <button className="btn-gradient" style={{ filter: 'brightness(1.1)' }}>Hover Effect</button>
      </div>
      <div>
        <h4 style={{ marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>Active State</h4>
        <button className="btn-gradient" style={{ filter: 'brightness(0.9)' }}>Active/Pressed</button>
      </div>
      <div>
        <h4 style={{ marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>Disabled State</h4>
        <button className="btn-gradient" disabled>Cannot Click</button>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'All button states: normal, hover, active, and disabled.',
      },
    },
  },
};

// Button Group
export const ButtonGroup = {
  name: 'Button Group',
  render: () => (
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
      <button className="btn-gradient">Save</button>
      <button className="btn-outline-custom">Cancel</button>
      <button className="btn btn-danger">Delete</button>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Common button groupings for forms and actions.',
      },
    },
  },
};

// All Button Variants
export const AllVariants = {
  name: 'All Variants',
  render: () => (
    <div style={{ display: 'grid', gap: '2rem', maxWidth: '600px' }}>
      <div>
        <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem', fontWeight: 600 }}>Design System Buttons</h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button className="btn-gradient">Gradient</button>
          <button className="btn-outline-custom">Outline</button>
        </div>
      </div>
      
      <div>
        <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem', fontWeight: 600 }}>Bootstrap Solid Buttons</h3>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn btn-primary">Primary</button>
          <button className="btn btn-secondary">Secondary</button>
          <button className="btn btn-success">Success</button>
          <button className="btn btn-danger">Danger</button>
        </div>
      </div>

      <div>
        <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem', fontWeight: 600 }}>Bootstrap Outline Buttons</h3>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn btn-outline-primary">Primary</button>
          <button className="btn btn-outline-secondary">Secondary</button>
          <button className="btn btn-outline-success">Success</button>
          <button className="btn btn-outline-danger">Danger</button>
        </div>
      </div>

      <div>
        <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem', fontWeight: 600 }}>Link Buttons</h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button className="btn btn-link">Link Button</button>
          <button className="btn btn-link text-danger">Destructive Link</button>
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Complete showcase of all button variants available in the design system.',
      },
    },
  },
};

// Plan It / Planned Button Pattern
export const PlanItButton = {
  name: 'Plan It Button',
  render: () => {
    const [isPlanned, setIsPlanned] = React.useState(false);
    const [isLoading, setIsLoading] = React.useState(false);
    const [isHovered, setIsHovered] = React.useState(false);

    const handleClick = () => {
      setIsLoading(true);
      setTimeout(() => {
        setIsPlanned(!isPlanned);
        setIsLoading(false);
      }, 500);
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div>
          <h4 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: 600 }}>Interactive Demo</h4>
          <button
            className={`btn btn-sm ${isPlanned ? 'btn-plan-remove' : 'btn-plan-add'} ${isLoading ? 'loading' : ''}`}
            onClick={handleClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            disabled={isLoading}
            style={{ minWidth: '120px' }}
          >
            {isLoading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="spinner-border spinner-border-sm" />
              </span>
            ) : isPlanned ? (
              isHovered ? 'Remove' : 'Planned ✓'
            ) : (
              'Plan It'
            )}
          </button>
          <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
            Click to toggle state. Hover when "Planned" to see removal prompt.
          </p>
        </div>

        <div>
          <h4 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: 600 }}>All States</h4>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <button className="btn btn-sm btn-plan-add">Plan It</button>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>Default</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <button className="btn btn-sm btn-plan-remove">Planned ✓</button>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>Planned</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <button className="btn btn-sm btn-plan-remove">Remove</button>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>Hover</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <button className="btn btn-sm btn-plan-add loading" disabled>
                <span className="spinner-border spinner-border-sm" />
              </button>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>Loading</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <button className="btn btn-sm btn-plan-add" disabled>Plan It</button>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>Disabled</div>
            </div>
          </div>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: `
**Plan It / Planned Button Pattern**

A stateful toggle button used for adding/removing experiences from user plans.

**States:**
- **Plan It** (unplanned): Green success button inviting action
- **Planned ✓** (planned, default): Red danger button showing completion
- **Remove** (planned, hover): Red danger button prompting removal

**Implementation:**
\`\`\`jsx
<button
  className={\`btn btn-sm \${isPlanned ? 'btn-plan-remove' : 'btn-plan-add'}\`}
  onClick={handleToggle}
  onMouseEnter={() => setHovered(true)}
  onMouseLeave={() => setHovered(false)}
>
  {isPlanned ? (isHovered ? 'Remove' : 'Planned ✓') : 'Plan It'}
</button>
\`\`\`

**CSS Classes:**
- \`.btn-plan-add\`: Green success state (unplanned)
- \`.btn-plan-remove\`: Red danger state (planned)
- \`.loading\`: Pulse animation during API calls

**Design Tokens Used:**
- \`--btn-success-bg\`, \`--btn-success-color\`: Plan It state
- \`--btn-danger-bg\`, \`--btn-danger-color\`: Planned/Remove state
- \`--btn-height-sm\`: 36px minimum height
- \`--btn-hover-lift\`: -2px translateY on hover

**Accessibility:**
- Uses \`aria-pressed\` for toggle state
- Uses \`aria-busy\` during loading
- Minimum 44x44px touch target
- Visible focus ring
        `,
      },
    },
  },
};

// Plan Button Variants (Complete Set)
export const PlanButtonVariants = {
  name: 'Plan Button Variants',
  render: () => (
    <div style={{ display: 'grid', gap: '1.5rem', maxWidth: '600px' }}>
      <div>
        <h4 style={{ marginBottom: '0.75rem', fontSize: '0.875rem', fontWeight: 600 }}>Plan Action Buttons</h4>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button className="btn btn-sm btn-plan-add">Plan It</button>
          <button className="btn btn-sm btn-plan-edit">Edit Plan</button>
          <button className="btn btn-sm btn-plan-complete">Complete</button>
          <button className="btn btn-sm btn-plan-remove">Remove</button>
        </div>
      </div>
      <div>
        <h4 style={{ marginBottom: '0.75rem', fontSize: '0.875rem', fontWeight: 600 }}>With Icons</h4>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button className="btn btn-sm btn-plan-add">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style={{ marginRight: '4px' }}>
              <path d="M8 0a1 1 0 011 1v6h6a1 1 0 110 2H9v6a1 1 0 11-2 0V9H1a1 1 0 010-2h6V1a1 1 0 011-1z"/>
            </svg>
            Plan It
          </button>
          <button className="btn btn-sm btn-plan-complete">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style={{ marginRight: '4px' }}>
              <path d="M13.854 3.646a.5.5 0 010 .708l-7 7a.5.5 0 01-.708 0l-3.5-3.5a.5.5 0 11.708-.708L6.5 10.293l6.646-6.647a.5.5 0 01.708 0z"/>
            </svg>
            Complete
          </button>
        </div>
      </div>
      <div>
        <h4 style={{ marginBottom: '0.75rem', fontSize: '0.875rem', fontWeight: 600 }}>Loading States</h4>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button className="btn btn-sm btn-plan-add loading" disabled>
            <span className="spinner-border spinner-border-sm" />
          </button>
          <button className="btn btn-sm btn-plan-remove loading" disabled>
            <span className="spinner-border spinner-border-sm" />
          </button>
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: `
**Complete Plan Button Variants**

All button variants used in the plan management system:

| Class | Purpose | Color |
|-------|---------|-------|
| \`.btn-plan-add\` | Add to plan | Green (success) |
| \`.btn-plan-edit\` | Edit plan item | Blue (info) |
| \`.btn-plan-complete\` | Mark complete | Purple (gradient) |
| \`.btn-plan-remove\` | Remove/delete | Red (danger) |

All variants support:
- Hover lift effect (\`translateY(-2px)\`)
- Shadow enhancement on hover
- Disabled state (0.6 opacity)
- Loading pulse animation
        `,
      },
    },
  },
};

// Dark Mode Demo
export const DarkModeComparison = {
  name: 'Dark Mode Comparison',
  render: () => (
    <div style={{ display: 'grid', gap: '2rem' }}>
      <div style={{ padding: '2rem', background: 'var(--color-bg-primary)', borderRadius: '8px' }}>
        <h4 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>Light Mode</h4>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn-gradient">Gradient</button>
          <button className="btn-outline-custom">Outline</button>
          <button className="btn btn-secondary">Secondary</button>
        </div>
      </div>

      <div style={{ padding: '2rem', background: 'var(--color-bg-secondary)', borderRadius: '8px' }}>
        <h4 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>Dark Mode</h4>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn-gradient">Gradient</button>
          <button className="btn-outline-custom">Outline</button>
          <button className="btn btn-secondary">Secondary</button>
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Buttons automatically adapt to dark mode using design tokens. Secondary button uses proper contrast ratios in both themes.',
      },
    },
  },
};

// Design System Button Component (Recommended)
export const DesignSystemButton = {
  name: 'Design System Button',
  render: () => (
    <div style={{ display: 'grid', gap: '2rem', maxWidth: '700px' }}>
      <div>
        <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
          Button Variants
        </h3>
        <p style={{ marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
          Use the <code>&lt;Button&gt;</code> component from <code>design-system.js</code> for consistent styling.
        </p>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <Button variant="gradient">Gradient</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="tertiary">Tertiary</Button>
          <Button variant="link">Link</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="success">Success</Button>
        </div>
      </div>

      <div>
        <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
          Button Sizes
        </h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <Button variant="gradient" size="sm">Small</Button>
          <Button variant="gradient" size="md">Medium</Button>
          <Button variant="gradient" size="lg">Large</Button>
        </div>
      </div>

      <div>
        <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
          Rounded Buttons
        </h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <Button variant="gradient" rounded>Rounded Gradient</Button>
          <Button variant="outline" rounded>Rounded Outline</Button>
          <Button variant="success" rounded>Rounded Success</Button>
        </div>
      </div>

      <div>
        <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
          Shadow Effect
        </h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <Button variant="gradient" shadow>With Shadow</Button>
          <Button variant="outline" shadow>With Shadow</Button>
        </div>
      </div>

      <div>
        <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
          Disabled State
        </h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <Button variant="gradient" disabled>Disabled Gradient</Button>
          <Button variant="outline" disabled>Disabled Outline</Button>
          <Button variant="danger" disabled>Disabled Danger</Button>
        </div>
      </div>

      <div>
        <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
          Full Width
        </h3>
        <Button variant="gradient" fullWidth>Full Width Button</Button>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: `
**Design System Button Component**

The recommended way to use buttons is through the \`<Button>\` component from \`design-system.js\`.

**Import:**
\`\`\`jsx
import { Button } from '../components/design-system';
\`\`\`

**Props:**
- \`variant\`: 'gradient' | 'outline' | 'tertiary' | 'link' | 'danger' | 'success'
- \`size\`: 'sm' | 'md' | 'lg'
- \`rounded\`: boolean - Pill shape
- \`shadow\`: boolean - Enhanced shadow
- \`disabled\`: boolean
- \`fullWidth\`: boolean - 100% width
- \`matchWidth\`: string | string[] - Calculate consistent width based on text

**Usage:**
\`\`\`jsx
<Button variant="gradient" size="lg" rounded>
  Primary Action
</Button>

<Button variant="outline" onClick={handleClick}>
  Secondary Action
</Button>
\`\`\`
        `,
      },
    },
  },
};

// All Outline Variants
export const OutlineVariants = {
  name: 'Outline Variants',
  render: () => (
    <div style={{ display: 'grid', gap: '2rem', maxWidth: '700px' }}>
      <div>
        <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
          Design System Outline
        </h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <Button variant="outline">Default</Button>
          <Button variant="outline" rounded>Rounded</Button>
          <Button variant="outline" size="sm">Small</Button>
          <Button variant="outline" size="lg">Large</Button>
        </div>
      </div>

      <div>
        <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
          Utility Class (.btn-outline-custom)
        </h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button className="btn-outline-custom">Utility Class</button>
          <button className="btn-outline-custom btn-rounded">Rounded</button>
        </div>
      </div>

      <div>
        <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
          Bootstrap Outline
        </h3>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn btn-outline-primary">Primary</button>
          <button className="btn btn-outline-secondary">Secondary</button>
          <button className="btn btn-outline-success">Success</button>
          <button className="btn btn-outline-danger">Danger</button>
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Comparison of outline button implementations: Design System component, utility class, and Bootstrap.',
      },
    },
  },
};

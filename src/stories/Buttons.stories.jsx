import React from 'react';
import '../styles/utilities.css';
import '../styles/design-tokens.css';

export default {
  title: 'Design System/Buttons',
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

// Dark Mode Demo
export const DarkModeComparison = {
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

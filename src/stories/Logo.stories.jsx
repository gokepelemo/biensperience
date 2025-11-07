import React from 'react';
import BiensperienceLogo from '../components/BiensperienceLogo/BiensperienceLogo';

export default {
  title: 'Design System/Brand/Logo',
  component: BiensperienceLogo,
  parameters: {
    layout: 'centered',
    docs: {
      page: () => (
        <div style={{ maxWidth: 920, margin: '0 auto', padding: '1rem' }}>
          <h1 style={{ marginBottom: '0.5rem' }}>Biensperience Logo</h1>
          <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
            Unified logo component with multiple visual styles, sizes, and animation for loading states.
          </p>
          <hr style={{ margin: '1.25rem 0' }} />

          <h2>Variations</h2>
          <ul>
            <li><strong>clean</strong> – Gradient tile with white plus and subtle shadow</li>
            <li><strong>flat</strong> – Flat gradient, no effects</li>
            <li><strong>soft</strong> – Softer gradient with gentle shadow</li>
            <li><strong>white</strong> – White tile with gradient plus and shimmer</li>
            <li><strong>engine</strong> – Animated loading indicator</li>
          </ul>

          <h2>Sizes</h2>
          <p>Presets: xs (16), sm (24), md (32), lg (48), xl (64), 2xl (96), 3xl (128). Use <code>width</code>/<code>height</code> for custom.</p>

          <h2>Transforms</h2>
          <ul>
            <li>rotate: degrees (e.g. 45)</li>
            <li>scale: multiplier (e.g. 1.5)</li>
            <li>flipH / flipV: booleans</li>
          </ul>

          <h2>Usage</h2>
          <pre style={{ background: 'var(--color-bg-secondary)', padding: '1rem', borderRadius: 8, overflow: 'auto' }}>
{`// Default clean logo
<BiensperienceLogo />

// White background variant (large)
<BiensperienceLogo type="white" size="lg" />

// Loading indicator
<BiensperienceLogo type="engine" size="xl" />

// Custom size and rotation
<BiensperienceLogo width={100} rotate={45} />`}
          </pre>
        </div>
      ),
      description: {
        component: `
# Biensperience Logo

The unified logo component supports multiple design variations for different use cases.

## Logo Variations

- **Clean** (default): Purple gradient background with white plus and drop shadow
- **Flat**: Simple flat purple gradient background with white plus, no effects
- **Soft**: Soft purple gradient with subtle shadow for a gentler appearance
- **White**: White background with purple gradient plus and shimmer effect
- **Engine**: Animated loading indicator that transforms from plus to spinning airplane engine

## Size Options

The component supports both preset sizes and custom dimensions:

**Presets**: \`xs\` (16px), \`sm\` (24px), \`md\` (32px - default), \`lg\` (48px), \`xl\` (64px), \`2xl\` (96px), \`3xl\` (128px)

**Custom**: Use \`width\` and \`height\` props for specific dimensions

## Transformations

- **Rotation**: \`rotate={45}\` (degrees)
- **Scale**: \`scale={1.5}\` (multiplier)
- **Flip**: \`flipH\` (horizontal), \`flipV\` (vertical)

## Usage Examples

\`\`\`jsx
// Default clean logo
<BiensperienceLogo />

// White background logo at large size
<BiensperienceLogo type="white" size="lg" />

// Loading indicator
<BiensperienceLogo type="engine" size="xl" />

// Custom size with rotation
<BiensperienceLogo width={100} rotate={45} />
\`\`\`
        `
      }
    }
  },
  argTypes: {
    type: {
      control: { type: 'select' },
      options: ['clean', 'flat', 'soft', 'white', 'engine'],
      description: 'Logo design variation',
      table: {
        defaultValue: { summary: 'clean' },
        type: { summary: 'string' }
      }
    },
    size: {
      control: { type: 'select' },
      options: ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'],
      description: 'Preset size (xs=16px, sm=24px, md=32px, lg=48px, xl=64px, 2xl=96px, 3xl=128px)',
      table: {
        defaultValue: { summary: 'md' },
        type: { summary: 'string' }
      }
    },
    width: {
      control: { type: 'number', min: 16, max: 256, step: 8 },
      description: 'Custom width in pixels (overrides size preset)',
      table: {
        type: { summary: 'number' }
      }
    },
    height: {
      control: { type: 'number', min: 16, max: 256, step: 8 },
      description: 'Custom height in pixels (overrides size preset)',
      table: {
        type: { summary: 'number' }
      }
    },
    rotate: {
      control: { type: 'number', min: 0, max: 360, step: 15 },
      description: 'Rotation angle in degrees',
      table: {
        type: { summary: 'number' }
      }
    },
    scale: {
      control: { type: 'number', min: 0.5, max: 3, step: 0.1 },
      description: 'Scale factor (1 = original size)',
      table: {
        defaultValue: { summary: '1' },
        type: { summary: 'number' }
      }
    },
    flipH: {
      control: 'boolean',
      description: 'Flip horizontally',
      table: {
        defaultValue: { summary: 'false' },
        type: { summary: 'boolean' }
      }
    },
    flipV: {
      control: 'boolean',
      description: 'Flip vertically',
      table: {
        defaultValue: { summary: 'false' },
        type: { summary: 'boolean' }
      }
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
      table: {
        type: { summary: 'string' }
      }
    }
  },
  tags: []
};

/**
 * Default logo with clean design - purple gradient background,
 * white plus symbol, and drop shadow.
 */
export const Default = {
  args: {
    type: 'clean',
    size: 'md'
  }
};

/**
 * All logo type variations displayed side-by-side for comparison.
 */
export const AllTypes = {
  render: () => (
    <div style={{ 
      display: 'flex', 
      gap: '2rem', 
      alignItems: 'center',
      flexWrap: 'wrap',
      padding: '2rem'
    }}>
      <div style={{ textAlign: 'center' }}>
        <BiensperienceLogo type="clean" size="xl" />
        <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#666' }}>
          Clean
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <BiensperienceLogo type="flat" size="xl" />
        <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#666' }}>
          Flat
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <BiensperienceLogo type="soft" size="xl" />
        <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#666' }}>
          Soft
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <BiensperienceLogo type="white" size="xl" />
        <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#666' }}>
          White
        </div>
      </div>
      <div style={{ textAlign: 'center', backgroundColor: '#f8f9fa', padding: '1rem', borderRadius: '8px' }}>
        <BiensperienceLogo type="engine" size="xl" />
        <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#666' }}>
          Engine (Loading)
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Compare all five logo variations: clean, flat, soft, white, and engine (animated loading indicator).'
      }
    }
  }
};

/**
 * Size comparison showing all available preset sizes.
 */
export const SizeComparison = {
  render: () => (
    <div style={{ 
      display: 'flex', 
      gap: '2rem', 
      alignItems: 'flex-end',
      padding: '2rem'
    }}>
      <div style={{ textAlign: 'center' }}>
        <BiensperienceLogo size="xs" />
        <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#666' }}>
          xs (16px)
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <BiensperienceLogo size="sm" />
        <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#666' }}>
          sm (24px)
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <BiensperienceLogo size="md" />
        <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#666' }}>
          md (32px)
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <BiensperienceLogo size="lg" />
        <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#666' }}>
          lg (48px)
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <BiensperienceLogo size="xl" />
        <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#666' }}>
          xl (64px)
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <BiensperienceLogo size="2xl" />
        <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#666' }}>
          2xl (96px)
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <BiensperienceLogo size="3xl" />
        <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#666' }}>
          3xl (128px)
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'All available preset sizes from xs (16px) to 3xl (128px).'
      }
    }
  }
};

/**
 * Logo variations displayed on different background colors
 * to show how they adapt to various contexts.
 */
export const OnBackgrounds = {
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
      {/* Light backgrounds */}
      <div style={{ 
        backgroundColor: '#ffffff', 
        padding: '2rem', 
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
        textAlign: 'center'
      }}>
        <BiensperienceLogo type="clean" size="xl" />
        <div style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#666' }}>
          Clean on White
        </div>
      </div>

      <div style={{ 
        backgroundColor: '#f9fafb', 
        padding: '2rem', 
        borderRadius: '8px',
        textAlign: 'center'
      }}>
        <BiensperienceLogo type="soft" size="xl" />
        <div style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#666' }}>
          Soft on Gray
        </div>
      </div>

      <div style={{ 
        backgroundColor: '#e0e7ff', 
        padding: '2rem', 
        borderRadius: '8px',
        textAlign: 'center'
      }}>
        <BiensperienceLogo type="flat" size="xl" />
        <div style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#666' }}>
          Flat on Purple Tint
        </div>
      </div>

      {/* Dark backgrounds */}
      <div style={{ 
        backgroundColor: '#1f2937', 
        padding: '2rem', 
        borderRadius: '8px',
        textAlign: 'center'
      }}>
        <BiensperienceLogo type="white" size="xl" />
        <div style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#d1d5db' }}>
          White on Dark
        </div>
      </div>

      <div style={{ 
        backgroundColor: '#4f46e5', 
        padding: '2rem', 
        borderRadius: '8px',
        textAlign: 'center'
      }}>
        <BiensperienceLogo type="white" size="xl" />
        <div style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#e0e7ff' }}>
          White on Purple
        </div>
      </div>

      <div style={{ 
        backgroundColor: '#111827', 
        padding: '2rem', 
        borderRadius: '8px',
        textAlign: 'center'
      }}>
        <BiensperienceLogo type="clean" size="xl" />
        <div style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#9ca3af' }}>
          Clean on Black
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Logo variations on different background colors demonstrate versatility across light and dark themes.'
      }
    }
  }
};

/**
 * Examples of logo transformations including rotation, scaling, and flipping.
 */
export const Transformations = {
  render: () => (
    <div style={{ 
      display: 'flex', 
      gap: '3rem', 
      alignItems: 'center',
      flexWrap: 'wrap',
      padding: '2rem'
    }}>
      <div style={{ textAlign: 'center' }}>
        <BiensperienceLogo size="xl" />
        <div style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#666' }}>
          Normal
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <BiensperienceLogo size="xl" rotate={45} />
        <div style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#666' }}>
          Rotated 45°
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <BiensperienceLogo size="xl" rotate={90} />
        <div style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#666' }}>
          Rotated 90°
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <BiensperienceLogo size="xl" scale={1.5} />
        <div style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#666' }}>
          Scaled 1.5x
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <BiensperienceLogo size="xl" flipH />
        <div style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#666' }}>
          Flipped Horizontal
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <BiensperienceLogo size="xl" flipV />
        <div style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#666' }}>
          Flipped Vertical
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Demonstrate CSS transformations: rotation, scaling, and flipping. These can be combined for complex effects.'
      }
    }
  }
};

/**
 * Realistic usage example in a navigation header.
 */
export const InHeader = {
  render: () => (
    <div style={{ 
      backgroundColor: '#ffffff',
      borderBottom: '1px solid #e5e7eb',
      padding: '1rem 2rem',
      display: 'flex',
      alignItems: 'center',
      gap: '1rem'
    }}>
      <BiensperienceLogo type="clean" size="lg" />
      <div style={{ 
        fontSize: '1.25rem', 
        fontWeight: '600',
        color: '#1f2937'
      }}>
        Biensperience
      </div>
      <div style={{ 
        marginLeft: 'auto',
        display: 'flex',
        gap: '1rem'
      }}>
        <button style={{
          padding: '0.5rem 1rem',
          border: '1px solid #d1d5db',
          borderRadius: '6px',
          backgroundColor: 'transparent',
          cursor: 'pointer'
        }}>
          Sign In
        </button>
        <button style={{
          padding: '0.5rem 1rem',
          border: 'none',
          borderRadius: '6px',
          backgroundColor: '#7c3aed',
          color: 'white',
          cursor: 'pointer'
        }}>
          Get Started
        </button>
      </div>
    </div>
  ),
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        story: 'Example of logo usage in a navigation header with brand name and action buttons.'
      }
    }
  }
};

/**
 * Loading indicator use case with the animated engine logo.
 */
export const LoadingIndicator = {
  render: () => (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '1.5rem',
      padding: '3rem',
      backgroundColor: '#f9fafb',
      borderRadius: '12px'
    }}>
      <BiensperienceLogo type="engine" size="3xl" />
      <div style={{
        fontSize: '1.125rem',
        color: '#4b5563',
        fontWeight: '500'
      }}>
        Loading your experiences...
      </div>
      <div style={{
        fontSize: '0.875rem',
        color: '#6b7280',
        maxWidth: '300px',
        textAlign: 'center'
      }}>
        The engine logo automatically animates, transforming from a plus icon 
        to a spinning airplane engine. Perfect for loading states.
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'The engine logo variation provides an animated loading indicator that transforms from the plus icon to a spinning airplane engine. Includes accessibility support with reduced motion preferences.'
      }
    }
  }
};

/**
 * Interactive playground for testing all logo properties.
 */
export const Playground = {
  args: {
    type: 'clean',
    size: 'xl',
    rotate: 0,
    scale: 1,
    flipH: false,
    flipV: false
  },
  parameters: {
    docs: {
      description: {
        story: 'Interactive controls to experiment with all logo properties. Try different combinations of type, size, rotation, scale, and flip options.'
      }
    }
  }
};

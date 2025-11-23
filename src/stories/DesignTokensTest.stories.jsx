/**
 * Design Tokens Test Story
 *
 * This story verifies that SASS-generated CSS custom properties work correctly.
 * Tests:
 * - CSS custom properties are generated from SASS variables
 * - Dark mode toggle works
 * - All token categories (colors, spacing, typography, etc.)
 */

import React, { useEffect, useState } from 'react';
import '../styles/scss/abstracts/_tokens.scss';

export default {
  title: 'Development/Design Tokens',
  parameters: {
    docs: {
      description: {
        component: 'Test story to verify SASS-generated CSS custom properties and dark mode.',
      },
    },
  },
};

const DesignTokensDemo = () => {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [darkMode]);

  return (
    <div style={{ padding: 'var(--space-6)' }}>
      <div style={{
        marginBottom: 'var(--space-6)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h1 style={{
          fontSize: 'var(--font-size-3xl)',
          fontWeight: 'var(--font-weight-bold)',
          color: 'var(--color-text-primary)',
          marginBottom: 'var(--space-2)'
        }}>
          Design Tokens Test
        </h1>
        <button
          onClick={() => setDarkMode(!darkMode)}
          style={{
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-primary)',
            color: 'white',
            border: 'none',
            fontWeight: 'var(--font-weight-semibold)',
            cursor: 'pointer',
            transition: 'all var(--transition-normal)'
          }}
        >
          {darkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
        </button>
      </div>

      {/* Colors Test */}
      <section style={{ marginBottom: 'var(--space-8)' }}>
        <h2 style={{
          fontSize: 'var(--font-size-2xl)',
          fontWeight: 'var(--font-weight-semibold)',
          color: 'var(--color-text-primary)',
          marginBottom: 'var(--space-4)'
        }}>
          Colors
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 'var(--space-4)' }}>
          {['primary', 'secondary', 'success', 'warning', 'danger', 'info'].map(color => (
            <div key={color} style={{
              padding: 'var(--space-4)',
              borderRadius: 'var(--radius-lg)',
              background: `var(--color-${color})`,
              color: 'white',
              textAlign: 'center',
              fontWeight: 'var(--font-weight-semibold)',
              boxShadow: 'var(--shadow-sm)'
            }}>
              {color}
            </div>
          ))}
        </div>
      </section>

      {/* Typography Test */}
      <section style={{ marginBottom: 'var(--space-8)' }}>
        <h2 style={{
          fontSize: 'var(--font-size-2xl)',
          fontWeight: 'var(--font-weight-semibold)',
          color: 'var(--color-text-primary)',
          marginBottom: 'var(--space-4)'
        }}>
          Typography
        </h2>
        <div style={{
          background: 'var(--color-bg-secondary)',
          padding: 'var(--space-6)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)'
        }}>
          {['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl'].map(size => (
            <p key={size} style={{
              fontSize: `var(--font-size-${size})`,
              color: 'var(--color-text-primary)',
              marginBottom: 'var(--space-2)'
            }}>
              Font size {size}
            </p>
          ))}
        </div>
      </section>

      {/* Spacing Test */}
      <section style={{ marginBottom: 'var(--space-8)' }}>
        <h2 style={{
          fontSize: 'var(--font-size-2xl)',
          fontWeight: 'var(--font-weight-semibold)',
          color: 'var(--color-text-primary)',
          marginBottom: 'var(--space-4)'
        }}>
          Spacing
        </h2>
        <div style={{
          background: 'var(--color-bg-secondary)',
          padding: 'var(--space-6)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)'
        }}>
          {['1', '2', '3', '4', '5', '6', '8', '10', '12'].map(space => (
            <div key={space} style={{ marginBottom: 'var(--space-2)' }}>
              <span style={{ color: 'var(--color-text-primary)', marginRight: 'var(--space-2)' }}>
                --space-{space}:
              </span>
              <span
                style={{
                  display: 'inline-block',
                  width: `var(--space-${space})`,
                  height: 'var(--space-4)',
                  background: 'var(--color-primary)',
                  verticalAlign: 'middle'
                }}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Shadows Test */}
      <section style={{ marginBottom: 'var(--space-8)' }}>
        <h2 style={{
          fontSize: 'var(--font-size-2xl)',
          fontWeight: 'var(--font-weight-semibold)',
          color: 'var(--color-text-primary)',
          marginBottom: 'var(--space-4)'
        }}>
          Shadows
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 'var(--space-4)' }}>
          {['xs', 'sm', 'md', 'lg', 'xl', '2xl'].map(shadow => (
            <div key={shadow} style={{
              padding: 'var(--space-6)',
              background: 'var(--color-bg-primary)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: `var(--shadow-${shadow})`,
              color: 'var(--color-text-primary)',
              textAlign: 'center',
              fontWeight: 'var(--font-weight-medium)'
            }}>
              {shadow}
            </div>
          ))}
        </div>
      </section>

      {/* Border Radius Test */}
      <section>
        <h2 style={{
          fontSize: 'var(--font-size-2xl)',
          fontWeight: 'var(--font-weight-semibold)',
          color: 'var(--color-text-primary)',
          marginBottom: 'var(--space-4)'
        }}>
          Border Radius
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 'var(--space-4)' }}>
          {['none', 'sm', 'md', 'lg', 'xl', '2xl', 'full'].map(radius => (
            <div key={radius} style={{
              padding: 'var(--space-4)',
              background: 'var(--color-primary)',
              borderRadius: `var(--radius-${radius})`,
              color: 'white',
              textAlign: 'center',
              fontWeight: 'var(--font-weight-medium)'
            }}>
              {radius}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export const AllTokens = () => <DesignTokensDemo />;

AllTokens.parameters = {
  docs: {
    description: {
      story: 'Interactive demo of all design tokens with dark mode toggle. Verify that all CSS custom properties are generated correctly from SASS variables.',
    },
  },
};

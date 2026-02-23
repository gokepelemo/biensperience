/**
 * Accessibility - Foundation Stories
 *
 * Documents WCAG 2.1 AA compliance patterns used throughout the
 * Biensperience design system. Covers color contrast, focus management,
 * touch targets, reduced motion, and screen reader utilities.
 */

import React, { useState } from 'react';

export default {
  title: 'Foundation/Accessibility',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
WCAG 2.1 Level AA accessibility patterns for the Biensperience design system.

Global styles are defined in \`src/styles/accessibility.scss\` and applied automatically.
        `,
      },
    },
  },
};

// ============================================================
// COLOR CONTRAST
// ============================================================

const contrastPairs = [
  { name: 'Primary on White', fg: '#667eea', bg: '#ffffff', ratio: '4.35:1', level: 'AA', note: 'Passes AA for normal text (borderline). Use --color-primary-hover for small text.' },
  { name: 'Primary Hover on White', fg: '#5a67d8', bg: '#ffffff', ratio: '5.3:1', level: 'AA+', note: 'Passes AA and AAA for large text. Preferred for small body text.' },
  { name: 'Primary Dark on White', fg: '#764ba2', bg: '#ffffff', ratio: '5.8:1', level: 'AA+', note: 'Passes AA and AAA for large text.' },
  { name: 'Text on White', fg: '#333333', bg: '#ffffff', ratio: '12.6:1', level: 'AAA', note: 'Excellent contrast. Primary body text color.' },
  { name: 'Text Muted on White', fg: '#6c757d', bg: '#ffffff', ratio: '4.7:1', level: 'AA', note: 'Passes AA for normal text. Use for secondary/helper text only.' },
  { name: 'Success on White', fg: '#28a745', bg: '#ffffff', ratio: '4.5:1', level: 'AA', note: 'Borderline AA. Pair with icon or bold text.' },
  { name: 'Danger on White', fg: '#dc3545', bg: '#ffffff', ratio: '4.0:1', level: 'AA-LG', note: 'Passes AA for large text only. Always pair with icon.' },
  { name: 'Info on White', fg: '#17a2b8', bg: '#ffffff', ratio: '3.2:1', level: 'AA-LG', note: 'Large text only. Use as background color with dark text instead.' },
  { name: 'White on Primary', fg: '#ffffff', bg: '#667eea', ratio: '4.35:1', level: 'AA', note: 'Used in gradient buttons and badges.' },
  { name: 'White on Danger Gradient', fg: '#ffffff', bg: '#dc3545', ratio: '4.0:1', level: 'AA-LG', note: 'Danger buttons use gradient which improves effective contrast.' },
];

const levelColors = {
  'AAA': '#28a745',
  'AA+': '#28a745',
  'AA': '#ffc107',
  'AA-LG': '#fd7e14',
  'FAIL': '#dc3545',
};

export const ColorContrast = {
  render: () => (
    <div style={{
      padding: 'var(--space-6)',
      maxWidth: '1000px',
      margin: '0 auto',
      color: 'var(--color-text-primary)',
      backgroundColor: 'var(--color-bg-primary)',
    }}>
      <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--space-2)' }}>
        Color Contrast Ratios
      </h1>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-6)' }}>
        WCAG 2.1 requires 4.5:1 for normal text (AA) and 3:1 for large text (18px+ bold or 24px+ regular).
      </p>

      <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
        {contrastPairs.map((pair) => (
          <div key={pair.name} style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            gap: 'var(--space-4)',
            alignItems: 'center',
            padding: 'var(--space-4)',
            background: 'var(--color-bg-secondary)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border-light)',
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
                {/* Color swatch */}
                <div style={{
                  width: '120px',
                  height: '40px',
                  borderRadius: 'var(--radius-sm)',
                  background: pair.bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: pair.fg,
                  fontWeight: 'var(--font-weight-bold)',
                  fontSize: 'var(--font-size-sm)',
                  border: '1px solid var(--color-border-medium)',
                }}>
                  Sample Text
                </div>
                <div>
                  <div style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)' }}>
                    {pair.name}
                  </div>
                  <code style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                    {pair.fg} on {pair.bg}
                  </code>
                </div>
              </div>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', margin: 0 }}>
                {pair.note}
              </p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                padding: 'var(--space-1) var(--space-3)',
                borderRadius: 'var(--radius-pill)',
                background: levelColors[pair.level],
                color: pair.level === 'AA' ? '#333' : 'white',
                fontWeight: 'var(--font-weight-bold)',
                fontSize: 'var(--font-size-sm)',
                marginBottom: 'var(--space-1)',
              }}>
                {pair.level}
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                {pair.ratio}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{
        marginTop: 'var(--space-6)',
        padding: 'var(--space-4)',
        background: 'rgba(102, 126, 234, 0.1)',
        borderLeft: '4px solid var(--color-primary)',
        borderRadius: 'var(--radius-sm)',
      }}>
        <strong>Key rule:</strong> Warning (#ffc107) and info (#17a2b8) colors must never be used as text on white backgrounds.
        Use them as background colors with dark text, or only on gradient backgrounds where the underlying gradient provides contrast.
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'WCAG 2.1 color contrast ratios for all primary, semantic, and text colors against common backgrounds.',
      },
    },
  },
};

// ============================================================
// FOCUS STATES
// ============================================================

export const FocusStates = {
  render: () => (
    <div style={{
      padding: 'var(--space-6)',
      maxWidth: '800px',
      margin: '0 auto',
      color: 'var(--color-text-primary)',
      backgroundColor: 'var(--color-bg-primary)',
    }}>
      <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--space-2)' }}>
        Focus States
      </h1>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>
        All interactive elements show a visible focus ring when navigated via keyboard (Tab key).
        Mouse clicks do not show focus outlines thanks to <code>:focus-visible</code>.
      </p>
      <p style={{
        color: 'var(--color-primary)',
        fontWeight: 'var(--font-weight-semibold)',
        padding: 'var(--space-3)',
        backgroundColor: 'var(--color-bg-secondary)',
        borderRadius: 'var(--radius-md)',
        marginBottom: 'var(--space-6)',
      }}>
        Try pressing Tab to navigate through the elements below
      </p>

      <div style={{ display: 'grid', gap: 'var(--space-6)' }}>
        <section>
          <h3 style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--space-3)' }}>Buttons</h3>
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <button className="btn-gradient">Gradient Button</button>
            <button className="btn-outline-custom">Outline Button</button>
            <button className="btn btn-primary">Bootstrap Primary</button>
            <button className="btn btn-danger">Danger Button</button>
          </div>
        </section>

        <section>
          <h3 style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--space-3)' }}>Links</h3>
          <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
            <a href="#demo-1" onClick={e => e.preventDefault()}>Standard Link</a>
            <a href="#demo-2" onClick={e => e.preventDefault()} style={{ color: 'var(--color-primary-dark)' }}>Dark Link</a>
          </div>
        </section>

        <section>
          <h3 style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--space-3)' }}>Form Controls</h3>
          <div style={{ display: 'grid', gap: 'var(--space-3)', maxWidth: '400px' }}>
            <input className="form-control" placeholder="Text input" aria-label="Text input demo" />
            <select className="form-select" aria-label="Select demo">
              <option>Select an option</option>
              <option>Option 1</option>
              <option>Option 2</option>
            </select>
            <textarea className="form-control" rows={2} placeholder="Textarea" aria-label="Textarea demo" />
          </div>
        </section>

        <section>
          <h3 style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--space-3)' }}>Checkboxes and Radios</h3>
          <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <input type="checkbox" /> Checkbox
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <input type="radio" name="demo-radio" /> Radio A
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <input type="radio" name="demo-radio" /> Radio B
            </label>
          </div>
        </section>
      </div>

      <div style={{
        marginTop: 'var(--space-8)',
        padding: 'var(--space-4)',
        background: 'var(--color-bg-secondary)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border-light)',
      }}>
        <h3 style={{ fontSize: 'var(--font-size-md)', marginBottom: 'var(--space-2)' }}>How it works</h3>
        <pre style={{
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-secondary)',
          margin: 0,
          whiteSpace: 'pre-wrap',
          fontFamily: 'monospace',
        }}>{`/* Keyboard focus — visible ring */
*:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* Mouse focus — no ring */
*:focus:not(:focus-visible) {
  outline: none;
  box-shadow: none;
}`}</pre>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Interactive demo of focus-visible behavior. Tab through elements to see keyboard focus rings. Click to verify no visual noise for mouse users.',
      },
    },
  },
};

// ============================================================
// TOUCH TARGETS
// ============================================================

export const TouchTargets = {
  render: () => (
    <div style={{
      padding: 'var(--space-6)',
      maxWidth: '800px',
      margin: '0 auto',
      color: 'var(--color-text-primary)',
      backgroundColor: 'var(--color-bg-primary)',
    }}>
      <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--space-2)' }}>
        Touch Target Sizes
      </h1>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-6)' }}>
        WCAG 2.5.5 requires a minimum 44x44px touch target for all interactive elements.
        Our global <code>accessibility.scss</code> enforces this on buttons, links, checkboxes, radios, and selects.
      </p>

      <div style={{ display: 'grid', gap: 'var(--space-6)' }}>
        <section>
          <h3 style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--space-3)' }}>Button Heights</h3>
          <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
            {[
              { size: 'sm', height: '36px', token: '--btn-height-sm', note: 'Secondary actions — meets 44px via padding' },
              { size: 'md', height: '44px', token: '--btn-height-md', note: 'Default — exact WCAG minimum' },
              { size: 'lg', height: '52px', token: '--btn-height-lg', note: 'Hero CTAs — exceeds minimum' },
            ].map(({ size, height, token, note }) => (
              <div key={size} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-4)',
                padding: 'var(--space-3)',
                background: 'var(--color-bg-secondary)',
                borderRadius: 'var(--radius-md)',
              }}>
                <div style={{
                  width: '120px',
                  minHeight: height,
                  background: 'var(--gradient-primary)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 'var(--font-weight-semibold)',
                  fontSize: 'var(--font-size-sm)',
                }}>
                  {size.toUpperCase()} ({height})
                </div>
                <div>
                  <code style={{ fontSize: 'var(--font-size-sm)' }}>{token}</code>
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>{note}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--space-3)' }}>Icon Button (44x44)</h3>
          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
            <button style={{
              width: '44px',
              height: '44px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-bg-secondary)',
              border: '2px solid var(--color-primary)',
              color: 'var(--color-primary)',
              cursor: 'pointer',
              fontSize: 'var(--font-size-lg)',
            }} aria-label="Close">
              X
            </button>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              Icon-only buttons must be at least 44x44px and include <code>aria-label</code>
            </span>
          </div>
        </section>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Touch target size compliance for WCAG 2.5.5. All interactive elements enforce a 44x44px minimum.',
      },
    },
  },
};

// ============================================================
// REDUCED MOTION
// ============================================================

export const ReducedMotion = {
  render: () => {
    const [simulateReduced, setSimulateReduced] = useState(false);

    return (
      <div style={{
        padding: 'var(--space-6)',
        maxWidth: '800px',
        margin: '0 auto',
        color: 'var(--color-text-primary)',
        backgroundColor: 'var(--color-bg-primary)',
      }}>
        <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--space-2)' }}>
          Reduced Motion
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-6)' }}>
          When <code>prefers-reduced-motion: reduce</code> is active, all animations and transitions
          are disabled globally via <code>accessibility.scss</code>.
        </p>

        <div style={{
          padding: 'var(--space-4)',
          background: 'var(--color-bg-secondary)',
          borderRadius: 'var(--radius-lg)',
          marginBottom: 'var(--space-6)',
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={simulateReduced}
              onChange={(e) => setSimulateReduced(e.target.checked)}
            />
            <span style={{ fontWeight: 'var(--font-weight-semibold)' }}>
              Simulate reduced motion (adds inline style override)
            </span>
          </label>
        </div>

        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
          <section>
            <h3 style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--space-3)' }}>
              Hover Transitions
            </h3>
            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
              <button
                className="btn-gradient"
                style={simulateReduced ? { transition: 'none', transform: 'none' } : {}}
              >
                Hover Me
              </button>
              <button
                className="btn-outline-custom"
                style={simulateReduced ? { transition: 'none', transform: 'none' } : {}}
              >
                Hover Me
              </button>
            </div>
          </section>

          <section>
            <h3 style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--space-3)' }}>
              Card Hover Lift
            </h3>
            <div style={{
              width: '200px',
              padding: 'var(--space-4)',
              background: 'var(--color-bg-secondary)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-sm)',
              border: '1px solid var(--color-border-light)',
              transition: simulateReduced ? 'none' : 'all var(--transition-normal)',
              cursor: 'pointer',
            }}>
              <div style={{ fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--space-1)' }}>Card</div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>Hover to see lift effect</div>
            </div>
          </section>
        </div>

        <div style={{
          marginTop: 'var(--space-6)',
          padding: 'var(--space-4)',
          background: 'var(--color-bg-secondary)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border-light)',
        }}>
          <h3 style={{ fontSize: 'var(--font-size-md)', marginBottom: 'var(--space-2)' }}>Global rule</h3>
          <pre style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-secondary)',
            margin: 0,
            whiteSpace: 'pre-wrap',
            fontFamily: 'monospace',
          }}>{`@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}`}</pre>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-2)', marginBottom: 0 }}>
            No per-component handling needed. This rule in <code>accessibility.scss</code> covers the entire application.
          </p>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates reduced motion behavior. Toggle the checkbox to simulate `prefers-reduced-motion: reduce` preferences.',
      },
    },
  },
};

// ============================================================
// SCREEN READER UTILITIES
// ============================================================

export const ScreenReaderUtilities = {
  render: () => (
    <div style={{
      padding: 'var(--space-6)',
      maxWidth: '800px',
      margin: '0 auto',
      color: 'var(--color-text-primary)',
      backgroundColor: 'var(--color-bg-primary)',
    }}>
      <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--space-2)' }}>
        Screen Reader Utilities
      </h1>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-6)' }}>
        CSS classes and ARIA patterns for screen reader accessibility.
      </p>

      <div style={{ display: 'grid', gap: 'var(--space-6)' }}>
        <section>
          <h3 style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--space-3)' }}>Visually Hidden Classes</h3>
          <div style={{
            padding: 'var(--space-4)',
            background: 'var(--color-bg-secondary)',
            borderRadius: 'var(--radius-md)',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: 'var(--space-2)', borderBottom: '2px solid var(--color-border-medium)' }}>Class</th>
                  <th style={{ textAlign: 'left', padding: 'var(--space-2)', borderBottom: '2px solid var(--color-border-medium)' }}>Purpose</th>
                  <th style={{ textAlign: 'left', padding: 'var(--space-2)', borderBottom: '2px solid var(--color-border-medium)' }}>Focusable?</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: 'var(--space-2)', borderBottom: '1px solid var(--color-border-light)' }}><code>.sr-only</code></td>
                  <td style={{ padding: 'var(--space-2)', borderBottom: '1px solid var(--color-border-light)' }}>Hidden visually, readable by screen readers</td>
                  <td style={{ padding: 'var(--space-2)', borderBottom: '1px solid var(--color-border-light)' }}>No</td>
                </tr>
                <tr>
                  <td style={{ padding: 'var(--space-2)', borderBottom: '1px solid var(--color-border-light)' }}><code>.visually-hidden</code></td>
                  <td style={{ padding: 'var(--space-2)', borderBottom: '1px solid var(--color-border-light)' }}>Alias for .sr-only</td>
                  <td style={{ padding: 'var(--space-2)', borderBottom: '1px solid var(--color-border-light)' }}>No</td>
                </tr>
                <tr>
                  <td style={{ padding: 'var(--space-2)', borderBottom: '1px solid var(--color-border-light)' }}><code>.sr-only-focusable</code></td>
                  <td style={{ padding: 'var(--space-2)', borderBottom: '1px solid var(--color-border-light)' }}>Hidden until focused (skip links)</td>
                  <td style={{ padding: 'var(--space-2)', borderBottom: '1px solid var(--color-border-light)' }}>Yes</td>
                </tr>
                <tr>
                  <td style={{ padding: 'var(--space-2)' }}><code>.skip-link</code></td>
                  <td style={{ padding: 'var(--space-2)' }}>Skip navigation link with gradient styling</td>
                  <td style={{ padding: 'var(--space-2)' }}>Yes</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h3 style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--space-3)' }}>ARIA Patterns</h3>
          <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
            {[
              { pattern: 'aria-label', example: '<button aria-label="Close dialog">X</button>', use: 'Icon-only buttons' },
              { pattern: 'aria-describedby', example: '<input aria-describedby="help-text" />', use: 'Form help text' },
              { pattern: 'aria-busy="true"', example: '<div aria-busy="true">Loading...</div>', use: 'Loading states' },
              { pattern: 'aria-pressed', example: '<button aria-pressed="true">Toggle</button>', use: 'Toggle buttons' },
              { pattern: 'role="alert"', example: '<div role="alert">Error message</div>', use: 'Dynamic error messages' },
              { pattern: 'role="status"', example: '<div role="status">Success!</div>', use: 'Status updates' },
            ].map(({ pattern, example, use }) => (
              <div key={pattern} style={{
                padding: 'var(--space-3)',
                background: 'var(--color-bg-secondary)',
                borderRadius: 'var(--radius-md)',
                display: 'grid',
                gridTemplateColumns: '140px 1fr',
                gap: 'var(--space-3)',
                alignItems: 'start',
              }}>
                <code style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)' }}>
                  {pattern}
                </code>
                <div>
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-1)' }}>{use}</div>
                  <code style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{example}</code>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--space-3)' }}>High Contrast Mode</h3>
          <div style={{
            padding: 'var(--space-4)',
            background: 'var(--color-bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border-light)',
          }}>
            <pre style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
              margin: 0,
              whiteSpace: 'pre-wrap',
              fontFamily: 'monospace',
            }}>{`@media (prefers-contrast: high) {
  * { border-width: 2px; }
  button, a { text-decoration: underline; }
}`}</pre>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-2)', marginBottom: 0 }}>
              Automatically thickens borders and underlines interactive elements when high contrast is preferred.
            </p>
          </div>
        </section>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Screen reader CSS utilities, ARIA patterns, and high contrast mode support used throughout the application.',
      },
    },
  },
};

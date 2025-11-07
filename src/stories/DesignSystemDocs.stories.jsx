import React from 'react';

export default {
  title: 'Design System/Documentation',
  parameters: {
    layout: 'fullscreen',
  },
};

// Design System Documentation Page
export const Overview = {
  render: () => (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Biensperience Design System</h1>
      <p>Complete design system reference including color palettes, typography, spacing, components, and best practices.</p>
      
      <hr />
      
      <h2>Color System</h2>
      
      <h3>Philosophy</h3>
      <p>The color system is built on <strong>semantic meaning</strong>, <strong>WCAG AA accessibility compliance</strong> (minimum 4.5:1 contrast ratio), and <strong>complete dark mode support</strong>. All colors are defined as CSS variables in <code>design-tokens.css</code> for consistency and easy theming.</p>
      
      <h3>Semantic Colors</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--color-bg-tertiary)' }}>
            <th style={{ padding: '0.75rem', textAlign: 'left' }}>Color</th>
            <th style={{ padding: '0.75rem', textAlign: 'left' }}>Variable</th>
            <th style={{ padding: '0.75rem', textAlign: 'left' }}>Light Mode</th>
            <th style={{ padding: '0.75rem', textAlign: 'left' }}>Dark Mode</th>
            <th style={{ padding: '0.75rem', textAlign: 'left' }}>Usage</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ borderBottom: '1px solid var(--color-bg-tertiary)' }}>
            <td style={{ padding: '0.75rem' }}><strong>Primary</strong></td>
            <td style={{ padding: '0.75rem' }}><code>--color-primary</code></td>
            <td style={{ padding: '0.75rem' }}>#667eea</td>
            <td style={{ padding: '0.75rem' }}>#667eea</td>
            <td style={{ padding: '0.75rem' }}>Brand color, primary actions, links, active states</td>
          </tr>
          <tr style={{ borderBottom: '1px solid var(--color-bg-tertiary)' }}>
            <td style={{ padding: '0.75rem' }}><strong>Success</strong></td>
            <td style={{ padding: '0.75rem' }}><code>--color-success</code></td>
            <td style={{ padding: '0.75rem' }}>#28a745</td>
            <td style={{ padding: '0.75rem' }}>#40c057</td>
            <td style={{ padding: '0.75rem' }}>Success states, confirmations, positive feedback</td>
          </tr>
          <tr style={{ borderBottom: '1px solid var(--color-bg-tertiary)' }}>
            <td style={{ padding: '0.75rem' }}><strong>Danger</strong></td>
            <td style={{ padding: '0.75rem' }}><code>--color-danger</code></td>
            <td style={{ padding: '0.75rem' }}>#dc3545</td>
            <td style={{ padding: '0.75rem' }}>#fa5252</td>
            <td style={{ padding: '0.75rem' }}>Error states, destructive actions, critical warnings</td>
          </tr>
          <tr style={{ borderBottom: '1px solid var(--color-bg-tertiary)' }}>
            <td style={{ padding: '0.75rem' }}><strong>Warning</strong></td>
            <td style={{ padding: '0.75rem' }}><code>--color-warning</code></td>
            <td style={{ padding: '0.75rem' }}>#ffc107</td>
            <td style={{ padding: '0.75rem' }}>#ffd43b</td>
            <td style={{ padding: '0.75rem' }}>Warning states, cautionary information</td>
          </tr>
          <tr style={{ borderBottom: '1px solid var(--color-bg-tertiary)' }}>
            <td style={{ padding: '0.75rem' }}><strong>Info</strong></td>
            <td style={{ padding: '0.75rem' }}><code>--color-info</code></td>
            <td style={{ padding: '0.75rem' }}>#17a2b8</td>
            <td style={{ padding: '0.75rem' }}>#339af0</td>
            <td style={{ padding: '0.75rem' }}>Informational messages, neutral notifications</td>
          </tr>
        </tbody>
      </table>
      
      <h3>Design Tokens</h3>
      <p>All design tokens are defined in <code>src/styles/design-tokens.css</code> and should be used consistently throughout the application.</p>
      
      <h4>Color Tokens</h4>
      <ul>
        <li><code>--color-primary</code> - Primary brand color</li>
        <li><code>--color-success</code> - Success states</li>
        <li><code>--color-danger</code> - Error states</li>
        <li><code>--color-warning</code> - Warning states</li>
        <li><code>--color-info</code> - Informational states</li>
      </ul>
      
      <h4>Spacing Tokens</h4>
      <ul>
        <li><code>--space-1</code> through <code>--space-20</code> - Consistent spacing scale</li>
        <li><code>--space-px</code> - 1px spacing</li>
      </ul>
      
      <h4>Typography Tokens</h4>
      <ul>
        <li><code>--font-size-xs</code> through <code>--font-size-4xl</code> - Font size scale</li>
        <li><code>--font-weight-light</code> through <code>--font-weight-black</code> - Font weights</li>
        <li><code>--line-height-none</code> through <code>--line-height-loose</code> - Line heights</li>
      </ul>
      
      <h4>Border Radius Tokens</h4>
      <ul>
        <li><code>--border-radius-none</code> - 0</li>
        <li><code>--border-radius-sm</code> - 0.25rem</li>
        <li><code>--border-radius-md</code> - 0.375rem</li>
        <li><code>--border-radius-lg</code> - 0.5rem</li>
        <li><code>--border-radius-xl</code> - 0.75rem</li>
        <li><code>--border-radius-2xl</code> - 1rem</li>
        <li><code>--border-radius-full</code> - 9999px</li>
      </ul>
      
      <hr />
      
      <h2>Components</h2>
      
      <h3>Component Architecture</h3>
      <p>All components follow these principles:</p>
      <ul>
        <li><strong>Design Token Usage</strong> - Use CSS variables exclusively, no hardcoded values</li>
        <li><strong>Accessibility</strong> - WCAG AA compliant, keyboard navigation, ARIA labels</li>
        <li><strong>Responsive</strong> - Mobile-first design with proper breakpoints</li>
        <li><strong>Dark Mode</strong> - Full dark mode support via design tokens</li>
        <li><strong>Reusability</strong> - Props for customization, well-documented</li>
      </ul>
      
      <h3>Available Components</h3>
      <ul>
        <li><strong>DestinationBrowser</strong> - Complete destination listing interface</li>
        <li><strong>MapView</strong> - Google Maps integration with controls</li>
        <li><strong>GoogleMap</strong> - Reusable Google Maps component</li>
        <li><strong>Stepper</strong> - Progress indicator for multi-step processes</li>
        <li><strong>Pagination</strong> - Page navigation for lists</li>
        <li><strong>ProgressBar</strong> - Visual progress indicators</li>
      </ul>
      
      <hr />
      
      <h2>Best Practices</h2>
      
      <h3>CSS Best Practices</h3>
      <ul>
        <li>✓ Use design tokens exclusively (no hardcoded colors, spacing, etc.)</li>
        <li>✓ Mobile-first responsive design</li>
        <li>✓ BEM naming convention for class names</li>
        <li>✓ Avoid !important (use specificity instead)</li>
        <li>✓ Group related styles together</li>
      </ul>
      
      <h3>Accessibility</h3>
      <ul>
        <li>✓ <strong>WCAG AA Contrast</strong>: Minimum 4.5:1 for text, 3:1 for UI</li>
        <li>✓ <strong>Focus Indicators</strong>: Visible on all interactive elements</li>
        <li>✓ <strong>Keyboard Navigation</strong>: All functionality accessible via keyboard</li>
        <li>✓ <strong>ARIA Labels</strong>: All icon-only buttons have labels</li>
        <li>✓ <strong>Semantic HTML</strong>: Use proper HTML5 elements</li>
      </ul>
    </div>
  ),
};

import React from 'react';

export default {
  title: 'Foundation/Documentation',
  parameters: {
    layout: 'fullscreen',
  },
};

const sectionStyle = { marginBottom: '2rem' };
const cellStyle = { padding: '0.75rem' };
const headerRowStyle = { borderBottom: '2px solid var(--color-bg-tertiary)' };
const rowStyle = { borderBottom: '1px solid var(--color-bg-tertiary)' };
const codeBlockStyle = {
  background: 'var(--color-bg-secondary)',
  padding: '1rem',
  borderRadius: 'var(--radius-md)',
  fontFamily: 'var(--font-family-mono)',
  fontSize: 'var(--font-size-sm)',
  overflow: 'auto',
  marginBottom: '1rem',
};
const swatchStyle = (bg) => ({
  display: 'inline-block',
  width: '2rem',
  height: '2rem',
  borderRadius: 'var(--radius-sm)',
  background: bg,
  border: '1px solid var(--color-border-medium)',
  verticalAlign: 'middle',
  marginRight: '0.5rem',
});

// Design System Documentation Page
export const Overview = {
  render: () => (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Biensperience Design System</h1>
      <p>Complete design system reference including color palettes, typography, spacing, components, and best practices.</p>
      
      <hr />
      
      <h2>Color System</h2>
      
      <h3>Philosophy</h3>
      <p>The color system is built on <strong>semantic meaning</strong>, <strong>WCAG AA accessibility compliance</strong> (minimum 4.5:1 contrast ratio for normal text, 3:1 for large text and UI components), and <strong>complete dark mode support</strong>. All colors are defined as CSS variables in <code>src/styles/design-tokens.scss</code> and generated from SASS variables in <code>src/styles/scss/abstracts/_tokens.scss</code>.</p>
      
      <h3>Primary Colors</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
        <thead>
          <tr style={headerRowStyle}>
            <th style={cellStyle}>Swatch</th>
            <th style={cellStyle}>Variable</th>
            <th style={cellStyle}>Hex</th>
            <th style={cellStyle}>Contrast on White</th>
            <th style={cellStyle}>Usage</th>
          </tr>
        </thead>
        <tbody>
          <tr style={rowStyle}>
            <td style={cellStyle}><span style={swatchStyle('#667eea')} /></td>
            <td style={cellStyle}><code>--color-primary</code></td>
            <td style={cellStyle}>#667eea</td>
            <td style={cellStyle}>4.35:1 (AA large text only)</td>
            <td style={cellStyle}>Brand color, backgrounds, borders. For body text, use <code>--color-primary-hover</code></td>
          </tr>
          <tr style={rowStyle}>
            <td style={cellStyle}><span style={swatchStyle('#5a67d8')} /></td>
            <td style={cellStyle}><code>--color-primary-hover</code></td>
            <td style={cellStyle}>#5a67d8</td>
            <td style={cellStyle}>5.3:1 (AA normal text)</td>
            <td style={cellStyle}>Body text on white, hover states</td>
          </tr>
          <tr style={rowStyle}>
            <td style={cellStyle}><span style={swatchStyle('#764ba2')} /></td>
            <td style={cellStyle}><code>--color-primary-dark</code></td>
            <td style={cellStyle}>#764ba2</td>
            <td style={cellStyle}>5.8:1 (AA + AAA large)</td>
            <td style={cellStyle}>Headings, emphasis, gradient end</td>
          </tr>
        </tbody>
      </table>
      
      <h3>Semantic Colors</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
        <thead>
          <tr style={headerRowStyle}>
            <th style={cellStyle}>Swatch</th>
            <th style={cellStyle}>Variable</th>
            <th style={cellStyle}>Light Mode</th>
            <th style={cellStyle}>Dark Mode</th>
            <th style={cellStyle}>Notes</th>
          </tr>
        </thead>
        <tbody>
          <tr style={rowStyle}>
            <td style={cellStyle}><span style={swatchStyle('#28a745')} /></td>
            <td style={cellStyle}><code>--color-success</code></td>
            <td style={cellStyle}>#28a745</td>
            <td style={cellStyle}>#40c057</td>
            <td style={cellStyle}>4.5:1 (AA pass). Use white text on solid backgrounds.</td>
          </tr>
          <tr style={rowStyle}>
            <td style={cellStyle}><span style={swatchStyle('#dc3545')} /></td>
            <td style={cellStyle}><code>--color-danger</code></td>
            <td style={cellStyle}>#dc3545</td>
            <td style={cellStyle}>#fa5252</td>
            <td style={cellStyle}>4.0:1 (AA large text only). Pair with icons for non-color indicators.</td>
          </tr>
          <tr style={rowStyle}>
            <td style={cellStyle}><span style={swatchStyle('#ffc107')} /></td>
            <td style={cellStyle}><code>--color-warning</code></td>
            <td style={cellStyle}>#ffc107</td>
            <td style={cellStyle}>#ffd43b</td>
            <td style={cellStyle}>1.1:1 on white — <strong>background only</strong>. Always use dark text.</td>
          </tr>
          <tr style={rowStyle}>
            <td style={cellStyle}><span style={swatchStyle('#17a2b8')} /></td>
            <td style={cellStyle}><code>--color-info</code></td>
            <td style={cellStyle}>#17a2b8</td>
            <td style={cellStyle}>#339af0</td>
            <td style={cellStyle}>3.2:1 (AA large text only). Use dark text for normal-size content.</td>
          </tr>
        </tbody>
      </table>
      
      <h3>Text Colors</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
        <thead>
          <tr style={headerRowStyle}>
            <th style={cellStyle}>Variable</th>
            <th style={cellStyle}>Hex</th>
            <th style={cellStyle}>Contrast</th>
            <th style={cellStyle}>Usage</th>
          </tr>
        </thead>
        <tbody>
          <tr style={rowStyle}>
            <td style={cellStyle}><code>--color-text-primary</code></td>
            <td style={cellStyle}>#1a202c</td>
            <td style={cellStyle}>16.0:1 (AAA)</td>
            <td style={cellStyle}>Body text, headings</td>
          </tr>
          <tr style={rowStyle}>
            <td style={cellStyle}><code>--color-text-secondary</code></td>
            <td style={cellStyle}>#2d3748</td>
            <td style={cellStyle}>12.6:1 (AAA)</td>
            <td style={cellStyle}>Secondary content</td>
          </tr>
          <tr style={rowStyle}>
            <td style={cellStyle}><code>--color-text-tertiary</code></td>
            <td style={cellStyle}>#4a5568</td>
            <td style={cellStyle}>7.0:1 (AAA)</td>
            <td style={cellStyle}>Captions, metadata</td>
          </tr>
          <tr style={rowStyle}>
            <td style={cellStyle}><code>--color-text-muted</code></td>
            <td style={cellStyle}>#5a6370</td>
            <td style={cellStyle}>5.2:1 (AA)</td>
            <td style={cellStyle}>Placeholder-style, subtle labels</td>
          </tr>
          <tr style={rowStyle}>
            <td style={cellStyle}><code>--color-text-disabled</code></td>
            <td style={cellStyle}>#9ca3af</td>
            <td style={cellStyle}>3.0:1</td>
            <td style={cellStyle}>Disabled state only (decorative)</td>
          </tr>
        </tbody>
      </table>

      <h3>Design Tokens</h3>
      <p>Design tokens are defined as SASS variables in <code>src/styles/scss/abstracts/_variables.scss</code> and auto-generated as CSS custom properties in <code>src/styles/scss/abstracts/_tokens.scss</code>. Runtime overrides (dark mode, mobile) live in <code>src/styles/design-tokens.scss</code>.</p>
      
      <h4>Spacing Tokens</h4>
      <ul>
        <li><code>--space-0</code> (0) through <code>--space-24</code> (6rem/96px)</li>
        <li>Half-steps: <code>--space-1-5</code> (0.375rem/6px), <code>--space-2-5</code> (0.625rem/10px)</li>
        <li>Mobile-optimized: <code>--space-mobile-xs</code> through <code>--space-mobile-xl</code></li>
      </ul>
      
      <h4>Typography Tokens</h4>
      <ul>
        <li>Font sizes: <code>--font-size-xs</code> through <code>--font-size-5xl</code> (responsive via <code>clamp()</code>)</li>
        <li>Font weights: <code>--font-weight-light</code> (300) through <code>--font-weight-extrabold</code> (800)</li>
        <li>Line heights: <code>--line-height-none</code> (1) through <code>--line-height-loose</code> (2)</li>
        <li>Letter spacing: <code>--letter-spacing-tighter</code> (-0.05em) through <code>--letter-spacing-widest</code> (0.1em)</li>
      </ul>
      
      <h4>Border Radius Tokens</h4>
      <ul>
        <li><code>--radius-none</code> — 0</li>
        <li><code>--radius-sm</code> — 0.375rem (6px)</li>
        <li><code>--radius-md</code> — 0.5rem (8px)</li>
        <li><code>--radius-lg</code> — 0.75rem (12px)</li>
        <li><code>--radius-xl</code> — 1rem (16px)</li>
        <li><code>--radius-2xl</code> — 1.5rem (24px)</li>
        <li><code>--radius-full</code> — 9999px</li>
      </ul>

      <h4>Shadow Tokens</h4>
      <ul>
        <li><code>--shadow-xs</code> — subtle elevation</li>
        <li><code>--shadow-sm</code> — cards, buttons</li>
        <li><code>--shadow-md</code> — hover states</li>
        <li><code>--shadow-lg</code> — modals, dropdowns</li>
        <li><code>--shadow-xl</code> — prominent overlays</li>
        <li><code>--shadow-2xl</code> — highest elevation</li>
      </ul>

      <h4>Transition Tokens</h4>
      <ul>
        <li><code>--transition-fast</code> — 0.15s (micro-interactions)</li>
        <li><code>--transition-base</code> — 0.2s (standard UI transitions)</li>
        <li><code>--transition-normal</code> — 0.3s (page elements, cards)</li>
        <li><code>--transition-slow</code> — 0.5s (complex animations)</li>
      </ul>
      
      <hr />
      
      <h2>Modern CSS Standards</h2>
      <p>The design system follows modern CSS best practices (2025+ baseline):</p>
      
      <h3>Prefer Standard Properties</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
        <thead>
          <tr style={headerRowStyle}>
            <th style={cellStyle}>Modern (Preferred)</th>
            <th style={cellStyle}>Legacy (Deprecated/Fallback)</th>
            <th style={cellStyle}>Notes</th>
          </tr>
        </thead>
        <tbody>
          <tr style={rowStyle}>
            <td style={cellStyle}><code>clip-path: inset(50%)</code></td>
            <td style={cellStyle}><code>clip: rect(0,0,0,0)</code></td>
            <td style={cellStyle}>For visually-hidden/sr-only. Both included for coverage.</td>
          </tr>
          <tr style={rowStyle}>
            <td style={cellStyle}><code>aspect-ratio: 16 / 9</code></td>
            <td style={cellStyle}><code>padding-bottom: 56.25%</code></td>
            <td style={cellStyle}>Native property (Baseline 2021). Fallback via <code>@supports</code>.</td>
          </tr>
          <tr style={rowStyle}>
            <td style={cellStyle}><code>:focus-visible</code></td>
            <td style={cellStyle}><code>:focus</code></td>
            <td style={cellStyle}>Only shows focus ring on keyboard navigation, not mouse clicks.</td>
          </tr>
          <tr style={rowStyle}>
            <td style={cellStyle}><code>scrollbar-width: thin</code></td>
            <td style={cellStyle}><code>::-webkit-scrollbar</code></td>
            <td style={cellStyle}>Standard property. WebKit prefix kept for Safari.</td>
          </tr>
          <tr style={rowStyle}>
            <td style={cellStyle}><code>color-scheme: light dark</code></td>
            <td style={cellStyle}>—</td>
            <td style={cellStyle}>Informs UA about supported themes for native controls.</td>
          </tr>
          <tr style={rowStyle}>
            <td style={cellStyle}>(removed)</td>
            <td style={cellStyle}><code>-webkit-overflow-scrolling: touch</code></td>
            <td style={cellStyle}>No longer needed — all modern browsers handle momentum scrolling natively.</td>
          </tr>
          <tr style={rowStyle}>
            <td style={cellStyle}>(removed)</td>
            <td style={cellStyle}><code>-ms-overflow-style: none</code></td>
            <td style={cellStyle}>IE/Edge legacy only. Use <code>scrollbar-width: none</code> instead.</td>
          </tr>
        </tbody>
      </table>
      
      <h3>Font Smoothing</h3>
      <p><code>-webkit-font-smoothing: antialiased</code> and <code>-moz-osx-font-smoothing: grayscale</code> are non-standard. Use only when subpixel rendering causes visual issues on macOS. The mixin is available but should be applied sparingly.</p>
      
      <hr />
      
      <h2>Components</h2>
      
      <h3>Component Architecture</h3>
      <p>All components follow these principles:</p>
      <ul>
        <li><strong>Design Token Usage</strong> — Use CSS variables exclusively, no hardcoded values</li>
        <li><strong>Accessibility</strong> — WCAG 2.1 AA compliant, keyboard navigation, ARIA labels, focus-visible</li>
        <li><strong>Responsive</strong> — Mobile-first design with <code>clamp()</code> typography and breakpoint mixins</li>
        <li><strong>Dark Mode</strong> — Full dark mode support via <code>color-scheme</code> and CSS custom properties</li>
        <li><strong>Reusability</strong> — Props for customization, well-documented</li>
      </ul>
      
      <h3>Available Components</h3>
      <ul>
        <li><strong>Button</strong> — Primary, secondary, outline, danger, success, link variants</li>
        <li><strong>Pill</strong> — Status indicators and badges with semantic color coding</li>
        <li><strong>SkeletonLoader</strong> — Loading placeholders (text, circle, rectangle)</li>
        <li><strong>Form</strong> — Unified form components with validation and accessibility</li>
        <li><strong>Table</strong> — Responsive data tables</li>
        <li><strong>Animation</strong> — FadeIn, SlideUp, ScaleIn with reduced-motion support</li>
        <li><strong>Responsive</strong> — Show/Hide based on breakpoints</li>
      </ul>
      
      <hr />
      
      <h2>WCAG Compliance</h2>
      <p>The application targets <strong>WCAG 2.1 Level AA</strong> with several AAA enhancements.</p>

      <h3>Key Requirements</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
        <thead>
          <tr style={headerRowStyle}>
            <th style={cellStyle}>Requirement</th>
            <th style={cellStyle}>Level</th>
            <th style={cellStyle}>Implementation</th>
          </tr>
        </thead>
        <tbody>
          <tr style={rowStyle}>
            <td style={cellStyle}>Color Contrast (1.4.3)</td>
            <td style={cellStyle}>AA</td>
            <td style={cellStyle}>4.5:1 normal text, 3:1 large text. Verified in style guide.</td>
          </tr>
          <tr style={rowStyle}>
            <td style={cellStyle}>Focus Visible (2.4.7 / 2.4.11)</td>
            <td style={cellStyle}>AA</td>
            <td style={cellStyle}><code>:focus-visible</code> with 2px primary outline, 2px offset. Mouse focus suppressed.</td>
          </tr>
          <tr style={rowStyle}>
            <td style={cellStyle}>Target Size (2.5.8)</td>
            <td style={cellStyle}>AA (24px)</td>
            <td style={cellStyle}>Enforced at 44px globally — exceeds AA, meets AAA (2.5.5 in WCAG 2.1).</td>
          </tr>
          <tr style={rowStyle}>
            <td style={cellStyle}>Reduced Motion (2.3.3)</td>
            <td style={cellStyle}>AAA</td>
            <td style={cellStyle}><code>prefers-reduced-motion: reduce</code> disables all animations globally.</td>
          </tr>
          <tr style={rowStyle}>
            <td style={cellStyle}>High Contrast (1.4.11)</td>
            <td style={cellStyle}>AA</td>
            <td style={cellStyle}><code>prefers-contrast: high</code> adds 2px borders and underlines.</td>
          </tr>
          <tr style={rowStyle}>
            <td style={cellStyle}>Bypass Blocks (2.4.1)</td>
            <td style={cellStyle}>A</td>
            <td style={cellStyle}>Skip-link in <code>accessibility.scss</code>, visible on keyboard focus.</td>
          </tr>
          <tr style={rowStyle}>
            <td style={cellStyle}>Non-Color Indicators (1.4.1)</td>
            <td style={cellStyle}>A</td>
            <td style={cellStyle}>Always pair color with icons, text labels, or patterns.</td>
          </tr>
        </tbody>
      </table>

      <h3>CSS Color Warnings</h3>
      <ul>
        <li><strong><code>--color-primary</code> (#667eea)</strong> — 4.35:1 on white. <em>Fails AA for normal text.</em> Use <code>--color-primary-hover</code> (#5a67d8, 5.3:1) for body text instead.</li>
        <li><strong><code>--color-danger</code> (#dc3545)</strong> — 4.0:1 on white. Passes AA for large text only. Always pair with an icon.</li>
        <li><strong><code>--color-warning</code> (#ffc107)</strong> — 1.1:1 on white. <em>Background only.</em> Always use dark text (<code>--color-text-primary</code>).</li>
        <li><strong><code>--color-info</code> (#17a2b8)</strong> — 3.2:1 on white. Passes AA for large text only.</li>
      </ul>

      <hr />
      
      <h2>Best Practices</h2>
      
      <h3>CSS</h3>
      <ul>
        <li>Use design tokens exclusively — no hardcoded colors, spacing, or sizes</li>
        <li>Mobile-first responsive design with <code>clamp()</code> and breakpoint mixins</li>
        <li>camelCase for CSS Module class names (e.g., <code>.myComponent</code>)</li>
        <li>Avoid <code>!important</code> (use specificity instead)</li>
        <li>Use <code>:focus-visible</code> instead of <code>:focus</code> for interactive elements</li>
        <li>Prefer standard CSS properties over vendor prefixes</li>
        <li>Include <code>prefers-reduced-motion</code> support for all animations</li>
      </ul>
      
      <h3>Accessibility Checklist</h3>
      <ul>
        <li>✓ <strong>WCAG AA Contrast</strong>: 4.5:1 for normal text, 3:1 for large text and UI components</li>
        <li>✓ <strong>Focus Indicators</strong>: <code>:focus-visible</code> on all interactive elements</li>
        <li>✓ <strong>Keyboard Navigation</strong>: All functionality accessible via keyboard</li>
        <li>✓ <strong>ARIA Labels</strong>: All icon-only buttons have <code>aria-label</code></li>
        <li>✓ <strong>Semantic HTML</strong>: Use proper HTML5 elements and roles</li>
        <li>✓ <strong>Touch Targets</strong>: 44px minimum on all interactive elements</li>
        <li>✓ <strong>Reduced Motion</strong>: Animations disabled when user prefers</li>
        <li>✓ <strong>Non-Color Indicators</strong>: Never use color alone to convey information</li>
      </ul>
    </div>
  ),
};

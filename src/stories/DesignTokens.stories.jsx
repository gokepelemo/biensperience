import React from 'react';

export default {
  title: 'Design System/Design Tokens',
  parameters: {
    layout: 'fullscreen',
  },
};

export const Overview = {
  render: () => (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', color: 'var(--color-text-primary)' }}>
      <h1>Design Tokens</h1>
      <p>
        Design tokens are the visual design atoms of the design system — specifically, they are named entities 
        that store visual design attributes. We use them in place of hard-coded values to maintain a consistent 
        and scalable design system.
      </p>
      <p style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-primary)' }}>
        ✨ Toggle between light and dark mode using the theme switcher in the toolbar to see the design tokens adapt automatically.
      </p>

      <hr style={{ margin: '2rem 0', borderColor: 'var(--color-border-medium)' }} />

      <h2>Colors</h2>

      <h3>Primary Colors</h3>
      <p>The primary color palette establishes the brand identity and is used for key interactive elements.</p>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
        gap: 'var(--space-4)', 
        marginBottom: 'var(--space-8)' 
      }}>
        <div>
          <div style={{
            background: 'var(--gradient-primary)',
            height: '100px',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--space-2)',
            boxShadow: 'var(--shadow-sm)'
          }}></div>
          <strong>Primary Gradient</strong>
          <br />
          <code>var(--gradient-primary)</code>
        </div>
        
        <div>
          <div style={{
            background: 'var(--color-primary)',
            height: '100px',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--space-2)',
            boxShadow: 'var(--shadow-sm)'
          }}></div>
          <strong>Primary Blue</strong>
          <br />
          <code>var(--color-primary)</code>
        </div>
        
        <div>
          <div style={{
            background: 'var(--color-primary-dark)',
            height: '100px',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--space-2)',
            boxShadow: 'var(--shadow-sm)'
          }}></div>
          <strong>Primary Purple</strong>
          <br />
          <code>var(--color-primary-dark)</code>
        </div>
      </div>

      <h3>Semantic Colors</h3>
      <p>Bootstrap's semantic colors communicate meaning and state. These adapt to dark mode for better contrast.</p>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
        gap: 'var(--space-4)', 
        marginBottom: 'var(--space-8)' 
      }}>
        <div>
          <div style={{ background: 'var(--color-success)', height: '80px', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-2)' }}></div>
          <strong>Success</strong> • <code>var(--color-success)</code>
        </div>
        <div>
          <div style={{ background: 'var(--color-warning)', height: '80px', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-2)' }}></div>
          <strong>Warning</strong> • <code>var(--color-warning)</code>
        </div>
        <div>
          <div style={{ background: 'var(--color-danger)', height: '80px', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-2)' }}></div>
          <strong>Danger</strong> • <code>var(--color-danger)</code>
        </div>
        <div>
          <div style={{ background: 'var(--color-info)', height: '80px', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-2)' }}></div>
          <strong>Info</strong> • <code>var(--color-info)</code>
        </div>
      </div>

      <h3>Text & Background Colors</h3>
      <p>Text and background colors automatically adapt to light and dark modes for optimal readability.</p>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
        gap: 'var(--space-4)', 
        marginBottom: 'var(--space-8)' 
      }}>
        <div>
          <div style={{
            background: 'var(--color-bg-primary)', 
            height: '80px', 
            borderRadius: 'var(--radius-md)', 
            marginBottom: 'var(--space-2)', 
            border: '2px solid var(--color-border-medium)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-text-primary)',
            fontWeight: 'var(--font-weight-semibold)'
          }}>Primary BG</div>
          <strong>Background Primary</strong> • <code>var(--color-bg-primary)</code>
        </div>
        <div>
          <div style={{
            background: 'var(--color-bg-secondary)', 
            height: '80px', 
            borderRadius: 'var(--radius-md)', 
            marginBottom: 'var(--space-2)', 
            border: '2px solid var(--color-border-medium)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-text-primary)',
            fontWeight: 'var(--font-weight-semibold)'
          }}>Secondary BG</div>
          <strong>Background Secondary</strong> • <code>var(--color-bg-secondary)</code>
        </div>
        <div>
          <div style={{
            background: 'var(--color-bg-tertiary)', 
            height: '80px', 
            borderRadius: 'var(--radius-md)', 
            marginBottom: 'var(--space-2)', 
            color: 'var(--color-text-primary)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            fontWeight: 'var(--font-weight-bold)',
            fontSize: 'var(--font-size-lg)'
          }}>Text</div>
          <strong>Text Primary</strong> • <code>var(--color-text-primary)</code>
        </div>
        <div>
          <div style={{
            background: 'var(--color-bg-tertiary)', 
            height: '80px', 
            borderRadius: 'var(--radius-md)', 
            marginBottom: 'var(--space-2)', 
            color: 'var(--color-text-muted)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            fontWeight: 'var(--font-weight-medium)',
            fontSize: 'var(--font-size-base)'
          }}>Muted</div>
          <strong>Text Muted</strong> • <code>var(--color-text-muted)</code>
        </div>
      </div>

      <hr style={{ margin: '2rem 0', borderColor: 'var(--color-border-medium)' }} />

      <h2>Typography</h2>

      <h3>Font Family</h3>
      <pre style={{ 
        background: 'var(--color-bg-secondary)', 
        padding: 'var(--space-4)', 
        borderRadius: 'var(--radius-md)',
        color: 'var(--color-text-primary)'
      }}>
        {`font-family: var(--font-family-base);
/* -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
   'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif */`}
      </pre>

      <h3>Type Scale</h3>
      <p>All typography uses design tokens for responsive sizing.</p>

      <div style={{ marginBottom: 'var(--space-8)' }}>
        <div style={{ fontSize: 'var(--font-size-4xl)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--space-4)' }}>
          Heading 1
        </div>
        <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--space-4)' }}>
          Heading 2
        </div>
        <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--space-4)' }}>
          Heading 3
        </div>
        <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--space-4)' }}>
          Heading 4
        </div>
        <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--space-4)' }}>
          Heading 5
        </div>
        <div style={{ fontSize: 'var(--font-size-base)', marginBottom: 'var(--space-4)' }}>
          Body Text - The quick brown fox jumps over the lazy dog
        </div>
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
          Small Text - Helper text and captions
        </div>
      </div>

      <h3>Font Weights</h3>

      <div style={{ marginBottom: 'var(--space-8)' }}>
        <div style={{ fontWeight: 'var(--font-weight-regular)', fontSize: 'var(--font-size-lg)', marginBottom: 'var(--space-2)' }}>
          Regular (400) - Default text weight
        </div>
        <div style={{ fontWeight: 'var(--font-weight-medium)', fontSize: 'var(--font-size-lg)', marginBottom: 'var(--space-2)' }}>
          Medium (500) - Slight emphasis
        </div>
        <div style={{ fontWeight: 'var(--font-weight-semibold)', fontSize: 'var(--font-size-lg)', marginBottom: 'var(--space-2)' }}>
          Semi-Bold (600) - Strong emphasis
        </div>
        <div style={{ fontWeight: 'var(--font-weight-bold)', fontSize: 'var(--font-size-lg)', marginBottom: 'var(--space-2)' }}>
          Bold (700) - Headings and CTAs
        </div>
      </div>

      <hr style={{ margin: '2rem 0', borderColor: 'var(--color-border-medium)' }} />

      <h2>Spacing</h2>
      <p>Bootstrap's spacing utilities use a consistent scale from design tokens:</p>

      <table style={{ 
        width: '100%', 
        borderCollapse: 'collapse', 
        marginBottom: '2rem',
        background: 'var(--color-bg-secondary)',
        borderRadius: 'var(--radius-md)'
      }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--color-border-medium)' }}>
            <th style={{ padding: '0.75rem', textAlign: 'left' }}>Token</th>
            <th style={{ padding: '0.75rem', textAlign: 'left' }}>CSS Variable</th>
            <th style={{ padding: '0.75rem', textAlign: 'left' }}>Value</th>
            <th style={{ padding: '0.75rem', textAlign: 'left' }}>Example Use</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ borderBottom: '1px solid var(--color-border-light)' }}>
            <td style={{ padding: '0.75rem' }}><code>0</code></td>
            <td style={{ padding: '0.75rem' }}><code>var(--space-0)</code></td>
            <td style={{ padding: '0.75rem' }}>0</td>
            <td style={{ padding: '0.75rem' }}>No spacing</td>
          </tr>
          <tr style={{ borderBottom: '1px solid var(--color-border-light)' }}>
            <td style={{ padding: '0.75rem' }}><code>1</code></td>
            <td style={{ padding: '0.75rem' }}><code>var(--space-1)</code></td>
            <td style={{ padding: '0.75rem' }}>0.25rem (4px)</td>
            <td style={{ padding: '0.75rem' }}>Tight spacing</td>
          </tr>
          <tr style={{ borderBottom: '1px solid var(--color-border-light)' }}>
            <td style={{ padding: '0.75rem' }}><code>2</code></td>
            <td style={{ padding: '0.75rem' }}><code>var(--space-2)</code></td>
            <td style={{ padding: '0.75rem' }}>0.5rem (8px)</td>
            <td style={{ padding: '0.75rem' }}>Small gaps</td>
          </tr>
          <tr style={{ borderBottom: '1px solid var(--color-border-light)' }}>
            <td style={{ padding: '0.75rem' }}><code>3</code></td>
            <td style={{ padding: '0.75rem' }}><code>var(--space-3)</code></td>
            <td style={{ padding: '0.75rem' }}>0.75rem (12px)</td>
            <td style={{ padding: '0.75rem' }}>Compact spacing</td>
          </tr>
          <tr style={{ borderBottom: '1px solid var(--color-border-light)' }}>
            <td style={{ padding: '0.75rem' }}><code>4</code></td>
            <td style={{ padding: '0.75rem' }}><code>var(--space-4)</code></td>
            <td style={{ padding: '0.75rem' }}>1rem (16px)</td>
            <td style={{ padding: '0.75rem' }}>Default spacing</td>
          </tr>
          <tr style={{ borderBottom: '1px solid var(--color-border-light)' }}>
            <td style={{ padding: '0.75rem' }}><code>5</code></td>
            <td style={{ padding: '0.75rem' }}><code>var(--space-5)</code></td>
            <td style={{ padding: '0.75rem' }}>1.25rem (20px)</td>
            <td style={{ padding: '0.75rem' }}>Medium spacing</td>
          </tr>
          <tr style={{ borderBottom: '1px solid var(--color-border-light)' }}>
            <td style={{ padding: '0.75rem' }}><code>6</code></td>
            <td style={{ padding: '0.75rem' }}><code>var(--space-6)</code></td>
            <td style={{ padding: '0.75rem' }}>1.5rem (24px)</td>
            <td style={{ padding: '0.75rem' }}>Section spacing</td>
          </tr>
          <tr>
            <td style={{ padding: '0.75rem' }}><code>8</code></td>
            <td style={{ padding: '0.75rem' }}><code>var(--space-8)</code></td>
            <td style={{ padding: '0.75rem' }}>2rem (32px)</td>
            <td style={{ padding: '0.75rem' }}>Large sections</td>
          </tr>
        </tbody>
      </table>

      <h3>Common Spacing Patterns</h3>
      <ul>
        <li><strong>Form sections</strong>: <code>margin-bottom: var(--space-6)</code></li>
        <li><strong>Button groups</strong>: <code>gap: var(--space-2)</code></li>
        <li><strong>Card padding</strong>: <code>padding: var(--space-4)</code> or <code>var(--space-6)</code></li>
        <li><strong>Page margins</strong>: <code>margin: var(--space-8) 0</code></li>
      </ul>

      <hr style={{ margin: '2rem 0', borderColor: 'var(--color-border-medium)' }} />

      <h2>Border Radius</h2>
      <p>All border radii use design tokens for consistency:</p>

      <table style={{ 
        width: '100%', 
        borderCollapse: 'collapse', 
        marginBottom: '2rem',
        background: 'var(--color-bg-secondary)',
        borderRadius: 'var(--radius-md)'
      }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--color-border-medium)' }}>
            <th style={{ padding: '0.75rem', textAlign: 'left' }}>Token</th>
            <th style={{ padding: '0.75rem', textAlign: 'left' }}>CSS Variable</th>
            <th style={{ padding: '0.75rem', textAlign: 'left' }}>Value</th>
            <th style={{ padding: '0.75rem', textAlign: 'left' }}>Usage</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ borderBottom: '1px solid var(--color-border-light)' }}>
            <td style={{ padding: '0.75rem' }}><code>sm</code></td>
            <td style={{ padding: '0.75rem' }}><code>var(--radius-sm)</code></td>
            <td style={{ padding: '0.75rem' }}>0.375rem</td>
            <td style={{ padding: '0.75rem' }}>Small elements</td>
          </tr>
          <tr style={{ borderBottom: '1px solid var(--color-border-light)' }}>
            <td style={{ padding: '0.75rem' }}><code>md</code></td>
            <td style={{ padding: '0.75rem' }}><code>var(--radius-md)</code></td>
            <td style={{ padding: '0.75rem' }}>0.5rem</td>
            <td style={{ padding: '0.75rem' }}>Cards, inputs</td>
          </tr>
          <tr style={{ borderBottom: '1px solid var(--color-border-light)' }}>
            <td style={{ padding: '0.75rem' }}><code>lg</code></td>
            <td style={{ padding: '0.75rem' }}><code>var(--radius-lg)</code></td>
            <td style={{ padding: '0.75rem' }}>0.75rem</td>
            <td style={{ padding: '0.75rem' }}>Large cards</td>
          </tr>
          <tr style={{ borderBottom: '1px solid var(--color-border-light)' }}>
            <td style={{ padding: '0.75rem' }}><code>xl</code></td>
            <td style={{ padding: '0.75rem' }}><code>var(--radius-xl)</code></td>
            <td style={{ padding: '0.75rem' }}>1rem</td>
            <td style={{ padding: '0.75rem' }}>Hero sections</td>
          </tr>
          <tr>
            <td style={{ padding: '0.75rem' }}><code>full</code></td>
            <td style={{ padding: '0.75rem' }}><code>var(--radius-full)</code></td>
            <td style={{ padding: '0.75rem' }}>9999px</td>
            <td style={{ padding: '0.75rem' }}>Pills, badges</td>
          </tr>
        </tbody>
      </table>

      <hr style={{ margin: '2rem 0', borderColor: 'var(--color-border-medium)' }} />

      <h2>Shadows</h2>
      <p>Shadows adapt to light and dark modes automatically.</p>

      <div style={{ marginBottom: 'var(--space-8)' }}>
        <div style={{
          padding: 'var(--space-8)', 
          background: 'var(--color-bg-primary)', 
          borderRadius: 'var(--radius-md)', 
          boxShadow: 'var(--shadow-sm)', 
          marginBottom: 'var(--space-4)',
          border: '1px solid var(--color-border-light)'
        }}>
          <strong>Small Shadow</strong>
          <br />
          <code>box-shadow: var(--shadow-sm)</code>
        </div>
        
        <div style={{
          padding: 'var(--space-8)', 
          background: 'var(--color-bg-primary)', 
          borderRadius: 'var(--radius-md)', 
          boxShadow: 'var(--shadow-md)', 
          marginBottom: 'var(--space-4)',
          border: '1px solid var(--color-border-light)'
        }}>
          <strong>Medium Shadow</strong>
          <br />
          <code>box-shadow: var(--shadow-md)</code>
        </div>
        
        <div style={{
          padding: 'var(--space-8)', 
          background: 'var(--color-bg-primary)', 
          borderRadius: 'var(--radius-md)', 
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--color-border-light)'
        }}>
          <strong>Large Shadow</strong>
          <br />
          <code>box-shadow: var(--shadow-lg)</code>
        </div>
      </div>

      <hr style={{ margin: '2rem 0', borderColor: 'var(--color-border-medium)' }} />

      <h2>Animations</h2>

      <h3>Timing Functions</h3>
      <pre style={{ 
        background: 'var(--color-bg-secondary)', 
        padding: 'var(--space-4)', 
        borderRadius: 'var(--radius-md)',
        color: 'var(--color-text-primary)'
      }}>
        {`/* Use design token transitions */
--transition-fast: 0.15s cubic-bezier(0.4, 0, 0.2, 1);
--transition-base: 0.2s cubic-bezier(0.4, 0, 0.2, 1);
--transition-normal: 0.3s cubic-bezier(0.4, 0, 0.2, 1);
--transition-slow: 0.5s cubic-bezier(0.4, 0, 0.2, 1);`}
      </pre>

      <h3>Duration Tokens</h3>
      <ul>
        <li><strong>Fast</strong> (<code>var(--transition-fast)</code>): 0.15s - Micro-interactions</li>
        <li><strong>Base</strong> (<code>var(--transition-base)</code>): 0.2s - Quick feedback</li>
        <li><strong>Normal</strong> (<code>var(--transition-normal)</code>): 0.3s - Standard transitions</li>
        <li><strong>Slow</strong> (<code>var(--transition-slow)</code>): 0.5s - Complex animations</li>
      </ul>

      <hr style={{ margin: '2rem 0', borderColor: 'var(--color-border-medium)' }} />

      <h2>Dark Mode Support</h2>
      <p>All design tokens automatically adapt to dark mode using CSS <code>prefers-color-scheme</code>.</p>

      <h3>Dark Mode Features</h3>
      <ul>
        <li>✅ <strong>Automatic Detection</strong>: System preference detection</li>
        <li>✅ <strong>Semantic Colors</strong>: Adjusted for better contrast in dark mode</li>
        <li>✅ <strong>Text Colors</strong>: Inverted for readability</li>
        <li>✅ <strong>Background Colors</strong>: Dark backgrounds with proper depth</li>
        <li>✅ <strong>Borders & Shadows</strong>: Adapted opacity for dark theme</li>
        <li>✅ <strong>Component Compatibility</strong>: All components support dark mode</li>
      </ul>

      <p style={{ 
        padding: 'var(--space-4)', 
        background: 'var(--color-info-bg)', 
        border: '1px solid var(--color-info-border)',
        borderRadius: 'var(--radius-md)',
        color: 'var(--color-info-text)'
      }}>
        <strong>Testing Dark Mode:</strong> Use the theme switcher in the Storybook toolbar (sun/moon icon) to toggle 
        between light and dark modes and see how all tokens adapt automatically.
      </p>

      <hr style={{ margin: '2rem 0', borderColor: 'var(--color-border-medium)' }} />

      <h2>Usage Guidelines</h2>

      <h3>Consistency</h3>
      <ul>
        <li>Always use design tokens instead of hard-coded values</li>
        <li>Reference tokens through CSS variables or utility classes</li>
        <li>Maintain consistent spacing between similar elements</li>
      </ul>

      <h3>Accessibility</h3>
      <ul>
        <li>Ensure color contrast ratios meet WCAG 2.1 AA standards (4.5:1 for text)</li>
        <li>Use semantic colors meaningfully</li>
        <li>Don't rely on color alone to convey information</li>
      </ul>

      <h3>Performance</h3>
      <ul>
        <li>Prefer CSS custom properties for dynamic values</li>
        <li>Use transform and opacity for animations (GPU accelerated)</li>
        <li>Keep animation durations between 200-500ms</li>
      </ul>
    </div>
  ),
};

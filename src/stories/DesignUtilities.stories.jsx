import React from 'react';
import '../styles/utilities.css';
import '../styles/design-tokens.css';

export default {
  title: 'Design System/Utilities',
  parameters: {
    layout: 'padded',
    docs: {
      page: () => (
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: '1rem' }}>
          <h1 style={{ marginBottom: '0.5rem' }}>Utilities</h1>
          <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
            Reusable utility classes designed for fast, consistent UI construction. Utilities are token-driven and dark-mode aware.
          </p>
          <hr style={{ margin: '1.25rem 0' }} />

          <h2>Categories</h2>
          <ul>
            <li><strong>Buttons</strong>: .btn-gradient, .btn-outline-custom, .btn-rounded, .btn-shadow</li>
            <li><strong>Layout</strong>: .flex-between, .flex-center, .space-y-[1-6]</li>
            <li><strong>Typography</strong>: .text-gradient, .text-shadow, .text-truncate-[1-3]</li>
            <li><strong>Feedback</strong>: .skeleton-text, .skeleton-circle, .skeleton-rectangle</li>
            <li><strong>Forms</strong>: .form-unified</li>
            <li><strong>Tables</strong>: .table-unified</li>
            <li><strong>Responsive</strong>: .show-mobile, .hide-mobile</li>
          </ul>

          <h2>Guidelines</h2>
          <ul>
            <li>Prefer utility classes for spacing and layout primitives</li>
            <li>Use component classes for complex patterns (cards, modals)</li>
            <li>Never hardcode colors; rely on design tokens</li>
          </ul>
        </div>
      ),
      description: {
        component: 'Comprehensive utility classes from utilities.css. Includes buttons, forms, tables, layout helpers, text utilities, and more.',
      },
    },
  },
  tags: [],
};

// Button utilities
export const ButtonUtilities = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h4 className="mb-3">Gradient Buttons</h4>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn-gradient">Primary Action</button>
          <button className="btn-gradient" disabled>Disabled</button>
          <button className="btn-gradient btn-rounded">Rounded</button>
          <button className="btn-gradient btn-shadow">With Shadow</button>
        </div>
      </div>

      <div>
        <h4 className="mb-3">Outline Buttons</h4>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn-outline-custom">Secondary Action</button>
          <button className="btn-outline-custom" disabled>Disabled</button>
          <button className="btn-outline-custom btn-rounded">Rounded</button>
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Button utility classes: .btn-gradient, .btn-outline-custom, .btn-rounded, .btn-shadow',
      },
    },
  },
};

// Skeleton loaders
export const SkeletonLoaders = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '600px' }}>
      <div>
        <h4 className="mb-3">Text Skeletons</h4>
        <div className="skeleton-text" style={{ width: '80%' }}></div>
        <div className="skeleton-text" style={{ width: '60%' }}></div>
        <div className="skeleton-text" style={{ width: '90%' }}></div>
      </div>

      <div>
        <h4 className="mb-3">Image Skeletons</h4>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div className="skeleton-circle" style={{ width: '60px', height: '60px' }}></div>
          <div style={{ flex: 1 }}>
            <div className="skeleton-text" style={{ width: '70%' }}></div>
            <div className="skeleton-text" style={{ width: '50%' }}></div>
          </div>
        </div>
      </div>

      <div>
        <h4 className="mb-3">Card Skeleton</h4>
        <div className="skeleton-rectangle" style={{ height: '200px', borderRadius: '8px' }}></div>
        <div className="skeleton-text mt-2" style={{ width: '70%' }}></div>
        <div className="skeleton-text" style={{ width: '50%' }}></div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Skeleton loader classes: .skeleton-text, .skeleton-circle, .skeleton-rectangle',
      },
    },
  },
};

// Pills
export const Pills = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h4 className="mb-3">Default Pills</h4>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span className="pill">Tag 1</span>
          <span className="pill">Tag 2</span>
          <span className="pill">Tag 3</span>
          <span className="pill">Long Tag Name</span>
        </div>
      </div>

      <div>
        <h4 className="mb-3">Color Variants</h4>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span className="pill pill-primary">Primary</span>
          <span className="pill pill-success">Success</span>
          <span className="pill pill-warning">Warning</span>
          <span className="pill pill-danger">Danger</span>
          <span className="pill pill-info">Info</span>
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Pill/badge classes: .pill with color variants (.pill-primary, .pill-success, etc.)',
      },
    },
  },
};

// Layout utilities
export const LayoutUtilities = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h4 className="mb-3">Flex Between</h4>
        <div className="flex-between" style={{ border: '1px solid #ddd', padding: '1rem', borderRadius: '8px' }}>
          <span>Left Content</span>
          <span>Right Content</span>
        </div>
      </div>

      <div>
        <h4 className="mb-3">Flex Center</h4>
        <div className="flex-center" style={{ border: '1px solid #ddd', padding: '2rem', borderRadius: '8px' }}>
          <span>Centered Content</span>
        </div>
      </div>

      <div>
        <h4 className="mb-3">Space Y (Vertical Spacing)</h4>
        <div className="space-y-2" style={{ border: '1px solid #ddd', padding: '1rem', borderRadius: '8px' }}>
          <div style={{ background: '#f0f0f0', padding: '0.5rem', borderRadius: '4px' }}>Item 1</div>
          <div style={{ background: '#f0f0f0', padding: '0.5rem', borderRadius: '4px' }}>Item 2</div>
          <div style={{ background: '#f0f0f0', padding: '0.5rem', borderRadius: '4px' }}>Item 3</div>
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Layout utilities: .flex-between, .flex-center, .space-y-* (1-6)',
      },
    },
  },
};

// Text utilities
export const TextUtilities = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h4 className="mb-3">Text Gradient</h4>
        <h2 className="text-gradient">Gradient Text Effect</h2>
      </div>

      <div>
        <h4 className="mb-3">Text Shadow</h4>
        <h2 className="text-shadow" style={{ color: '#667eea' }}>Text with Shadow</h2>
      </div>

      <div>
        <h4 className="mb-3">Text Truncate</h4>
        <p className="text-truncate-1" style={{ maxWidth: '300px' }}>
          This is a very long text that will be truncated to a single line with ellipsis at the end.
        </p>
        <p className="text-truncate-2" style={{ maxWidth: '300px' }}>
          This is a longer text that will be truncated to two lines with ellipsis at the end. You can see how it handles multiple lines of content gracefully.
        </p>
        <p className="text-truncate-3" style={{ maxWidth: '300px' }}>
          This is an even longer text that will be truncated to three lines. It's useful for preview cards or listings where you want to show a limited amount of text while maintaining a clean layout. The ellipsis indicates there's more content available.
        </p>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Text utilities: .text-gradient, .text-shadow, .text-truncate-* (1-3)',
      },
    },
  },
};

// Animation utilities
export const AnimationUtilities = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h4 className="mb-3">Fade In</h4>
        <div className="fade-in" style={{ background: '#667eea', color: 'white', padding: '2rem', borderRadius: '8px', textAlign: 'center' }}>
          Fades in on load
        </div>
      </div>

      <div>
        <h4 className="mb-3">Slide Up</h4>
        <div className="slide-up" style={{ background: '#764ba2', color: 'white', padding: '2rem', borderRadius: '8px', textAlign: 'center' }}>
          Slides up on load
        </div>
      </div>

      <div>
        <h4 className="mb-3">Scale In</h4>
        <div className="scale-in" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', padding: '2rem', borderRadius: '8px', textAlign: 'center' }}>
          Scales in on load
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Animation utilities: .fade-in, .slide-up, .scale-in',
      },
    },
  },
};

// Form unified
export const FormUnified = {
  render: () => (
    <div style={{ maxWidth: '600px' }}>
      <form className="form-unified">
        <h4>Unified Form Styling</h4>
        
        <div className="mb-3">
          <label className="form-label">Name</label>
          <input type="text" className="form-control" placeholder="Enter your name" />
        </div>

        <div className="mb-3">
          <label className="form-label">Email</label>
          <input type="email" className="form-control" placeholder="your.email@example.com" />
        </div>

        <div className="mb-3">
          <label className="form-label">Category</label>
          <select className="form-control">
            <option>Select a category...</option>
            <option>Option 1</option>
            <option>Option 2</option>
            <option>Option 3</option>
          </select>
        </div>

        <div className="mb-3">
          <label className="form-label">Description</label>
          <textarea className="form-control" rows="3" placeholder="Enter description..."></textarea>
        </div>

        <div className="mb-3 form-check">
          <input type="checkbox" className="form-check-input" id="agree" />
          <label className="form-check-label" htmlFor="agree">
            I agree to the terms and conditions
          </label>
        </div>

        <div className="d-flex gap-2">
          <button type="submit" className="btn-gradient">Submit</button>
          <button type="button" className="btn-outline-custom">Cancel</button>
        </div>
      </form>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: '.form-unified class provides consistent spacing and styling for form elements',
      },
    },
  },
};

// Table unified
export const TableUnified = {
  render: () => (
    <div style={{ maxWidth: '800px' }}>
      <table className="table-unified">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>John Doe</td>
            <td>john@example.com</td>
            <td><span className="pill pill-primary">Admin</span></td>
            <td><span className="pill pill-success">Active</span></td>
          </tr>
          <tr>
            <td>Jane Smith</td>
            <td>jane@example.com</td>
            <td><span className="pill pill-info">User</span></td>
            <td><span className="pill pill-success">Active</span></td>
          </tr>
          <tr>
            <td>Bob Johnson</td>
            <td>bob@example.com</td>
            <td><span className="pill pill-info">User</span></td>
            <td><span className="pill pill-warning">Pending</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: '.table-unified class provides responsive tables with hover states and proper spacing',
      },
    },
  },
};

// Responsive helpers
export const ResponsiveHelpers = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ border: '1px solid #ddd', padding: '1rem', borderRadius: '8px' }}>
        <p className="show-mobile" style={{ background: '#fff3cd', padding: '0.5rem', borderRadius: '4px' }}>
          📱 This content is only visible on mobile devices (use responsive view to test)
        </p>
        <p className="hide-mobile" style={{ background: '#d1ecf1', padding: '0.5rem', borderRadius: '4px' }}>
          💻 This content is hidden on mobile devices
        </p>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Responsive utilities: .show-mobile, .hide-mobile (768px breakpoint)',
      },
    },
  },
};

// Complete example
export const CompleteExample = {
  render: () => (
    <div style={{ maxWidth: '800px' }} className="space-y-4">
      <div className="fade-in">
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          padding: '2rem',
          borderRadius: '12px',
          marginBottom: '2rem'
        }}>
          <h2 className="text-shadow mb-3">Design System Utilities</h2>
          <p className="mb-0">Comprehensive utility classes for rapid development</p>
        </div>
      </div>

      <div className="slide-up" style={{ animationDelay: '0.1s' }}>
        <div style={{ 
          background: 'var(--color-bg-primary)',
          border: '1px solid var(--color-border-medium)',
          padding: '1.5rem', 
          borderRadius: '8px',
          color: 'var(--color-text-primary)'
        }}>
          <div className="flex-between mb-3">
            <h4>Features</h4>
            <span className="pill pill-primary">v0.4.0</span>
          </div>
          
          <div className="space-y-2">
            <div className="flex-between" style={{ padding: '0.75rem', background: 'var(--color-bg-secondary)', borderRadius: '6px' }}>
              <span>Button Utilities</span>
              <span className="pill pill-success">✓ Complete</span>
            </div>
            <div className="flex-between" style={{ padding: '0.75rem', background: 'var(--color-bg-secondary)', borderRadius: '6px' }}>
              <span>Form Utilities</span>
              <span className="pill pill-success">✓ Complete</span>
            </div>
            <div className="flex-between" style={{ padding: '0.75rem', background: 'var(--color-bg-secondary)', borderRadius: '6px' }}>
              <span>Layout Helpers</span>
              <span className="pill pill-success">✓ Complete</span>
            </div>
          </div>
        </div>
      </div>

      <div className="scale-in" style={{ animationDelay: '0.2s' }}>
        <div style={{ 
          background: 'var(--color-bg-primary)',
          border: '1px solid var(--color-border-medium)',
          padding: '1.5rem', 
          borderRadius: '8px',
          color: 'var(--color-text-primary)'
        }}>
          <h4 className="mb-3">Quick Actions</h4>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button className="btn-gradient btn-rounded">Create New</button>
            <button className="btn-outline-custom btn-rounded">View All</button>
            <button className="btn-outline-custom btn-rounded">Settings</button>
          </div>
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Complete example combining multiple utility classes',
      },
    },
  },
};

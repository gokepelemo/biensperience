import BiensperienceLogo from '../components/BiensperienceLogo/BiensperienceLogo';

export default {
  title: 'Introduction',
  parameters: {
    layout: 'fullscreen',
  },
};

export const Welcome = {
  render: () => (
    <div style={{
      padding: 'var(--space-8)',
      maxWidth: '900px',
      margin: '0 auto',
      fontFamily: 'var(--font-family-base)'
    }}>
      <div style={{
        textAlign: 'center',
        marginBottom: 'var(--space-8)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: 'var(--space-4)'
        }}>
          <BiensperienceLogo width={64} height={64} />
        </div>
        <h1 style={{
          fontSize: 'var(--font-size-4xl)',
          fontWeight: 'var(--font-weight-bold)',
          color: 'var(--color-primary)',
          marginBottom: 'var(--space-2)'
        }}>
          Welcome to Biensperience UI
        </h1>
        <p style={{
          fontSize: 'var(--font-size-xl)',
          color: 'var(--color-text-secondary)',
          marginBottom: 'var(--space-6)'
        }}>
          Interactive component library and design system documentation
        </p>
      </div>

      <div style={{
        background: 'var(--color-bg-secondary)',
        padding: 'var(--space-6)',
        borderRadius: 'var(--border-radius-xl)',
        marginBottom: 'var(--space-6)'
      }}>
        <h2 style={{
          fontSize: 'var(--font-size-2xl)',
          fontWeight: 'var(--font-weight-bold)',
          color: 'var(--color-text-primary)',
          marginBottom: 'var(--space-4)'
        }}>
          What's Inside?
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: 'var(--space-4)'
        }}>
          <div style={{
            background: 'var(--color-bg-primary)',
            padding: 'var(--space-4)',
            borderRadius: 'var(--border-radius-lg)',
            border: '1px solid var(--color-border-light)'
          }}>
            <h3 style={{
              fontSize: 'var(--font-size-lg)',
              fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--color-primary)',
              marginBottom: 'var(--space-2)'
            }}>
              📦 Components
            </h3>
            <p style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
              lineHeight: 'var(--line-height-relaxed)',
              margin: 0
            }}>
              Browse reusable UI components like cards, buttons, forms, navigation, and more. All components are fully responsive and accessible.
            </p>
          </div>

          <div style={{
            background: 'var(--color-bg-primary)',
            padding: 'var(--space-4)',
            borderRadius: 'var(--border-radius-lg)',
            border: '1px solid var(--color-border-light)'
          }}>
            <h3 style={{
              fontSize: 'var(--font-size-lg)',
              fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--color-success)',
              marginBottom: 'var(--space-2)'
            }}>
              🎨 Design System
            </h3>
            <p style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
              lineHeight: 'var(--line-height-relaxed)',
              margin: 0
            }}>
              Explore design tokens, colors, typography, spacing, utilities, and UI patterns. Everything uses CSS variables for consistency.
            </p>
          </div>

          <div style={{
            background: 'var(--color-bg-primary)',
            padding: 'var(--space-4)',
            borderRadius: 'var(--border-radius-lg)',
            border: '1px solid var(--color-border-light)'
          }}>
            <h3 style={{
              fontSize: 'var(--font-size-lg)',
              fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--color-info)',
              marginBottom: 'var(--space-2)'
            }}>
              🌙 Dark Mode
            </h3>
            <p style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
              lineHeight: 'var(--line-height-relaxed)',
              margin: 0
            }}>
              All components support dark mode out of the box. Toggle dark mode in Storybook's toolbar to see it in action.
            </p>
          </div>
        </div>
      </div>

      <div style={{
        background: 'var(--color-bg-secondary)',
        padding: 'var(--space-6)',
        borderRadius: 'var(--border-radius-xl)',
        marginBottom: 'var(--space-6)'
      }}>
        <h2 style={{
          fontSize: 'var(--font-size-2xl)',
          fontWeight: 'var(--font-weight-bold)',
          color: 'var(--color-text-primary)',
          marginBottom: 'var(--space-4)'
        }}>
          Quick Navigation
        </h2>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-3)',
            background: 'var(--color-bg-primary)',
            borderRadius: 'var(--border-radius-md)',
            border: '1px solid var(--color-border-light)'
          }}>
            <span style={{ fontSize: 'var(--font-size-xl)' }}>🏗️</span>
            <div>
              <strong style={{
                fontSize: 'var(--font-size-base)',
                color: 'var(--color-text-primary)'
              }}>
                Components
              </strong>
              <span style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-muted)',
                marginLeft: 'var(--space-2)'
              }}>
                - Destination Browser, Experience Cards, Photo Cards, UI Components
              </span>
            </div>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-3)',
            background: 'var(--color-bg-primary)',
            borderRadius: 'var(--border-radius-md)',
            border: '1px solid var(--color-border-light)'
          }}>
            <span style={{ fontSize: 'var(--font-size-xl)' }}>🎨</span>
            <div>
              <strong style={{
                fontSize: 'var(--font-size-base)',
                color: 'var(--color-text-primary)'
              }}>
                Design System
              </strong>
              <span style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-muted)',
                marginLeft: 'var(--space-2)'
              }}>
                - Documentation, Buttons, Utilities, Featured Cards, Popular Patterns
              </span>
            </div>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-3)',
            background: 'var(--color-bg-primary)',
            borderRadius: 'var(--border-radius-md)',
            border: '1px solid var(--color-border-light)'
          }}>
            <span style={{ fontSize: 'var(--font-size-xl)' }}>🧩</span>
            <div>
              <strong style={{
                fontSize: 'var(--font-size-base)',
                color: 'var(--color-text-primary)'
              }}>
                Patterns
              </strong>
              <span style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-muted)',
                marginLeft: 'var(--space-2)'
              }}>
                - Layouts, Modals, Authentication, Navigation, Chat, Messaging
              </span>
            </div>
          </div>
        </div>
      </div>

      <div style={{
        background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-info) 100%)',
        padding: 'var(--space-6)',
        borderRadius: 'var(--border-radius-xl)',
        color: 'white',
        textAlign: 'center'
      }}>
        <h2 style={{
          fontSize: 'var(--font-size-2xl)',
          fontWeight: 'var(--font-weight-bold)',
          marginBottom: 'var(--space-3)'
        }}>
          Getting Started
        </h2>
        <p style={{
          fontSize: 'var(--font-size-base)',
          marginBottom: 'var(--space-4)',
          opacity: 0.95
        }}>
          Use the sidebar to browse components and stories. Each story includes:
        </p>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 'var(--space-6)',
          flexWrap: 'wrap',
          fontSize: 'var(--font-size-sm)'
        }}>
          <div>✨ <strong>Live Preview</strong></div>
          <div>📝 <strong>Documentation</strong></div>
          <div>⚙️ <strong>Interactive Controls</strong></div>
          <div>💻 <strong>Code Examples</strong></div>
        </div>
      </div>

      <div style={{
        marginTop: 'var(--space-6)',
        padding: 'var(--space-4)',
        textAlign: 'center',
        fontSize: 'var(--font-size-sm)',
        color: 'var(--color-text-muted)'
      }}>
        <p style={{ margin: 0 }}>
          Built with React • Bootstrap • Design Tokens • Responsive • Accessible
        </p>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      page: null, // Disable docs page for welcome story
    },
  },
};

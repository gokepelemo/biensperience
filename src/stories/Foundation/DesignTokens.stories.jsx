/**
 * Design Tokens - Foundation Stories
 *
 * Consolidated from:
 * - src/stories/DesignTokens.stories.jsx (Overview)
 * - src/stories/DesignSystem/DesignTokens.stories.jsx (Tokens)
 * - src/stories/DesignTokensTest.stories.jsx (Test/Interactive)
 *
 * All design tokens for the Biensperience travel planning platform.
 * Toggle between light and dark mode using the theme switcher in the toolbar.
 */

import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Badge } from 'react-bootstrap';
import { FaPlane, FaMapMarkerAlt, FaSun, FaMoon, FaCheck, FaPalette } from 'react-icons/fa';

export default {
  title: 'Foundation/Design Tokens',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
Design tokens are the visual design atoms of the Biensperience design system.
They store visual design attributes like colors, spacing, typography, and shadows.

**Features:**
- 🎨 Full dark mode support with automatic adaptation
- 📱 Mobile-first responsive design
- ♿ WCAG 2.1 AA compliant contrast ratios
- 🚀 Performance-optimized CSS custom properties
        `,
      },
    },
  },
};

// ============================================================
// OVERVIEW - Comprehensive Token Documentation
// ============================================================

export const Overview = {
  render: () => (
    <div style={{
      padding: 'var(--space-6)',
      maxWidth: '1200px',
      margin: '0 auto',
      color: 'var(--color-text-primary)',
      backgroundColor: 'var(--color-bg-primary)',
      minHeight: '100vh',
    }}>
      <h1 style={{
        fontSize: 'var(--font-size-4xl)',
        fontWeight: 'var(--font-weight-bold)',
        marginBottom: 'var(--space-2)',
      }}>
        ✈️ Design Tokens
      </h1>
      <p style={{
        fontSize: 'var(--font-size-lg)',
        color: 'var(--color-text-secondary)',
        marginBottom: 'var(--space-4)',
      }}>
        Visual foundation for the Biensperience travel planning experience
      </p>
      <p style={{
        fontWeight: 'var(--font-weight-semibold)',
        color: 'var(--color-primary)',
        padding: 'var(--space-3)',
        backgroundColor: 'var(--color-bg-secondary)',
        borderRadius: 'var(--radius-md)',
        marginBottom: 'var(--space-8)',
      }}>
        🌙 Toggle between light and dark mode using the theme switcher in the toolbar
      </p>

      <hr style={{ margin: 'var(--space-8) 0', borderColor: 'var(--color-border-medium)' }} />

      {/* PRIMARY COLORS */}
      <section style={{ marginBottom: 'var(--space-10)' }}>
        <h2 style={{ fontSize: 'var(--font-size-2xl)', marginBottom: 'var(--space-4)' }}>
          Primary Colors
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
          The signature purple gradient establishes Biensperience's brand identity.
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 'var(--space-4)',
        }}>
          <TokenCard
            name="Primary Gradient"
            value="var(--gradient-primary)"
            style={{ background: 'var(--gradient-primary)' }}
          />
          <TokenCard
            name="Primary Blue"
            value="var(--color-primary)"
            style={{ background: 'var(--color-primary)' }}
          />
          <TokenCard
            name="Primary Purple"
            value="var(--color-primary-dark)"
            style={{ background: 'var(--color-primary-dark)' }}
          />
        </div>
      </section>

      {/* SEMANTIC COLORS */}
      <section style={{ marginBottom: 'var(--space-10)' }}>
        <h2 style={{ fontSize: 'var(--font-size-2xl)', marginBottom: 'var(--space-4)' }}>
          Semantic Colors
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
          Communicate meaning and state throughout the travel planning interface.
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: 'var(--space-4)',
        }}>
          <TokenCard name="Success" value="var(--color-success)" style={{ background: 'var(--color-success)' }} />
          <TokenCard name="Warning" value="var(--color-warning)" style={{ background: 'var(--color-warning)' }} />
          <TokenCard name="Danger" value="var(--color-danger)" style={{ background: 'var(--color-danger)' }} />
          <TokenCard name="Info" value="var(--color-info)" style={{ background: 'var(--color-info)' }} />
        </div>
      </section>

      {/* TEXT & BACKGROUNDS */}
      <section style={{ marginBottom: 'var(--space-10)' }}>
        <h2 style={{ fontSize: 'var(--font-size-2xl)', marginBottom: 'var(--space-4)' }}>
          Text & Backgrounds
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
          Automatically adapt to light and dark modes for optimal readability.
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 'var(--space-4)',
        }}>
          <div style={{
            background: 'var(--color-bg-primary)',
            padding: 'var(--space-4)',
            borderRadius: 'var(--radius-md)',
            border: '2px solid var(--color-border-medium)',
            textAlign: 'center',
          }}>
            <div style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)' }}>
              Primary BG
            </div>
            <code style={{ fontSize: 'var(--font-size-xs)' }}>var(--color-bg-primary)</code>
          </div>
          <div style={{
            background: 'var(--color-bg-secondary)',
            padding: 'var(--space-4)',
            borderRadius: 'var(--radius-md)',
            border: '2px solid var(--color-border-medium)',
            textAlign: 'center',
          }}>
            <div style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)' }}>
              Secondary BG
            </div>
            <code style={{ fontSize: 'var(--font-size-xs)' }}>var(--color-bg-secondary)</code>
          </div>
          <div style={{
            background: 'var(--color-bg-tertiary)',
            padding: 'var(--space-4)',
            borderRadius: 'var(--radius-md)',
            textAlign: 'center',
          }}>
            <div style={{ fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)' }}>
              Text Primary
            </div>
            <code style={{ fontSize: 'var(--font-size-xs)' }}>var(--color-text-primary)</code>
          </div>
          <div style={{
            background: 'var(--color-bg-tertiary)',
            padding: 'var(--space-4)',
            borderRadius: 'var(--radius-md)',
            textAlign: 'center',
          }}>
            <div style={{ fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)' }}>
              Text Muted
            </div>
            <code style={{ fontSize: 'var(--font-size-xs)' }}>var(--color-text-muted)</code>
          </div>
        </div>
      </section>

      {/* TYPOGRAPHY */}
      <section style={{ marginBottom: 'var(--space-10)' }}>
        <h2 style={{ fontSize: 'var(--font-size-2xl)', marginBottom: 'var(--space-4)' }}>
          Typography Scale
        </h2>

        <div style={{
          background: 'var(--color-bg-secondary)',
          padding: 'var(--space-6)',
          borderRadius: 'var(--radius-lg)',
        }}>
          <div style={{ fontSize: 'var(--font-size-4xl)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--space-3)' }}>
            4XL - Explore the World
          </div>
          <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--space-3)' }}>
            3XL - Discover Adventures
          </div>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--space-3)' }}>
            2XL - Plan Your Journey
          </div>
          <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--space-3)' }}>
            XL - Experience Destinations
          </div>
          <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--space-3)' }}>
            LG - Travel Planning Tools
          </div>
          <div style={{ fontSize: 'var(--font-size-base)', marginBottom: 'var(--space-3)' }}>
            Base - The quick brown fox jumps over the lazy dog
          </div>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
            SM - Helper text, captions, and metadata
          </div>
        </div>
      </section>

      {/* SPACING */}
      <section style={{ marginBottom: 'var(--space-10)' }}>
        <h2 style={{ fontSize: 'var(--font-size-2xl)', marginBottom: 'var(--space-4)' }}>
          Spacing Scale
        </h2>

        <div style={{
          background: 'var(--color-bg-secondary)',
          padding: 'var(--space-6)',
          borderRadius: 'var(--radius-lg)',
        }}>
          {[
            { name: '1', value: '0.25rem (4px)', use: 'Tight spacing' },
            { name: '2', value: '0.5rem (8px)', use: 'Small gaps' },
            { name: '3', value: '0.75rem (12px)', use: 'Compact spacing' },
            { name: '4', value: '1rem (16px)', use: 'Default spacing' },
            { name: '6', value: '1.5rem (24px)', use: 'Section spacing' },
            { name: '8', value: '2rem (32px)', use: 'Large sections' },
          ].map(({ name, value, use }) => (
            <div key={name} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-4)',
              marginBottom: 'var(--space-3)',
            }}>
              <code style={{ width: '120px' }}>--space-{name}</code>
              <div style={{
                width: `var(--space-${name})`,
                height: 'var(--space-4)',
                background: 'var(--gradient-primary)',
                borderRadius: 'var(--radius-sm)',
              }} />
              <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                {value} • {use}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* BORDER RADIUS */}
      <section style={{ marginBottom: 'var(--space-10)' }}>
        <h2 style={{ fontSize: 'var(--font-size-2xl)', marginBottom: 'var(--space-4)' }}>
          Border Radius
        </h2>

        <div style={{
          display: 'flex',
          gap: 'var(--space-4)',
          flexWrap: 'wrap',
        }}>
          {['sm', 'md', 'lg', 'xl', 'full'].map((size) => (
            <div key={size} style={{
              width: '100px',
              height: '60px',
              background: 'var(--gradient-primary)',
              borderRadius: `var(--radius-${size})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 'var(--font-weight-semibold)',
            }}>
              {size}
            </div>
          ))}
        </div>
      </section>

      {/* SHADOWS */}
      <section style={{ marginBottom: 'var(--space-10)' }}>
        <h2 style={{ fontSize: 'var(--font-size-2xl)', marginBottom: 'var(--space-4)' }}>
          Shadows
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
          Shadows adapt to light and dark modes automatically for proper depth.
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: 'var(--space-6)',
        }}>
          {['sm', 'md', 'lg'].map((size) => (
            <div key={size} style={{
              padding: 'var(--space-6)',
              background: 'var(--color-bg-primary)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: `var(--shadow-${size})`,
              border: '1px solid var(--color-border-light)',
              textAlign: 'center',
            }}>
              <strong>Shadow {size.toUpperCase()}</strong>
              <br />
              <code style={{ fontSize: 'var(--font-size-xs)' }}>var(--shadow-{size})</code>
            </div>
          ))}
        </div>
      </section>

      {/* USAGE GUIDELINES */}
      <section>
        <h2 style={{ fontSize: 'var(--font-size-2xl)', marginBottom: 'var(--space-4)' }}>
          Usage Guidelines
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 'var(--space-4)',
        }}>
          <GuidelineCard
            title="Consistency"
            items={[
              'Always use design tokens instead of hard-coded values',
              'Reference tokens through CSS variables',
              'Maintain consistent spacing between elements',
            ]}
          />
          <GuidelineCard
            title="Accessibility"
            items={[
              'Color contrast meets WCAG 2.1 AA (4.5:1)',
              'Use semantic colors meaningfully',
              "Don't rely on color alone to convey info",
            ]}
          />
          <GuidelineCard
            title="Performance"
            items={[
              'CSS custom properties for dynamic values',
              'Use transform & opacity for animations',
              'Keep animation durations 200-500ms',
            ]}
          />
        </div>
      </section>
    </div>
  ),
};

// ============================================================
// INTERACTIVE - Travel-Themed Token Explorer
// ============================================================

export const InteractiveExplorer = {
  render: () => {
    const [darkMode, setDarkMode] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('colors');

    useEffect(() => {
      if (darkMode) {
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
    }, [darkMode]);

    return (
      <div style={{
        backgroundColor: 'var(--color-bg-primary)',
        minHeight: '100vh',
        padding: 'var(--space-4)',
      }}>
        <Container>
          {/* Header with Theme Toggle */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 'var(--space-6)',
            flexWrap: 'wrap',
            gap: 'var(--space-3)',
          }}>
            <div>
              <h1 style={{
                fontSize: 'var(--font-size-2xl)',
                fontWeight: 'var(--font-weight-bold)',
                color: 'var(--color-text-primary)',
                marginBottom: 'var(--space-1)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
              }}>
                <FaPalette style={{ color: 'var(--color-primary)' }} />
                Token Explorer
              </h1>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                Interactive design system playground
              </p>
            </div>

            <button
              onClick={() => setDarkMode(!darkMode)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: 'var(--space-3) var(--space-4)',
                borderRadius: 'var(--radius-full)',
                background: 'var(--gradient-primary)',
                color: 'white',
                border: 'none',
                fontWeight: 'var(--font-weight-semibold)',
                cursor: 'pointer',
                transition: 'all var(--transition-normal)',
              }}
            >
              {darkMode ? <FaSun /> : <FaMoon />}
              {darkMode ? 'Light Mode' : 'Dark Mode'}
            </button>
          </div>

          {/* Category Tabs - Mobile Scrollable */}
          <div style={{
            display: 'flex',
            gap: 'var(--space-2)',
            marginBottom: 'var(--space-6)',
            overflowX: 'auto',
            paddingBottom: 'var(--space-2)',
            WebkitOverflowScrolling: 'touch',
          }}>
            {['colors', 'typography', 'spacing', 'shadows', 'radius'].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: 'var(--space-2) var(--space-4)',
                  borderRadius: 'var(--radius-full)',
                  border: selectedCategory === cat ? 'none' : '2px solid var(--color-border-medium)',
                  background: selectedCategory === cat ? 'var(--gradient-primary)' : 'var(--color-bg-secondary)',
                  color: selectedCategory === cat ? 'white' : 'var(--color-text-primary)',
                  fontWeight: 'var(--font-weight-semibold)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all var(--transition-fast)',
                }}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>

          {/* Category Content */}
          {selectedCategory === 'colors' && <ColorsSection />}
          {selectedCategory === 'typography' && <TypographySection />}
          {selectedCategory === 'spacing' && <SpacingSection />}
          {selectedCategory === 'shadows' && <ShadowsSection />}
          {selectedCategory === 'radius' && <RadiusSection />}
        </Container>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Interactive token explorer with dark mode toggle and category navigation. Mobile-friendly with horizontal scrolling tabs.',
      },
    },
  },
};

// ============================================================
// MOBILE-FIRST TRAVEL DEMO
// ============================================================

export const MobileTravelDemo = {
  render: () => (
    <div style={{
      backgroundColor: 'var(--color-bg-primary)',
      minHeight: '100vh',
      maxWidth: '428px',
      margin: '0 auto',
      padding: 'var(--space-4)',
    }}>
      {/* Mobile Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 'var(--space-4)',
        padding: 'var(--space-3)',
        background: 'var(--gradient-primary)',
        borderRadius: 'var(--radius-lg)',
        color: 'white',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <FaPlane />
          <span style={{ fontWeight: 'var(--font-weight-bold)' }}>Biensperience</span>
        </div>
        <Badge bg="light" text="dark" pill>3 trips</Badge>
      </div>

      {/* Destination Card */}
      <Card style={{
        marginBottom: 'var(--space-4)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border-light)',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '160px',
          background: 'linear-gradient(135deg, #ff6b6b 0%, #feca57 50%, #48dbfb 100%)',
          display: 'flex',
          alignItems: 'flex-end',
          padding: 'var(--space-4)',
        }}>
          <div style={{
            background: 'rgba(255,255,255,0.95)',
            padding: 'var(--space-2) var(--space-3)',
            borderRadius: 'var(--radius-md)',
            fontWeight: 'var(--font-weight-semibold)',
            fontSize: 'var(--font-size-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-1)',
          }}>
            <FaMapMarkerAlt style={{ color: 'var(--color-danger)' }} />
            Tokyo, Japan
          </div>
        </div>
        <Card.Body style={{ padding: 'var(--space-4)' }}>
          <h3 style={{
            fontSize: 'var(--font-size-lg)',
            fontWeight: 'var(--font-weight-bold)',
            color: 'var(--color-text-primary)',
            marginBottom: 'var(--space-2)',
          }}>
            Cherry Blossom Festival
          </h3>
          <p style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-secondary)',
            marginBottom: 'var(--space-3)',
          }}>
            Experience the magical sakura season in Japan's vibrant capital.
          </p>
          <div style={{
            display: 'flex',
            gap: 'var(--space-2)',
            flexWrap: 'wrap',
          }}>
            <Badge style={{
              background: 'var(--color-success-bg)',
              color: 'var(--color-success)',
              padding: 'var(--space-1) var(--space-2)',
              borderRadius: 'var(--radius-full)',
            }}>
              Cultural
            </Badge>
            <Badge style={{
              background: 'var(--color-info-bg)',
              color: 'var(--color-info)',
              padding: 'var(--space-1) var(--space-2)',
              borderRadius: 'var(--radius-full)',
            }}>
              Spring
            </Badge>
          </div>
        </Card.Body>
      </Card>

      {/* Quick Actions */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 'var(--space-3)',
        marginBottom: 'var(--space-4)',
      }}>
        <ActionButton icon={<FaPlane />} label="Explore" color="var(--color-primary)" />
        <ActionButton icon={<FaMapMarkerAlt />} label="Saved" color="var(--color-success)" />
      </div>

      {/* Token Usage Example */}
      <div style={{
        background: 'var(--color-bg-secondary)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-4)',
      }}>
        <h4 style={{
          fontSize: 'var(--font-size-sm)',
          fontWeight: 'var(--font-weight-bold)',
          color: 'var(--color-text-primary)',
          marginBottom: 'var(--space-3)',
        }}>
          Tokens Used in This Demo
        </h4>
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
          <code>--gradient-primary</code> • <code>--space-4</code> • <code>--radius-lg</code><br />
          <code>--font-weight-bold</code> • <code>--color-text-primary</code>
        </div>
      </div>
    </div>
  ),
  parameters: {
    viewport: {
      defaultViewport: 'mobile',
    },
    docs: {
      description: {
        story: 'Mobile-first travel planning demo showcasing design tokens in a realistic mobile interface.',
      },
    },
  },
};

// ============================================================
// QUICK REFERENCE - Compact Token Grid
// ============================================================

export const QuickReference = {
  render: () => (
    <div style={{
      padding: 'var(--space-6)',
      backgroundColor: 'var(--color-bg-primary)',
      minHeight: '100vh',
    }}>
      <h1 style={{
        fontSize: 'var(--font-size-2xl)',
        fontWeight: 'var(--font-weight-bold)',
        color: 'var(--color-text-primary)',
        marginBottom: 'var(--space-6)',
      }}>
        Quick Reference
      </h1>

      <Row>
        <Col md={6} lg={4} style={{ marginBottom: 'var(--space-6)' }}>
          <h3 style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--space-3)' }}>Colors</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)' }}>
            {[
              ['Primary', 'var(--color-primary)'],
              ['Success', 'var(--color-success)'],
              ['Warning', 'var(--color-warning)'],
              ['Danger', 'var(--color-danger)'],
              ['Info', 'var(--color-info)'],
              ['Text', 'var(--color-text-primary)'],
            ].map(([name, value]) => (
              <div key={name} style={{
                height: '48px',
                background: value,
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: name === 'Text' ? 'var(--color-bg-primary)' : 'white',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 'var(--font-weight-medium)',
              }}>
                {name}
              </div>
            ))}
          </div>
        </Col>

        <Col md={6} lg={4} style={{ marginBottom: 'var(--space-6)' }}>
          <h3 style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--space-3)' }}>Spacing</h3>
          {['1', '2', '3', '4', '6', '8'].map((n) => (
            <div key={n} style={{ display: 'flex', alignItems: 'center', marginBottom: 'var(--space-1)' }}>
              <code style={{ width: '80px', fontSize: 'var(--font-size-xs)' }}>--space-{n}</code>
              <div style={{
                height: '12px',
                width: `var(--space-${n})`,
                background: 'var(--gradient-primary)',
                borderRadius: 'var(--radius-sm)',
              }} />
            </div>
          ))}
        </Col>

        <Col md={6} lg={4} style={{ marginBottom: 'var(--space-6)' }}>
          <h3 style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--space-3)' }}>Shadows</h3>
          {['sm', 'md', 'lg'].map((size) => (
            <div key={size} style={{
              padding: 'var(--space-3)',
              marginBottom: 'var(--space-3)',
              background: 'var(--color-bg-primary)',
              boxShadow: `var(--shadow-${size})`,
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-light)',
            }}>
              <code style={{ fontSize: 'var(--font-size-xs)' }}>--shadow-{size}</code>
            </div>
          ))}
        </Col>
      </Row>
    </div>
  ),
};

// ============================================================
// HELPER COMPONENTS
// ============================================================

const TokenCard = ({ name, value, style }) => (
  <div>
    <div style={{
      height: '80px',
      borderRadius: 'var(--radius-md)',
      marginBottom: 'var(--space-2)',
      boxShadow: 'var(--shadow-sm)',
      ...style,
    }} />
    <div style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)' }}>{name}</div>
    <code style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>{value}</code>
  </div>
);

const GuidelineCard = ({ title, items }) => (
  <div style={{
    background: 'var(--color-bg-secondary)',
    padding: 'var(--space-4)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--color-border-light)',
  }}>
    <h3 style={{
      fontSize: 'var(--font-size-lg)',
      fontWeight: 'var(--font-weight-semibold)',
      marginBottom: 'var(--space-3)',
      color: 'var(--color-text-primary)',
    }}>
      {title}
    </h3>
    <ul style={{
      margin: 0,
      paddingLeft: 'var(--space-4)',
      color: 'var(--color-text-secondary)',
      fontSize: 'var(--font-size-sm)',
    }}>
      {items.map((item, i) => (
        <li key={i} style={{ marginBottom: 'var(--space-1)' }}>{item}</li>
      ))}
    </ul>
  </div>
);

const ActionButton = ({ icon, label, color }) => (
  <button style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--space-2)',
    padding: 'var(--space-4)',
    background: 'var(--color-bg-secondary)',
    border: '2px solid var(--color-border-light)',
    borderRadius: 'var(--radius-lg)',
    color: color,
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
  }}>
    <div style={{ fontSize: 'var(--font-size-xl)' }}>{icon}</div>
    <span style={{
      fontSize: 'var(--font-size-sm)',
      fontWeight: 'var(--font-weight-semibold)',
      color: 'var(--color-text-primary)',
    }}>
      {label}
    </span>
  </button>
);

// Section Components for Interactive Explorer
const ColorsSection = () => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 'var(--space-3)' }}>
    {[
      ['Primary', 'var(--color-primary)'],
      ['Success', 'var(--color-success)'],
      ['Warning', 'var(--color-warning)'],
      ['Danger', 'var(--color-danger)'],
      ['Info', 'var(--color-info)'],
      ['BG Primary', 'var(--color-bg-primary)'],
      ['BG Secondary', 'var(--color-bg-secondary)'],
      ['Text Primary', 'var(--color-text-primary)'],
      ['Text Muted', 'var(--color-text-muted)'],
    ].map(([name, value]) => (
      <div key={name} style={{
        padding: 'var(--space-3)',
        background: 'var(--color-bg-secondary)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-border-light)',
      }}>
        <div style={{
          height: '48px',
          background: value,
          borderRadius: 'var(--radius-sm)',
          marginBottom: 'var(--space-2)',
          border: name.includes('BG') ? '1px solid var(--color-border-medium)' : 'none',
        }} />
        <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>
          {name}
        </div>
      </div>
    ))}
  </div>
);

const TypographySection = () => (
  <div style={{
    background: 'var(--color-bg-secondary)',
    padding: 'var(--space-4)',
    borderRadius: 'var(--radius-lg)',
  }}>
    {['4xl', '3xl', '2xl', 'xl', 'lg', 'base', 'sm', 'xs'].map((size) => (
      <div key={size} style={{
        fontSize: `var(--font-size-${size})`,
        color: 'var(--color-text-primary)',
        marginBottom: 'var(--space-2)',
        display: 'flex',
        alignItems: 'baseline',
        gap: 'var(--space-3)',
      }}>
        <span style={{ fontWeight: 'var(--font-weight-semibold)' }}>Font {size.toUpperCase()}</span>
        <code style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
          --font-size-{size}
        </code>
      </div>
    ))}
  </div>
);

const SpacingSection = () => (
  <div style={{
    background: 'var(--color-bg-secondary)',
    padding: 'var(--space-4)',
    borderRadius: 'var(--radius-lg)',
  }}>
    {['1', '2', '3', '4', '5', '6', '8', '10', '12'].map((n) => (
      <div key={n} style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        marginBottom: 'var(--space-2)',
      }}>
        <code style={{ width: '100px', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
          --space-{n}
        </code>
        <div style={{
          height: '20px',
          width: `var(--space-${n})`,
          background: 'var(--gradient-primary)',
          borderRadius: 'var(--radius-sm)',
        }} />
      </div>
    ))}
  </div>
);

const ShadowsSection = () => (
  <div style={{
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: 'var(--space-4)',
  }}>
    {['xs', 'sm', 'md', 'lg', 'xl'].map((size) => (
      <div key={size} style={{
        padding: 'var(--space-6)',
        background: 'var(--color-bg-primary)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: `var(--shadow-${size})`,
        textAlign: 'center',
        border: '1px solid var(--color-border-light)',
      }}>
        <div style={{ fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-1)' }}>
          {size.toUpperCase()}
        </div>
        <code style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
          --shadow-{size}
        </code>
      </div>
    ))}
  </div>
);

const RadiusSection = () => (
  <div style={{
    display: 'flex',
    gap: 'var(--space-4)',
    flexWrap: 'wrap',
    justifyContent: 'center',
  }}>
    {['none', 'sm', 'md', 'lg', 'xl', '2xl', 'full'].map((size) => (
      <div key={size} style={{
        width: '100px',
        height: '80px',
        background: 'var(--gradient-primary)',
        borderRadius: `var(--radius-${size})`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
      }}>
        <div style={{ fontWeight: 'var(--font-weight-bold)' }}>{size}</div>
        <code style={{ fontSize: 'var(--font-size-xs)', opacity: 0.8 }}>--radius-{size}</code>
      </div>
    ))}
  </div>
);

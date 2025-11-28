import React from 'react';
import { Container, Row, Col, Card } from 'react-bootstrap';
import EmptyState, { VARIANT_CONFIG } from '../components/EmptyState/EmptyState';

export default {
  title: 'Components/Feedback/Empty States',
  component: EmptyState,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
A reusable empty state component for displaying when no data is available.
Supports multiple variants for different entity types with customizable icons, titles, descriptions, and actions.
        `,
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: Object.keys(VARIANT_CONFIG),
      description: 'The type of empty state to display',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Size variant',
    },
    compact: {
      control: 'boolean',
      description: 'Use compact layout with less padding',
    },
    title: {
      control: 'text',
      description: 'Override the default title',
    },
    description: {
      control: 'text',
      description: 'Override the default description',
    },
    icon: {
      control: 'text',
      description: 'Override the default icon/emoji',
    },
    primaryAction: {
      control: 'text',
      description: 'Primary button text',
    },
    secondaryAction: {
      control: 'text',
      description: 'Secondary button text',
    },
  },
};

// Default - Plans variant (most common use case)
export const Default = {
  args: {
    variant: 'plans',
    size: 'lg',
    onPrimaryAction: () => alert('Browse Experiences clicked'),
    onSecondaryAction: () => alert('Plan New Experience clicked'),
  },
};

// All Variants showcase
export const AllVariants = {
  name: 'All Variants',
  render: () => (
  <div style={{
    backgroundColor: 'var(--color-bg-primary)',
    padding: 'var(--space-8)',
  }}>
    <Container>
      <h1 style={{
        fontSize: 'var(--font-size-2xl)',
        fontWeight: 'var(--font-weight-bold)',
        color: 'var(--color-text-primary)',
        marginBottom: 'var(--space-8)',
        textAlign: 'center',
      }}>
        Empty State Variants
      </h1>

      <Row>
        {Object.keys(VARIANT_CONFIG).map((variant) => (
          <Col md={6} lg={4} key={variant} style={{ marginBottom: 'var(--space-6)' }}>
            <Card style={{
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-light)',
              borderRadius: 'var(--radius-lg)',
              height: '100%',
            }}>
              <Card.Header style={{
                backgroundColor: 'var(--color-bg-secondary)',
                borderBottom: '1px solid var(--color-border-light)',
                padding: 'var(--space-3)',
              }}>
                <code style={{ fontSize: 'var(--font-size-sm)' }}>variant="{variant}"</code>
              </Card.Header>
              <Card.Body style={{ padding: 'var(--space-4)' }}>
                <EmptyState
                  variant={variant}
                  size="sm"
                  compact
                  onPrimaryAction={() => alert(`${variant}: Primary action clicked`)}
                  onSecondaryAction={() => alert(`${variant}: Secondary action clicked`)}
                />
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>
    </Container>
  </div>
  ),
  parameters: {
    layout: 'fullscreen',
  },
};

// Plans variant (Dashboard > My Plans)
export const Plans = {
  args: {
    variant: 'plans',
    size: 'lg',
    onPrimaryAction: () => alert('Browse Experiences clicked'),
    onSecondaryAction: () => alert('Plan New Experience clicked'),
  },
};

// Experiences variant
export const Experiences = {
  args: {
    variant: 'experiences',
    size: 'lg',
    onPrimaryAction: () => alert('Browse Experiences clicked'),
    onSecondaryAction: () => alert('Create Experience clicked'),
  },
};

// Destinations variant
export const Destinations = {
  args: {
    variant: 'destinations',
    size: 'lg',
    onPrimaryAction: () => alert('Browse Destinations clicked'),
    onSecondaryAction: () => alert('Add Destination clicked'),
  },
};

// Favorites variant
export const Favorites = {
  args: {
    variant: 'favorites',
    size: 'lg',
    onPrimaryAction: () => alert('Browse Experiences clicked'),
  },
};

// Activity variant
export const Activity = {
  args: {
    variant: 'activity',
    size: 'md',
    onPrimaryAction: () => alert('Get Started clicked'),
  },
};

// Search variant
export const Search = {
  args: {
    variant: 'search',
    size: 'md',
    onPrimaryAction: () => alert('Clear Filters clicked'),
  },
};

// Collaborators variant
export const Collaborators = {
  args: {
    variant: 'collaborators',
    size: 'md',
    onPrimaryAction: () => alert('Invite Collaborators clicked'),
  },
};

// Photos variant
export const Photos = {
  args: {
    variant: 'photos',
    size: 'md',
    onPrimaryAction: () => alert('Upload Photos clicked'),
  },
};

// Notes variant
export const Notes = {
  args: {
    variant: 'notes',
    size: 'md',
    onPrimaryAction: () => alert('Add Note clicked'),
  },
};

// Generic variant
export const Generic = {
  args: {
    variant: 'generic',
    size: 'md',
  },
};

// Size Comparison
export const SizeComparison = {
  name: 'Size Comparison',
  render: () => (
  <div style={{
    backgroundColor: 'var(--color-bg-primary)',
    padding: 'var(--space-8)',
  }}>
    <Container>
      <h1 style={{
        fontSize: 'var(--font-size-2xl)',
        fontWeight: 'var(--font-weight-bold)',
        color: 'var(--color-text-primary)',
        marginBottom: 'var(--space-8)',
        textAlign: 'center',
      }}>
        Size Comparison
      </h1>

      <Row>
        {['sm', 'md', 'lg'].map((size) => (
          <Col md={4} key={size} style={{ marginBottom: 'var(--space-6)' }}>
            <Card style={{
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-light)',
              borderRadius: 'var(--radius-lg)',
              height: '100%',
            }}>
              <Card.Header style={{
                backgroundColor: 'var(--color-bg-secondary)',
                borderBottom: '1px solid var(--color-border-light)',
                padding: 'var(--space-3)',
                textAlign: 'center',
              }}>
                <strong style={{ fontSize: 'var(--font-size-lg)' }}>Size: {size.toUpperCase()}</strong>
              </Card.Header>
              <Card.Body style={{
                padding: size === 'sm' ? 'var(--space-2)' : 'var(--space-4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <EmptyState
                  variant="plans"
                  size={size}
                  onPrimaryAction={() => alert('Clicked')}
                  onSecondaryAction={() => alert('Clicked')}
                />
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>
    </Container>
  </div>
  ),
  parameters: {
    layout: 'fullscreen',
  },
};

// Compact Mode
export const CompactMode = {
  name: 'Compact Mode',
  render: () => (
  <div style={{
    backgroundColor: 'var(--color-bg-primary)',
    padding: 'var(--space-8)',
  }}>
    <Container>
      <h1 style={{
        fontSize: 'var(--font-size-2xl)',
        fontWeight: 'var(--font-weight-bold)',
        color: 'var(--color-text-primary)',
        marginBottom: 'var(--space-8)',
        textAlign: 'center',
      }}>
        Compact vs Regular
      </h1>

      <Row>
        <Col md={6} style={{ marginBottom: 'var(--space-6)' }}>
          <Card style={{
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-light)',
            borderRadius: 'var(--radius-lg)',
          }}>
            <Card.Header style={{
              backgroundColor: 'var(--color-bg-secondary)',
              borderBottom: '1px solid var(--color-border-light)',
              padding: 'var(--space-3)',
              textAlign: 'center',
            }}>
              <strong>Regular (compact=false)</strong>
            </Card.Header>
            <Card.Body>
              <EmptyState
                variant="plans"
                size="md"
                compact={false}
                onPrimaryAction={() => alert('Clicked')}
                onSecondaryAction={() => alert('Clicked')}
              />
            </Card.Body>
          </Card>
        </Col>
        <Col md={6} style={{ marginBottom: 'var(--space-6)' }}>
          <Card style={{
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-light)',
            borderRadius: 'var(--radius-lg)',
          }}>
            <Card.Header style={{
              backgroundColor: 'var(--color-bg-secondary)',
              borderBottom: '1px solid var(--color-border-light)',
              padding: 'var(--space-3)',
              textAlign: 'center',
            }}>
              <strong>Compact (compact=true)</strong>
            </Card.Header>
            <Card.Body>
              <EmptyState
                variant="plans"
                size="md"
                compact={true}
                onPrimaryAction={() => alert('Clicked')}
                onSecondaryAction={() => alert('Clicked')}
              />
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  </div>
  ),
  parameters: {
    layout: 'fullscreen',
  },
};

// Custom Content
export const CustomContent = {
  name: 'Custom Content',
  args: {
    variant: 'generic',
    size: 'lg',
    icon: '🚀',
    title: 'Launch Your Adventure',
    description: 'Start your journey by creating your first travel experience. Share your adventures with the world!',
    primaryAction: 'Create First Experience',
    secondaryAction: 'Learn More',
    onPrimaryAction: () => alert('Create First Experience clicked'),
    onSecondaryAction: () => alert('Learn More clicked'),
  },
};

// No Actions (informational only)
export const NoActions = {
  name: 'No Actions',
  args: {
    variant: 'generic',
    size: 'md',
    icon: '🔒',
    title: 'Access Restricted',
    description: 'You don\'t have permission to view this content. Contact an administrator for access.',
  },
};

// In Context - Dashboard Card
export const InDashboardCard = {
  name: 'In Dashboard Card',
  render: () => (
  <div style={{
    backgroundColor: 'var(--color-bg-primary)',
    padding: 'var(--space-8)',
    minHeight: '100vh',
  }}>
    <Container>
      <h1 style={{
        fontSize: 'var(--font-size-2xl)',
        fontWeight: 'var(--font-weight-bold)',
        color: 'var(--color-text-primary)',
        marginBottom: 'var(--space-6)',
      }}>
        Dashboard - My Plans
      </h1>

      <Card style={{
        backgroundColor: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border-light)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
      }}>
        <Card.Header style={{
          backgroundColor: 'transparent',
          borderBottom: '1px solid var(--color-border-light)',
          padding: 'var(--space-4)',
        }}>
          <h2 style={{
            fontSize: 'var(--font-size-lg)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--color-text-primary)',
            margin: 0,
          }}>
            My Plans
          </h2>
          <p style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-muted)',
            margin: 0,
            marginTop: 'var(--space-1)',
          }}>
            Your saved plans with progress and cost estimates
          </p>
        </Card.Header>
        <Card.Body style={{ padding: 'var(--space-4)' }}>
          <EmptyState
            variant="plans"
            size="md"
            onPrimaryAction={() => alert('Browse Experiences clicked')}
            onSecondaryAction={() => alert('Plan New Experience clicked')}
          />
        </Card.Body>
      </Card>
    </Container>
  </div>
  ),
  parameters: {
    layout: 'fullscreen',
  },
};

// Dark Mode Compatibility Demo
export const DarkModeDemo = () => (
  <div style={{ display: 'grid', gap: '2rem' }}>
    {/* Light Mode */}
    <div style={{
      backgroundColor: 'var(--color-bg-primary)',
      padding: 'var(--space-8)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--color-border-light)',
    }}>
      <h3 style={{
        fontSize: 'var(--font-size-lg)',
        fontWeight: 'var(--font-weight-semibold)',
        color: 'var(--color-text-primary)',
        marginBottom: 'var(--space-4)',
        textAlign: 'center',
      }}>
        Light Mode
      </h3>
      <EmptyState
        variant="plans"
        size="sm"
        compact
        onPrimaryAction={() => alert('Browse clicked')}
        onSecondaryAction={() => alert('Create clicked')}
      />
    </div>

    {/* Dark Mode - simulated with data-theme attribute */}
    <div
      data-theme="dark"
      style={{
        backgroundColor: 'var(--color-bg-primary)',
        padding: 'var(--space-8)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border-light)',
      }}
    >
      <h3 style={{
        fontSize: 'var(--font-size-lg)',
        fontWeight: 'var(--font-weight-semibold)',
        color: 'var(--color-text-primary)',
        marginBottom: 'var(--space-4)',
        textAlign: 'center',
      }}>
        Dark Mode
      </h3>
      <EmptyState
        variant="plans"
        size="sm"
        compact
        onPrimaryAction={() => alert('Browse clicked')}
        onSecondaryAction={() => alert('Create clicked')}
      />
    </div>
  </div>
);

DarkModeDemo.storyName = 'Dark Mode Demo';
DarkModeDemo.parameters = {
  layout: 'padded',
  docs: {
    description: {
      story: `
**Dark Mode Compatibility**

The EmptyState component uses CSS custom properties (design tokens) for all colors,
ensuring automatic dark mode support:

- --color-bg-secondary: Icon container background
- --color-text-primary: Title text
- --color-text-secondary: Description text
- --color-bg-primary: Page background (inherited)

Use Storybook's theme toggle in the toolbar to switch between light and dark modes.
      `,
    },
  },
};

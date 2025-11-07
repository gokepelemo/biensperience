import React from 'react';
import { Container, Button } from 'react-bootstrap';
import { FaInfoCircle, FaTimes, FaCheckCircle, FaExclamationTriangle, FaExclamationCircle } from 'react-icons/fa';

export default {
  title: 'Design System/Banner Components',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Banner and alert components with semantic colors, proper spacing, borders, and interactive elements for user notifications.',
      },
    },
  },
};

// Banner Component
const Banner = ({ 
  type = 'info', // 'info', 'success', 'warning', 'danger', 'neutral'
  title,
  subtitle,
  hasButton = false,
  buttonText = 'Button',
  onClose,
  variant = 'light', // 'light' or 'solid'
}) => {
  const getColors = () => {
    const colors = {
      info: {
        light: {
          bg: 'rgba(23, 162, 184, 0.1)',
          border: 'var(--color-info)',
          text: 'var(--color-text-primary)',
          icon: 'var(--color-info)',
          button: 'var(--color-info)',
        },
        solid: {
          bg: 'var(--color-info)',
          border: 'var(--color-info)',
          text: 'white',
          icon: 'white',
          button: 'white',
        },
      },
      success: {
        light: {
          bg: 'rgba(40, 167, 69, 0.1)',
          border: 'var(--color-success)',
          text: 'var(--color-text-primary)',
          icon: 'var(--color-success)',
          button: 'var(--color-success)',
        },
        solid: {
          bg: 'var(--color-success)',
          border: 'var(--color-success)',
          text: 'white',
          icon: 'white',
          button: 'white',
        },
      },
      warning: {
        light: {
          bg: 'rgba(255, 193, 7, 0.1)',
          border: 'var(--color-warning)',
          text: 'var(--color-text-primary)',
          icon: 'var(--color-warning)',
          button: 'var(--color-warning)',
        },
        solid: {
          bg: 'var(--color-warning)',
          border: 'var(--color-warning)',
          text: 'var(--color-banner-text-solid)',
          icon: 'var(--color-banner-text-solid)',
          button: 'var(--color-banner-text-solid)',
        },
      },
      danger: {
        light: {
          bg: 'rgba(220, 53, 69, 0.1)',
          border: 'var(--color-danger)',
          text: 'var(--color-text-primary)',
          icon: 'var(--color-danger)',
          button: 'var(--color-danger)',
        },
        solid: {
          bg: 'var(--color-danger)',
          border: 'var(--color-danger)',
          text: 'white',
          icon: 'white',
          button: 'white',
        },
      },
      neutral: {
        light: {
          bg: 'var(--color-bg-secondary)',
          border: 'var(--color-border-heavy)',
          text: 'var(--color-text-primary)',
          icon: 'var(--color-text-primary)',
          button: 'var(--color-text-primary)',
        },
        solid: {
          bg: 'var(--color-text-primary)',
          border: 'var(--color-text-primary)',
          text: 'var(--color-bg-primary)',
          icon: 'var(--color-bg-primary)',
          button: 'var(--color-bg-primary)',
        },
      },
    };
    return colors[type][variant];
  };

  const getIcon = () => {
    const icons = {
      info: FaInfoCircle,
      success: FaCheckCircle,
      warning: FaExclamationTriangle,
      danger: FaExclamationCircle,
      neutral: FaInfoCircle,
    };
    const Icon = icons[type];
    return <Icon size={20} />;
  };

  const colors = getColors();

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-4)',
      padding: 'var(--space-4) var(--space-5)',
      backgroundColor: colors.bg,
      border: `2px solid ${colors.border}`,
      borderRadius: 'var(--radius-xl)',
      marginBottom: 'var(--space-4)',
    }}>
      <div style={{ 
        color: colors.icon,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
      }}>
        {getIcon()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 'var(--font-size-base)',
          fontWeight: 'var(--font-weight-semibold)',
          color: colors.text,
          marginBottom: subtitle ? 'var(--space-1)' : 0,
        }}>
          {title}
        </div>
        {subtitle && (
          <div style={{
            fontSize: 'var(--font-size-sm)',
            color: variant === 'solid' ? colors.text : 'var(--color-text-secondary)',
            opacity: variant === 'solid' ? 0.9 : 1,
          }}>
            {subtitle}
          </div>
        )}
      </div>
      {hasButton && (
        <Button
          style={{
            backgroundColor: variant === 'solid' ? colors.button : colors.bg,
            color: variant === 'solid' ? colors.bg : colors.button,
            border: variant === 'solid' ? 'none' : `2px solid ${colors.button}`,
            borderRadius: 'var(--radius-full)',
            padding: 'var(--space-2) var(--space-5)',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-semibold)',
            flexShrink: 0,
            transition: 'var(--transition-normal)',
          }}
        >
          {buttonText}
        </Button>
      )}
      {onClose && (
        <button
          onClick={onClose}
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            color: colors.icon,
            cursor: 'pointer',
            padding: 'var(--space-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            opacity: 0.7,
            transition: 'var(--transition-normal)',
          }}
        >
          <FaTimes size={16} />
        </button>
      )}
    </div>
  );
};

// All Banner Variations
export const BannerVariations = {
  render: () => (
    <div style={{
      backgroundColor: 'var(--color-bg-primary)',
      minHeight: '100vh',
      padding: 'var(--space-8)',
    }}>
      <Container>
        <h1 style={{
          fontSize: 'var(--font-size-3xl)',
          fontWeight: 'var(--font-weight-bold)',
          color: 'var(--color-text-primary)',
          marginBottom: 'var(--space-2)',
        }}>
          Banner Components
        </h1>
        <p style={{
          fontSize: 'var(--font-size-lg)',
          color: 'var(--color-text-secondary)',
          marginBottom: 'var(--space-8)',
        }}>
          Semantic alert banners with light and solid variants
        </p>

        {/* Light Variants - Left Column */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))',
          gap: 'var(--space-6)',
          marginBottom: 'var(--space-8)',
        }}>
          <div>
            <h3 style={{
              fontSize: 'var(--font-size-xl)',
              fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--color-text-primary)',
              marginBottom: 'var(--space-4)',
            }}>
              Light Variants
            </h3>

            <Banner
              type="neutral"
              title="Title"
              subtitle="This is a supporting text."
              hasButton
              onClose={() => {}}
            />

            <Banner
              type="info"
              title="Title"
              subtitle="This is a supporting text."
              hasButton
              onClose={() => {}}
            />

            <Banner
              type="danger"
              title="Title"
              subtitle="This is a supporting text."
              hasButton
              onClose={() => {}}
            />

            <Banner
              type="warning"
              title="Title"
              subtitle="This is a supporting text."
              hasButton
              onClose={() => {}}
            />

            <Banner
              type="success"
              title="Title"
              subtitle="This is a supporting text."
              hasButton
              onClose={() => {}}
            />
          </div>

          {/* Solid Variants - Right Column */}
          <div>
            <h3 style={{
              fontSize: 'var(--font-size-xl)',
              fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--color-text-primary)',
              marginBottom: 'var(--space-4)',
            }}>
              Solid Variants
            </h3>

            <Banner
              type="neutral"
              variant="solid"
              title="Title"
              subtitle="This is a supporting text."
              hasButton
              onClose={() => {}}
            />

            <Banner
              type="info"
              variant="solid"
              title="Title"
              subtitle="This is a supporting text."
              hasButton
              onClose={() => {}}
            />

            <Banner
              type="danger"
              variant="solid"
              title="Title"
              subtitle="This is a supporting text."
              hasButton
              onClose={() => {}}
            />

            <Banner
              type="warning"
              variant="solid"
              title="Title"
              subtitle="This is a supporting text."
              hasButton
              onClose={() => {}}
            />

            <Banner
              type="success"
              variant="solid"
              title="Title"
              subtitle="This is a supporting text."
              hasButton
              onClose={() => {}}
            />
          </div>
        </div>

        {/* Compact Variations */}
        <h3 style={{
          fontSize: 'var(--font-size-xl)',
          fontWeight: 'var(--font-weight-semibold)',
          color: 'var(--color-text-primary)',
          marginBottom: 'var(--space-4)',
        }}>
          Compact Variations (Title Only)
        </h3>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
          gap: 'var(--space-4)',
        }}>
          <div>
            <Banner
              type="info"
              title="Information message without subtitle"
              onClose={() => {}}
            />
            <Banner
              type="success"
              title="Success message"
              hasButton
              buttonText="Action"
            />
            <Banner
              type="warning"
              title="Warning notification"
              onClose={() => {}}
            />
          </div>
          <div>
            <Banner
              type="danger"
              variant="solid"
              title="Error occurred"
              onClose={() => {}}
            />
            <Banner
              type="success"
              variant="solid"
              title="Operation completed"
              hasButton
              buttonText="View"
            />
            <Banner
              type="neutral"
              title="System notification"
              hasButton
              buttonText="Dismiss"
            />
          </div>
        </div>
      </Container>
    </div>
  ),
};

// Simple usage examples
export const BannerExamples = {
  render: () => (
  <div style={{
    backgroundColor: 'var(--color-bg-secondary)',
    minHeight: '100vh',
    padding: 'var(--space-8)',
  }}>
    <Container style={{ maxWidth: '800px' }}>
      <h2 style={{
        fontSize: 'var(--font-size-2xl)',
        fontWeight: 'var(--font-weight-bold)',
        color: 'var(--color-text-primary)',
        marginBottom: 'var(--space-6)',
      }}>
        Banner Usage Examples
      </h2>

      <Banner
        type="info"
        title="New Destination Added"
        subtitle="Explore our latest featured destination with curated experiences and local guides."
        hasButton
        buttonText="Explore Now"
      />

      <Banner
        type="success"
        variant="solid"
        title="Trip Booked Successfully"
        subtitle="Your adventure to Kyoto has been confirmed. Check your email for itinerary details."
        onClose={() => console.log('Closed')}
      />

      <Banner
        type="warning"
        title="Travel Advisory"
        subtitle="Weather conditions may affect your upcoming trip. Please review updated recommendations."
        hasButton
        buttonText="View Updates"
        onClose={() => console.log('Closed')}
      />

      <Banner
        type="danger"
        title="Booking Expired"
        subtitle="Your reservation hold has expired. Please complete payment to secure your adventure."
        hasButton
        buttonText="Complete Booking"
      />

      <Banner
        type="neutral"
        variant="solid"
        title="System Maintenance"
        subtitle="Booking system will be unavailable Saturday, 2AM - 4AM EST for updates."
        hasButton
        buttonText="View Schedule"
        onClose={() => console.log('Closed')}
      />
    </Container>
  </div>
  ),
};

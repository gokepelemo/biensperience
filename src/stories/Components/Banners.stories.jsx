/**
 * Banner Components - Consolidated Stories
 *
 * Combined from:
 * - src/stories/BannerComponents.stories.jsx (Banner variations & examples)
 * - src/stories/Components/Banner.stories.jsx (Component with props)
 *
 * Semantic alert banners for the travel planning platform.
 * Supports auto-expiry, dismissible, custom icons, and dark mode.
 */

import React, { useState, useEffect } from 'react';
import { Container, Button, Badge } from 'react-bootstrap';
import { Banner } from '../../components/design-system';
import BannerDemo from '../../components/Banner/BannerDemo';
import {
  FaInfoCircle,
  FaTimes,
  FaCheckCircle,
  FaExclamationTriangle,
  FaExclamationCircle,
  FaRocket,
  FaHeart,
  FaPlane,
  FaMapMarkerAlt,
  FaCalendarCheck,
  FaSuitcase,
} from 'react-icons/fa';

export default {
  title: 'Components/Feedback/Banners',
  component: Banner,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
Semantic banner components for travel planning notifications and alerts.

**Features:**
- 🎨 5 semantic types: info, success, warning, danger, neutral
- 🌓 Light, solid, and bordered variants
- 📏 Small, medium, and large sizes
- ⏱️ Auto-expiry with smooth animations
- ❌ Dismissible with callbacks
- 🎭 Custom icons and buttons
- 🌙 Full dark mode support
        `,
      },
    },
  },
  argTypes: {
    type: {
      control: { type: 'select' },
      options: ['info', 'success', 'warning', 'danger', 'neutral'],
      description: 'Banner semantic type',
    },
    variant: {
      control: { type: 'select' },
      options: ['light', 'solid', 'bordered'],
      description: 'Visual style variant',
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
      description: 'Banner size',
    },
  },
};

// ============================================================
// BASIC EXAMPLES
// ============================================================

export const Basic = {
  args: {
    type: 'info',
    title: 'Information Banner',
    message: 'This is a basic information banner with default settings.',
  },
};

export const AllTypes = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <Banner type="info" title="Info Banner" message="Informational notification for the traveler." />
      <Banner type="success" title="Success Banner" message="Your trip has been booked successfully!" />
      <Banner type="warning" title="Warning Banner" message="Weather advisory for your destination." />
      <Banner type="danger" title="Error Banner" message="Unable to process your booking. Please try again." />
      <Banner type="neutral" title="Neutral Banner" message="General system announcement." />
    </div>
  ),
};

export const AllVariants = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <Banner type="success" variant="light" title="Light Variant" message="Subtle background with colored border." />
      <Banner type="success" variant="solid" title="Solid Variant" message="Bold background with white text." />
      <Banner type="success" variant="bordered" title="Bordered Variant" message="Thick border with light background." />
    </div>
  ),
};

export const AllSizes = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <Banner type="info" size="sm" title="Small Banner" message="Compact for subtle notifications." />
      <Banner type="info" size="md" title="Medium Banner" message="Default size for most use cases." />
      <Banner type="info" size="lg" title="Large Banner" message="Prominent for important messages." />
    </div>
  ),
};

// ============================================================
// INTERACTIVE FEATURES
// ============================================================

export const WithButtons = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <Banner
        type="success"
        title="Trip Confirmed!"
        message="Your Kyoto adventure is booked for March 2025."
        button={{
          text: 'View Itinerary',
          variant: 'outline',
          onClick: () => alert('Viewing itinerary!'),
        }}
      />
      <Banner
        type="warning"
        title="Verify Your Email"
        message="Please verify your email to complete your booking."
        button={{
          text: 'Verify Now',
          variant: 'gradient',
          onClick: () => alert('Verification started!'),
        }}
      />
      <Banner
        type="info"
        variant="solid"
        title="New Destinations Available"
        message="Explore our latest curated travel experiences."
        button={{
          text: 'Explore',
          onClick: () => alert('Exploring destinations!'),
        }}
      />
    </div>
  ),
};

export const CustomIcons = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <Banner
        type="success"
        title="Achievement Unlocked!"
        message="You've completed 10 trips with Biensperience."
        icon={<FaRocket size={20} />}
      />
      <Banner
        type="neutral"
        title="Thank You"
        message="We appreciate your continued support."
        icon={<FaHeart size={20} />}
      />
      <Banner
        type="info"
        title="Flight Reminder"
        message="Your flight to Tokyo departs in 24 hours."
        icon={<FaPlane size={20} />}
      />
      <Banner
        type="info"
        title="No Icon"
        message="This banner has showIcon set to false."
        showIcon={false}
      />
    </div>
  ),
};

export const Dismissible = {
  render: () => {
    const [visibleBanners, setVisibleBanners] = useState({
      info: true,
      warning: true,
      success: true,
    });

    const handleDismiss = (type) => {
      setVisibleBanners((prev) => ({ ...prev, [type]: false }));
    };

    const resetAll = () => {
      setVisibleBanners({ info: true, warning: true, success: true });
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {visibleBanners.info && (
          <Banner
            type="info"
            title="Dismissible Info"
            message="Click the X to dismiss this travel tip."
            dismissible
            onDismiss={() => handleDismiss('info')}
          />
        )}
        {visibleBanners.warning && (
          <Banner
            type="warning"
            title="Dismissible Warning"
            message="Pack layers for variable weather!"
            dismissible
            onDismiss={() => handleDismiss('warning')}
          />
        )}
        {visibleBanners.success && (
          <Banner
            type="success"
            title="Dismissible Success"
            message="Your hotel reservation is confirmed."
            dismissible
            onDismiss={() => handleDismiss('success')}
          />
        )}
        {!Object.values(visibleBanners).some(Boolean) && (
          <button
            onClick={resetAll}
            style={{
              padding: 'var(--space-3) var(--space-4)',
              background: 'var(--gradient-primary)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontWeight: 'var(--font-weight-semibold)',
            }}
          >
            Show All Banners Again
          </button>
        )}
      </div>
    );
  },
};

export const AutoExpiry = {
  render: () => {
    const [showBanner, setShowBanner] = useState(true);
    const [countdown, setCountdown] = useState(5);

    useEffect(() => {
      if (showBanner && countdown > 0) {
        const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
        return () => clearTimeout(timer);
      }
    }, [showBanner, countdown]);

    const resetBanner = () => {
      setShowBanner(true);
      setCountdown(5);
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {showBanner && (
          <Banner
            type="info"
            title={`Auto-Expiring Banner (${countdown}s)`}
            message="This banner will automatically disappear in 5 seconds with a smooth exit animation."
            expiryTime={5000}
            onExpiry={() => setShowBanner(false)}
          />
        )}
        {!showBanner && (
          <button
            onClick={resetBanner}
            style={{
              padding: 'var(--space-3) var(--space-4)',
              background: 'var(--gradient-primary)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontWeight: 'var(--font-weight-semibold)',
            }}
          >
            Show Banner Again
          </button>
        )}
      </div>
    );
  },
};

// ============================================================
// TRAVEL-THEMED EXAMPLES
// ============================================================

export const TravelNotifications = {
  render: () => (
    <div style={{
      backgroundColor: 'var(--color-bg-primary)',
      padding: 'var(--space-6)',
      minHeight: '100vh',
    }}>
      <Container>
        <h2 style={{
          fontSize: 'var(--font-size-2xl)',
          fontWeight: 'var(--font-weight-bold)',
          color: 'var(--color-text-primary)',
          marginBottom: 'var(--space-6)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
        }}>
          <FaPlane style={{ color: 'var(--color-primary)' }} />
          Travel Notifications
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Welcome Banner */}
          <Banner
            type="success"
            variant="solid"
            title="Welcome back, Alex!"
            message="You have 3 upcoming trips and 2 new destination recommendations."
            icon={<FaHeart size={20} />}
            button={{
              text: 'View Trips',
              variant: 'outline',
              onClick: () => console.log('View trips'),
            }}
          />

          {/* Booking Confirmation */}
          <Banner
            type="success"
            title="Trip Booked Successfully!"
            message="Your adventure to Kyoto, Japan has been confirmed. Check your email for the complete itinerary."
            icon={<FaCalendarCheck size={20} />}
            dismissible
            onDismiss={() => console.log('Dismissed')}
          />

          {/* Travel Advisory */}
          <Banner
            type="warning"
            title="Weather Alert"
            message="Heavy rain expected in your destination area next week. Consider packing waterproof gear."
            icon="🌧️"
            button={{
              text: 'Check Weather',
              onClick: () => console.log('Check weather'),
            }}
          />

          {/* Payment Failed */}
          <Banner
            type="danger"
            title="Payment Failed"
            message="We couldn't process your payment for the Paris getaway. Please update your card details."
            button={{
              text: 'Retry Payment',
              variant: 'gradient',
              onClick: () => console.log('Retry payment'),
            }}
          />

          {/* System Maintenance */}
          <Banner
            type="neutral"
            title="System Maintenance"
            message="Scheduled maintenance tonight from 2-4 AM EST. Booking features may be temporarily unavailable."
            dismissible
            onDismiss={() => console.log('Maintenance dismissed')}
          />

          {/* New Feature */}
          <Banner
            type="info"
            variant="solid"
            title="New Feature: Collaborative Planning"
            message="Now you can invite friends and family to plan trips together in real-time!"
            icon={<FaRocket size={20} />}
            button={{
              text: 'Try It Now',
              onClick: () => console.log('Try feature'),
            }}
          />
        </div>
      </Container>
    </div>
  ),
  parameters: {
    layout: 'fullscreen',
  },
};

// ============================================================
// MOBILE-FIRST DEMO
// ============================================================

export const MobileBanners = {
  render: () => (
    <div style={{
      backgroundColor: 'var(--color-bg-primary)',
      minHeight: '100vh',
      maxWidth: '428px',
      margin: '0 auto',
      padding: 'var(--space-3)',
    }}>
      {/* Mobile Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'var(--space-3)',
        background: 'var(--gradient-primary)',
        borderRadius: 'var(--radius-lg)',
        color: 'white',
        marginBottom: 'var(--space-4)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <FaPlane />
          <span style={{ fontWeight: 'var(--font-weight-bold)' }}>Notifications</span>
        </div>
        <Badge bg="light" text="dark" pill>4</Badge>
      </div>

      {/* Mobile Banners */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <Banner
          type="success"
          size="sm"
          title="Booking Confirmed"
          message="Tokyo trip is set for April 15-22"
          dismissible
        />

        <Banner
          type="info"
          size="sm"
          title="Pack Light"
          message="Spring weather expected - avg 18°C"
          icon="🌸"
        />

        <Banner
          type="warning"
          size="sm"
          title="Visa Required"
          message="Apply at least 2 weeks before travel"
          button={{
            text: 'Apply',
            onClick: () => console.log('Apply visa'),
          }}
        />

        <Banner
          type="neutral"
          size="sm"
          variant="bordered"
          title="Travel Insurance"
          message="Add coverage for peace of mind"
          button={{
            text: 'Learn More',
            onClick: () => console.log('Insurance'),
          }}
        />
      </div>
    </div>
  ),
  parameters: {
    viewport: {
      defaultViewport: 'mobile',
    },
    docs: {
      description: {
        story: 'Mobile-optimized banners with compact sizing for travel notifications on smaller screens.',
      },
    },
  },
};

// ============================================================
// COMPREHENSIVE VARIATIONS
// ============================================================

export const AllVariations = {
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

        {/* Grid Layout */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
          gap: 'var(--space-6)',
          marginBottom: 'var(--space-8)',
        }}>
          {/* Light Variants */}
          <div>
            <h3 style={{
              fontSize: 'var(--font-size-xl)',
              fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--color-text-primary)',
              marginBottom: 'var(--space-4)',
            }}>
              Light Variants
            </h3>

            <StandaloneBanner type="neutral" title="Neutral" subtitle="Supporting text here." />
            <StandaloneBanner type="info" title="Information" subtitle="Supporting text here." />
            <StandaloneBanner type="danger" title="Error" subtitle="Supporting text here." />
            <StandaloneBanner type="warning" title="Warning" subtitle="Supporting text here." />
            <StandaloneBanner type="success" title="Success" subtitle="Supporting text here." />
          </div>

          {/* Solid Variants */}
          <div>
            <h3 style={{
              fontSize: 'var(--font-size-xl)',
              fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--color-text-primary)',
              marginBottom: 'var(--space-4)',
            }}>
              Solid Variants
            </h3>

            <StandaloneBanner type="neutral" variant="solid" title="Neutral" subtitle="Supporting text." />
            <StandaloneBanner type="info" variant="solid" title="Information" subtitle="Supporting text." />
            <StandaloneBanner type="danger" variant="solid" title="Error" subtitle="Supporting text." />
            <StandaloneBanner type="warning" variant="solid" title="Warning" subtitle="Supporting text." />
            <StandaloneBanner type="success" variant="solid" title="Success" subtitle="Supporting text." />
          </div>
        </div>
      </Container>
    </div>
  ),
  parameters: {
    layout: 'fullscreen',
  },
};

// ============================================================
// DARK MODE SHOWCASE
// ============================================================

export const DarkModeShowcase = {
  render: () => (
    <div style={{
      backgroundColor: 'var(--color-bg-primary)',
      color: 'var(--color-text-primary)',
      padding: 'var(--space-6)',
      borderRadius: 'var(--radius-xl)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-3)',
    }}>
      <h3 style={{ margin: 0, marginBottom: 'var(--space-2)', color: 'var(--color-text-primary)' }}>
        Dark Mode Banners
      </h3>
      <Banner type="info" title="Dark Mode Info" message="Banners adapt automatically to dark mode." />
      <Banner type="success" variant="solid" title="Dark Mode Success" message="Solid variants work great in dark mode." />
      <Banner type="warning" title="Dark Mode Warning" message="Warning colors optimized for dark backgrounds." />
      <Banner
        type="neutral"
        variant="bordered"
        title="Dark Mode Neutral"
        message="Bordered variant with custom styling."
        button={{
          text: 'Action',
          onClick: () => alert('Dark mode action!'),
        }}
      />
    </div>
  ),
  parameters: {
    backgrounds: {
      default: 'dark',
    },
  },
};

// ============================================================
// INTERACTIVE DEMO
// ============================================================

export const InteractiveDemo = {
  render: () => <BannerDemo />,
  parameters: {
    docs: {
      description: {
        story: 'Interactive demo showcasing all Banner component features including auto-expiry, dismissible banners, custom icons, and various configurations.',
      },
    },
  },
};

// ============================================================
// HELPER COMPONENT - Standalone Banner (for variations display)
// ============================================================

const StandaloneBanner = ({
  type = 'info',
  title,
  subtitle,
  variant = 'light',
  hasButton = true,
  onClose = () => {},
}) => {
  const getColors = () => {
    const colors = {
      info: {
        light: {
          bg: 'rgba(23, 162, 184, 0.1)',
          border: 'var(--color-info)',
          text: 'var(--color-text-primary)',
          icon: 'var(--color-info)',
        },
        solid: {
          bg: 'var(--color-info)',
          border: 'var(--color-info)',
          text: 'white',
          icon: 'white',
        },
      },
      success: {
        light: {
          bg: 'rgba(40, 167, 69, 0.1)',
          border: 'var(--color-success)',
          text: 'var(--color-text-primary)',
          icon: 'var(--color-success)',
        },
        solid: {
          bg: 'var(--color-success)',
          border: 'var(--color-success)',
          text: 'white',
          icon: 'white',
        },
      },
      warning: {
        light: {
          bg: 'rgba(255, 193, 7, 0.1)',
          border: 'var(--color-warning)',
          text: 'var(--color-text-primary)',
          icon: 'var(--color-warning)',
        },
        solid: {
          bg: 'var(--color-warning)',
          border: 'var(--color-warning)',
          text: '#333',
          icon: '#333',
        },
      },
      danger: {
        light: {
          bg: 'rgba(220, 53, 69, 0.1)',
          border: 'var(--color-danger)',
          text: 'var(--color-text-primary)',
          icon: 'var(--color-danger)',
        },
        solid: {
          bg: 'var(--color-danger)',
          border: 'var(--color-danger)',
          text: 'white',
          icon: 'white',
        },
      },
      neutral: {
        light: {
          bg: 'var(--color-bg-secondary)',
          border: 'var(--color-border-heavy)',
          text: 'var(--color-text-primary)',
          icon: 'var(--color-text-primary)',
        },
        solid: {
          bg: 'var(--color-text-primary)',
          border: 'var(--color-text-primary)',
          text: 'var(--color-bg-primary)',
          icon: 'var(--color-bg-primary)',
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
      marginBottom: 'var(--space-3)',
    }}>
      <div style={{ color: colors.icon, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
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
          size="sm"
          style={{
            backgroundColor: variant === 'solid' ? 'rgba(255,255,255,0.2)' : 'transparent',
            color: variant === 'solid' ? colors.text : colors.icon,
            border: variant === 'solid' ? 'none' : `2px solid ${colors.icon}`,
            borderRadius: 'var(--radius-full)',
            fontWeight: 'var(--font-weight-semibold)',
          }}
        >
          Button
        </Button>
      )}
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
          opacity: 0.7,
        }}
      >
        <FaTimes size={16} />
      </button>
    </div>
  );
};

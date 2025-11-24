import React, { useState, useEffect } from 'react';
import { Banner } from '../../components/design-system';
import { FaRocket, FaHeart } from 'react-icons/fa';
import BannerDemo from '../../components/Banner/BannerDemo';

export default {
  title: 'Design System/Banner',
  component: Banner,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Reusable banner component with auto-expiry, configurable buttons, icons, and full dark mode support. Built using the design system for consistent styling across the application.',
      },
    },
  },
  argTypes: {
    type: {
      control: { type: 'select' },
      options: ['info', 'success', 'warning', 'danger', 'neutral'],
      description: 'Banner semantic type affecting colors and default icon',
    },
    variant: {
      control: { type: 'select' },
      options: ['light', 'solid', 'bordered'],
      description: 'Visual style variant',
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
      description: 'Banner size affecting padding and font sizes',
    },
    expiryTime: {
      control: { type: 'number' },
      description: 'Auto-expiry time in milliseconds (0 = no expiry)',
    },
  },
};

// Basic banner examples
export const Basic = {
  args: {
    type: 'info',
    title: 'Information Banner',
    message: 'This is a basic information banner with default settings.',
  },
};

// All banner types
export const Types = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <Banner type="info" title="Info Banner" message="This is an informational message." />
      <Banner type="success" title="Success Banner" message="Operation completed successfully!" />
      <Banner type="warning" title="Warning Banner" message="Please review this important information." />
      <Banner type="danger" title="Error Banner" message="Something went wrong. Please try again." />
      <Banner type="neutral" title="Neutral Banner" message="General notification or announcement." />
    </div>
  ),
};

// All variants
export const Variants = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <Banner type="success" variant="light" title="Light Variant" message="Subtle background with colored border." />
      <Banner type="success" variant="solid" title="Solid Variant" message="Solid background with white text." />
      <Banner type="success" variant="bordered" title="Bordered Variant" message="Thick border with light background." />
    </div>
  ),
};

// All sizes
export const Sizes = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <Banner type="info" size="sm" title="Small Banner" message="Compact size for subtle notifications." />
      <Banner type="info" size="md" title="Medium Banner" message="Default size for most use cases." />
      <Banner type="info" size="lg" title="Large Banner" message="Prominent size for important messages." />
    </div>
  ),
};

// With buttons
export const WithButtons = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <Banner
        type="success"
        title="Welcome Back!"
        message="Your profile has been updated successfully."
        button={{
          text: 'View Profile',
          variant: 'outline',
          onClick: () => alert('Profile clicked!')
        }}
      />
      <Banner
        type="warning"
        title="Action Required"
        message="Please verify your email address to continue."
        button={{
          text: 'Verify Email',
          variant: 'gradient',
          onClick: () => alert('Verify clicked!')
        }}
      />
      <Banner
        type="info"
        variant="solid"
        title="New Feature Available"
        message="Check out our latest travel planning tools."
        button={{
          text: 'Explore',
          onClick: () => alert('Explore clicked!')
        }}
      />
    </div>
  ),
};

// With custom icons
export const CustomIcons = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
        title="No Icon"
        message="This banner has showIcon set to false."
        showIcon={false}
      />
    </div>
  ),
};

// Dismissible banners
export const Dismissible = {
  render: () => {
    const [visibleBanners, setVisibleBanners] = useState({
      info: true,
      warning: true,
      success: true
    });

    const handleDismiss = (type) => {
      setVisibleBanners(prev => ({ ...prev, [type]: false }));
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {visibleBanners.info && (
          <Banner
            type="info"
            title="Dismissible Info"
            message="Click the X to dismiss this banner."
            dismissible
            onDismiss={() => handleDismiss('info')}
          />
        )}
        {visibleBanners.warning && (
          <Banner
            type="warning"
            title="Dismissible Warning"
            message="This warning can be dismissed."
            dismissible
            onDismiss={() => handleDismiss('warning')}
          />
        )}
        {visibleBanners.success && (
          <Banner
            type="success"
            title="Dismissible Success"
            message="Great job! This can be dismissed too."
            dismissible
            onDismiss={() => handleDismiss('success')}
          />
        )}
      </div>
    );
  },
};

// Auto-expiry banners
export const AutoExpiry = {
  render: () => {
    const [showBanner, setShowBanner] = useState(true);

    const handleExpiry = () => {
      console.log('Banner expired automatically');
      setShowBanner(false);
    };

    const resetBanner = () => {
      setShowBanner(true);
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {showBanner && (
          <Banner
            type="info"
            title="Auto-Expiring Banner"
            message="This banner will automatically disappear in 5 seconds with a smooth exit animation."
            expiryTime={5000}
            onExpiry={handleExpiry}
          />
        )}
        {!showBanner && (
          <button
            onClick={resetBanner}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: 'var(--color-primary)',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer'
            }}
          >
            Show Banner Again
          </button>
        )}
      </div>
    );
  },
};

// Complex example with all features
export const ComplexExample = {
  render: () => {
    const [visible, setVisible] = useState(true);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {visible && (
          <Banner
            type="success"
            variant="solid"
            size="lg"
            title="🎉 Welcome to Biensperience Premium!"
            message="Your subscription is now active. Enjoy unlimited access to all premium features, including advanced trip planning tools and priority customer support."
            icon={<FaRocket size={24} />}
            dismissible
            expiryTime={10000} // 10 seconds
            onDismiss={() => setVisible(false)}
            onExpiry={() => setVisible(false)}
            button={{
              text: 'Explore Premium Features',
              variant: 'outline',
              onClick: () => alert('Premium features clicked!')
            }}
          />
        )}
        {!visible && (
          <button
            onClick={() => setVisible(true)}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: 'var(--color-primary)',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer'
            }}
          >
            Show Premium Banner
          </button>
        )}
      </div>
    );
  },
};

// Dark mode showcase
export const DarkModeShowcase = {
  render: () => (
    <div style={{
      backgroundColor: '#1a1a1a',
      color: 'white',
      padding: '2rem',
      borderRadius: '1rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem'
    }}>
      <h3 style={{ margin: 0, color: 'white' }}>Dark Mode Banners</h3>
      <Banner type="info" title="Dark Mode Info" message="This banner adapts to dark mode automatically." />
      <Banner type="success" variant="solid" title="Dark Mode Success" message="Solid variants work great in dark mode." />
      <Banner type="warning" title="Dark Mode Warning" message="Warning colors are optimized for dark backgrounds." />
      <Banner
        type="neutral"
        variant="bordered"
        title="Dark Mode Neutral"
        message="Bordered variant with custom styling."
        button={{
          text: 'Action',
          onClick: () => alert('Dark mode action!')
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

// Real-world usage examples
export const RealWorldExamples = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Welcome message */}
      <Banner
        type="success"
        variant="solid"
        title="Welcome back, Alex!"
        message="You have 3 upcoming trips and 2 new destination recommendations."
        button={{
          text: 'View Trips',
          onClick: () => console.log('View trips')
        }}
      />

      {/* System notification */}
      <Banner
        type="neutral"
        title="System Maintenance"
        message="Scheduled maintenance will occur tonight from 2-4 AM EST. Some features may be temporarily unavailable."
        dismissible
        onDismiss={() => console.log('Maintenance notice dismissed')}
      />

      {/* Error with action */}
      <Banner
        type="danger"
        title="Payment Failed"
        message="We couldn't process your payment. Please check your card details and try again."
        button={{
          text: 'Retry Payment',
          variant: 'gradient',
          onClick: () => console.log('Retry payment')
        }}
      />

      {/* Success with auto-expiry */}
      <Banner
        type="success"
        title="Trip Saved!"
        message="Your Kyoto adventure has been saved to your planning dashboard."
        expiryTime={4000}
        onExpiry={() => console.log('Trip saved banner expired')}
      />

      {/* Warning with custom icon */}
      <Banner
        type="warning"
        title="Weather Alert"
        message="Heavy rain expected in your destination area. Consider rescheduling indoor activities."
        icon="🌧️"
        button={{
          text: 'Check Weather',
          onClick: () => console.log('Check weather')
        }}
      />
    </div>
  ),
};
// Interactive Demo
export const InteractiveDemo = {
  render: () => <BannerDemo />,
  parameters: {
    docs: {
      description: {
        story: "Interactive demo showcasing all Banner component features including auto-expiry, dismissible banners, custom icons, and various configurations.",
      },
    },
  },
};

import React, { useState } from 'react';
import { Banner } from '../design-system';
import { FaRocket, FaHeart, FaExclamationTriangle } from 'react-icons/fa';

/**
 * Demo component showcasing Banner component features
 * This demonstrates auto-expiry, buttons, custom icons, and various configurations
 */
export default function BannerDemo() {
  const [showAutoExpiry, setShowAutoExpiry] = useState(false);
  const [showComplex, setShowComplex] = useState(false);
  const [dismissedBanners, setDismissedBanners] = useState({});

  const handleBannerDismiss = (bannerId) => {
    setDismissedBanners(prev => ({ ...prev, [bannerId]: true }));
  };

  const resetBanner = (bannerId) => {
    setDismissedBanners(prev => ({ ...prev, [bannerId]: false }));
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '2rem', color: 'var(--color-text-primary)' }}>
        Banner Component Demo
      </h1>

      {/* Basic Types Showcase */}
      <section style={{ marginBottom: '3rem' }}>
        <h2 style={{ marginBottom: '1rem', color: 'var(--color-text-primary)' }}>
          Basic Banner Types
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Banner type="info" title="Info Banner" message="This is an informational message." />
          <Banner type="success" title="Success Banner" message="Operation completed successfully!" />
          <Banner type="warning" title="Warning Banner" message="Please review this important information." />
          <Banner type="danger" title="Error Banner" message="Something went wrong. Please try again." />
          <Banner type="neutral" title="Neutral Banner" message="General notification or announcement." />
        </div>
      </section>

      {/* Variants Showcase */}
      <section style={{ marginBottom: '3rem' }}>
        <h2 style={{ marginBottom: '1rem', color: 'var(--color-text-primary)' }}>
          Banner Variants
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Banner type="success" variant="light" title="Light Variant" message="Subtle background with colored border." />
          <Banner type="success" variant="solid" title="Solid Variant" message="Solid background with white text." />
          <Banner type="success" variant="bordered" title="Bordered Variant" message="Thick border with light background." />
        </div>
      </section>

      {/* Sizes Showcase */}
      <section style={{ marginBottom: '3rem' }}>
        <h2 style={{ marginBottom: '1rem', color: 'var(--color-text-primary)' }}>
          Banner Sizes
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Banner type="info" size="sm" title="Small Banner" message="Compact size for subtle notifications." />
          <Banner type="info" size="md" title="Medium Banner" message="Default size for most use cases." />
          <Banner type="info" size="lg" title="Large Banner" message="Prominent size for important messages." />
        </div>
      </section>

      {/* Custom Icons */}
      <section style={{ marginBottom: '3rem' }}>
        <h2 style={{ marginBottom: '1rem', color: 'var(--color-text-primary)' }}>
          Custom Icons
        </h2>
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
            type="warning"
            title="Weather Alert"
            message="Heavy rain expected in your destination area."
            icon="🌧️"
          />
        </div>
      </section>

      {/* With Buttons */}
      <section style={{ marginBottom: '3rem' }}>
        <h2 style={{ marginBottom: '1rem', color: 'var(--color-text-primary)' }}>
          Banners with Buttons
        </h2>
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
      </section>

      {/* Dismissible Banners */}
      <section style={{ marginBottom: '3rem' }}>
        <h2 style={{ marginBottom: '1rem', color: 'var(--color-text-primary)' }}>
          Dismissible Banners
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {!dismissedBanners.info && (
            <Banner
              type="info"
              title="Dismissible Info"
              message="Click the X to dismiss this banner."
              dismissible
              onDismiss={() => handleBannerDismiss('info')}
            />
          )}
          {!dismissedBanners.warning && (
            <Banner
              type="warning"
              title="Dismissible Warning"
              message="This warning can be dismissed."
              dismissible
              onDismiss={() => handleBannerDismiss('warning')}
            />
          )}
          {!dismissedBanners.success && (
            <Banner
              type="success"
              title="Dismissible Success"
              message="Great job! This can be dismissed too."
              dismissible
              onDismiss={() => handleBannerDismiss('success')}
            />
          )}

          {(dismissedBanners.info || dismissedBanners.warning || dismissedBanners.success) && (
            <button
              onClick={() => {
                setDismissedBanners({});
              }}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: 'var(--color-primary)',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                marginTop: '1rem'
              }}
            >
              Reset Dismissed Banners
            </button>
          )}
        </div>
      </section>

      {/* Auto-expiry Banner */}
      <section style={{ marginBottom: '3rem' }}>
        <h2 style={{ marginBottom: '1rem', color: 'var(--color-text-primary)' }}>
          Auto-expiry Banner
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {showAutoExpiry ? (
            <Banner
              type="info"
              title="Auto-Expiring Banner"
              message="This banner will automatically disappear in 5 seconds with a smooth exit animation."
              expiryTime={5000}
              onExpiry={() => setShowAutoExpiry(false)}
            />
          ) : (
            <button
              onClick={() => setShowAutoExpiry(true)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: 'var(--color-info)',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer'
              }}
            >
              Show Auto-expiry Banner
            </button>
          )}
        </div>
      </section>

      {/* Complex Example */}
      <section style={{ marginBottom: '3rem' }}>
        <h2 style={{ marginBottom: '1rem', color: 'var(--color-text-primary)' }}>
          Complex Example
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {showComplex ? (
            <Banner
              type="success"
              variant="solid"
              size="lg"
              title="🎉 Welcome to Biensperience Premium!"
              message="Your subscription is now active. Enjoy unlimited access to all premium features, including advanced trip planning tools and priority customer support."
              icon={<FaRocket size={24} />}
              dismissible
              expiryTime={10000}
              onDismiss={() => setShowComplex(false)}
              onExpiry={() => setShowComplex(false)}
              button={{
                text: 'Explore Premium Features',
                variant: 'outline',
                onClick: () => alert('Premium features clicked!')
              }}
            />
          ) : (
            <button
              onClick={() => setShowComplex(true)}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: 'var(--color-success)',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: '600'
              }}
            >
              Show Premium Welcome Banner
            </button>
          )}
        </div>
      </section>

      {/* Dark Mode Notice */}
      <section>
        <Banner
          type="neutral"
          variant="bordered"
          title="Dark Mode Support"
          message="All banners automatically adapt to your system's dark mode preference. Try switching between light and dark modes to see the difference!"
          icon={<FaExclamationTriangle size={20} />}
        />
      </section>
    </div>
  );
}
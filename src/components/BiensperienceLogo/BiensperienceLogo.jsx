/**
 * Biensperience Logo Component
 * White rounded rectangle with purple gradient plus symbol
 */
import React from 'react';
import IconClean from '../../icons/icon-clean.svg?react';
import IconFlat from '../../icons/icon-flat.svg?react';
import IconSoft from '../../icons/icon-soft.svg?react';
import IconWhite from '../../icons/icon-white.svg?react';
import IconEngine from '../../icons/icon-engine.svg?react';

/**
 * Biensperience Logo Component
 * 
 * Unified logo component that supports multiple design variations.
 * 
 * Logo Types:
 * - "clean": Purple gradient background with white plus and drop shadow (default)
 * - "flat": Flat purple gradient background with white plus, no effects
 * - "soft": Soft purple gradient with subtle shadow
 * - "white": White background with purple gradient plus and shimmer effect
 * - "engine": Animated loading indicator that transforms from plus to spinning airplane engine
 * 
 * Size Presets:
 * - "xs": 16px
 * - "sm": 24px
 * - "md": 32px (default)
 * - "lg": 48px
 * - "xl": 64px
 * - "2xl": 96px
 * - "3xl": 128px
 * 
 * @param {string} [type='clean'] - Logo variation to display
 * @param {string} [size] - Preset size (xs, sm, md, lg, xl, 2xl, 3xl)
 * @param {number} [width] - Custom width in pixels (overrides size preset)
 * @param {number} [height] - Custom height in pixels (overrides size preset)
 * @param {number} [rotate] - Rotation angle in degrees
 * @param {number} [scale] - Scale factor (1 = original size)
 * @param {boolean} [flipH] - Flip horizontally
 * @param {boolean} [flipV] - Flip vertically
 * @param {string} [className=''] - Additional CSS classes
 * @param {Object} [style] - Additional inline styles
 * @returns {JSX.Element}
 * 
 * @example
 * // Default clean logo at medium size
 * <BiensperienceLogo />
 * 
 * @example
 * // White background logo at large size
 * <BiensperienceLogo type="white" size="lg" />
 * 
 * @example
 * // Custom size with rotation
 * <BiensperienceLogo width={100} height={100} rotate={45} />
 * 
 * @example
 * // Loading indicator
 * <BiensperienceLogo type="engine" size="xl" />
 */
export default function BiensperienceLogo({ 
  type = 'clean',
  size,
  width,
  height,
  rotate,
  scale = 1,
  flipH = false,
  flipV = false,
  className = '',
  style = {},
  ...props
}) {
  // Size presets
  const sizeMap = {
    xs: 16,
    sm: 24,
    md: 32,
    lg: 48,
    xl: 64,
    '2xl': 96,
    '3xl': 128
  };

  // Determine dimensions
  const finalWidth = width || (size ? sizeMap[size] : sizeMap.md);
  const finalHeight = height || (size ? sizeMap[size] : sizeMap.md);

  // Build transform string
  const transforms = [];
  if (rotate) transforms.push(`rotate(${rotate}deg)`);
  if (scale !== 1) transforms.push(`scale(${scale})`);
  if (flipH) transforms.push('scaleX(-1)');
  if (flipV) transforms.push('scaleY(-1)');

  const transformStyle = transforms.length > 0 
    ? { transform: transforms.join(' ') } 
    : {};

  // Combine styles
  const combinedStyle = {
    width: `${finalWidth}px`,
    height: `${finalHeight}px`,
    display: 'inline-block',
    ...transformStyle,
    ...style
  };

  // Select logo component based on type
  const logoComponents = {
    clean: IconClean,
    flat: IconFlat,
    soft: IconSoft,
    white: IconWhite,
    engine: IconEngine
  };

  const LogoComponent = logoComponents[type] || logoComponents.clean;

  return (
    <LogoComponent 
      className={className}
      style={combinedStyle}
      aria-label="Biensperience Logo"
      {...props}
    />
  );
}

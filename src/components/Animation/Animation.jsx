import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import './Animation.css';

/**
 * Animation wrapper component for applying entrance animations
 *
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Content to animate
 * @param {string} props.type - Animation type: 'fade-in', 'slide-up', 'scale-in', 'slide-left', 'slide-right'
 * @param {string} props.duration - Animation duration: 'fast', 'normal', 'slow'
 * @param {string} props.delay - Animation delay: 'none', 'short', 'medium', 'long'
 * @param {string} props.easing - Animation easing: 'ease', 'ease-in', 'ease-out', 'ease-in-out'
 * @param {boolean} props.trigger - Whether animation should trigger (for controlled animations)
 * @param {boolean} props.once - Whether animation should only play once
 * @param {string} props.className - Additional CSS classes
 * @param {Object} props.style - Inline styles
 * @param {Object} props... - Other props passed to div element
 */
export default function Animation({
  children,
  type = 'fade-in',
  duration = 'normal',
  delay = 'none',
  easing = 'ease',
  trigger = true,
  once = true,
  className = '',
  style = {},
  ...props
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    if (trigger && (!once || !hasAnimated)) {
      const timer = setTimeout(() => {
        setIsVisible(true);
        setHasAnimated(true);
      }, getDelayMs(delay));

      return () => clearTimeout(timer);
    }
  }, [trigger, delay, once, hasAnimated]);

  // Build className string
  const classes = [
    'animation-wrapper',
    `animation-${type}`,
    `duration-${duration}`,
    `easing-${easing}`,
    isVisible && 'animation-active',
    className
  ].filter(Boolean).join(' ');

  return (
    <div
      className={classes}
      style={style}
      {...props}
    >
      {children}
    </div>
  );
}

Animation.propTypes = {
  children: PropTypes.node.isRequired,
  type: PropTypes.oneOf(['fade-in', 'slide-up', 'scale-in', 'slide-left', 'slide-right']),
  duration: PropTypes.oneOf(['fast', 'normal', 'slow']),
  delay: PropTypes.oneOfType([
    PropTypes.oneOf(['none', 'short', 'medium', 'long']),
    PropTypes.number
  ]),
  easing: PropTypes.oneOf(['ease', 'ease-in', 'ease-out', 'ease-in-out']),
  trigger: PropTypes.bool,
  once: PropTypes.bool,
  className: PropTypes.string,
  style: PropTypes.object
};

/**
 * FadeIn component for fade-in animations
 */
export function FadeIn({
  children,
  duration = 'normal',
  delay = 'none',
  trigger = true,
  once = true,
  className = '',
  style = {},
  ...props
}) {
  return (
    <Animation
      type="fade-in"
      duration={duration}
      delay={delay}
      trigger={trigger}
      once={once}
      className={className}
      style={style}
      {...props}
    >
      {children}
    </Animation>
  );
}

FadeIn.propTypes = {
  children: PropTypes.node.isRequired,
  duration: PropTypes.oneOf(['fast', 'normal', 'slow']),
  delay: PropTypes.oneOfType([
    PropTypes.oneOf(['none', 'short', 'medium', 'long']),
    PropTypes.number
  ]),
  trigger: PropTypes.bool,
  once: PropTypes.bool,
  className: PropTypes.string,
  style: PropTypes.object
};

/**
 * SlideUp component for slide-up animations
 */
export function SlideUp({
  children,
  duration = 'normal',
  delay = 'none',
  trigger = true,
  once = true,
  className = '',
  style = {},
  ...props
}) {
  return (
    <Animation
      type="slide-up"
      duration={duration}
      delay={delay}
      trigger={trigger}
      once={once}
      className={className}
      style={style}
      {...props}
    >
      {children}
    </Animation>
  );
}

SlideUp.propTypes = {
  children: PropTypes.node.isRequired,
  duration: PropTypes.oneOf(['fast', 'normal', 'slow']),
  delay: PropTypes.oneOfType([
    PropTypes.oneOf(['none', 'short', 'medium', 'long']),
    PropTypes.number
  ]),
  trigger: PropTypes.bool,
  once: PropTypes.bool,
  className: PropTypes.string,
  style: PropTypes.object
};

/**
 * ScaleIn component for scale-in animations
 */
export function ScaleIn({
  children,
  duration = 'normal',
  delay = 'none',
  trigger = true,
  once = true,
  className = '',
  style = {},
  ...props
}) {
  return (
    <Animation
      type="scale-in"
      duration={duration}
      delay={delay}
      trigger={trigger}
      once={once}
      className={className}
      style={style}
      {...props}
    >
      {children}
    </Animation>
  );
}

ScaleIn.propTypes = {
  children: PropTypes.node.isRequired,
  duration: PropTypes.oneOf(['fast', 'normal', 'slow']),
  delay: PropTypes.oneOfType([
    PropTypes.oneOf(['none', 'short', 'medium', 'long']),
    PropTypes.number
  ]),
  trigger: PropTypes.bool,
  once: PropTypes.bool,
  className: PropTypes.string,
  style: PropTypes.object
};

/**
 * Staggered animation component for animating children with delays
 */
export function Staggered({
  children,
  staggerDelay = 100,
  animationType = 'fade-in',
  duration = 'normal',
  className = '',
  style = {},
  ...props
}) {
  return (
    <div className={`staggered-container ${className}`} style={style} {...props}>
      {React.Children.map(children, (child, index) => (
        <Animation
          key={index}
          type={animationType}
          duration={duration}
          delay="none"
          trigger={true}
          once={true}
          style={{
            animationDelay: `${index * staggerDelay}ms`,
            ...child.props.style
          }}
        >
          {child}
        </Animation>
      ))}
    </div>
  );
}

Staggered.propTypes = {
  children: PropTypes.node.isRequired,
  staggerDelay: PropTypes.number,
  animationType: PropTypes.oneOf(['fade-in', 'slide-up', 'scale-in', 'slide-left', 'slide-right']),
  duration: PropTypes.oneOf(['fast', 'normal', 'slow']),
  className: PropTypes.string,
  style: PropTypes.object
};

// Helper function to convert delay string to milliseconds
function getDelayMs(delay) {
  // Accept numeric delays as either seconds (fractional) or milliseconds.
  if (typeof delay === 'number') {
    // Treat small numbers (< 10) as seconds, else as milliseconds
    if (Math.abs(delay) < 10) return Math.round(delay * 1000);
    return Math.round(delay);
  }

  switch (delay) {
    case 'short':
      return 200;
    case 'medium':
      return 400;
    case 'long':
      return 600;
    default:
      return 0;
  }
}
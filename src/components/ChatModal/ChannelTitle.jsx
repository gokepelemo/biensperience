import { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

import styles from './MessagesModal.module.scss';

// Channel title with hover marquee when truncated
export default function ChannelTitle({ label, className, innerClassName }) {
  const containerRef = useRef(null);
  const innerRef = useRef(null);
  const styleTagRef = useRef(null);

  useEffect(() => {
    return () => {
      if (styleTagRef.current) {
        try { styleTagRef.current.remove(); } catch (e) {}
        styleTagRef.current = null;
      }
    };
  }, []);

  const handleMouseEnter = () => {
    const container = containerRef.current;
    const inner = innerRef.current;
    if (!container || !inner) return;
    const scrollW = inner.scrollWidth;
    const clientW = container.clientWidth;
    if (scrollW <= clientW) return;

    const distance = scrollW - clientW;
    const speed = 40; // px per second
    const duration = Math.max(3, distance / speed * 2); // back-and-forth

    const name = `marquee_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const keyframes = `@keyframes ${name} { 0%{transform:translateX(0);} 45%{transform:translateX(-${distance}px);} 55%{transform:translateX(-${distance}px);} 100%{transform:translateX(0);} }`;

    const styleTag = document.createElement('style');
    styleTag.type = 'text/css';
    styleTag.id = name;
    styleTag.appendChild(document.createTextNode(keyframes));
    document.head.appendChild(styleTag);
    styleTagRef.current = styleTag;

    inner.style.animation = `${name} ${duration}s linear infinite`;
    inner.style.willChange = 'transform';
  };

  const handleMouseLeave = () => {
    if (styleTagRef.current) {
      try { styleTagRef.current.remove(); } catch (e) {}
      styleTagRef.current = null;
    }
    if (innerRef.current) {
      innerRef.current.style.animation = '';
      innerRef.current.style.willChange = '';
    }
  };

  return (
    <span
      ref={containerRef}
      className={className}
      onMouseEnter={handleMouseEnter}
      onFocus={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onBlur={handleMouseLeave}
      tabIndex={-1}
    >
      {/* Static clipped label (shows ellipsis) */}
      <span className={styles.channelTitleStatic} aria-hidden>{label}</span>
      {/* Animated label used for marquee; initially hidden and shown on hover */}
      <span
        ref={innerRef}
        className={`${innerClassName} ${styles.channelTitleAnimating}`}
        aria-hidden
      >
        {label}
      </span>
    </span>
  );
}

ChannelTitle.propTypes = {
  label: PropTypes.string.isRequired,
  className: PropTypes.string,
  innerClassName: PropTypes.string,
};

/**
 * FeaturedHeroLayout Component
 * Hero section with featured experience/destination.
 */

import React from 'react';
import PropTypes from 'prop-types';
import styles from './FeaturedHeroLayout.module.scss';

/**
 * FeaturedHeroLayout - Large hero section for featured content
 *
 * @param {Object} props
 * @param {string} props.backgroundImage - Hero background image URL
 * @param {string} props.title - Featured title
 * @param {string} props.subtitle - Secondary text (e.g., location)
 * @param {string} props.meta - Metadata text (e.g., "5 days · $500 est")
 * @param {React.ReactNode} props.actions - Action buttons (e.g., Plan It)
 * @param {React.ReactNode} props.badge - Badge/tag element
 * @param {'center'|'left'|'right'} props.contentPosition - Content alignment
 * @param {'sm'|'md'|'lg'|'xl'} props.height - Hero height variant
 * @param {boolean} props.overlay - Show dark overlay for text readability
 * @param {number} props.overlayOpacity - Overlay opacity (0-1)
 * @param {string} props.className - Additional CSS classes
 * @param {React.ReactNode} props.children - Additional content
 */
export default function FeaturedHeroLayout({
  backgroundImage,
  title,
  subtitle,
  meta,
  actions,
  badge,
  contentPosition = 'center',
  height = 'lg',
  overlay = true,
  overlayOpacity = 0.5,
  className = '',
  children,
}) {
  const containerClasses = [
    styles.featuredHero,
    styles[`position${contentPosition.charAt(0).toUpperCase() + contentPosition.slice(1)}`],
    styles[`height${height.charAt(0).toUpperCase() + height.slice(1)}`],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section
      className={containerClasses}
      style={{
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
      }}
    >
      {overlay && (
        <div
          className={styles.overlay}
          style={{ opacity: overlayOpacity }}
          aria-hidden="true"
        />
      )}

      <div className={styles.content}>
        {badge && <div className={styles.badge}>{badge}</div>}

        {title && <h1 className={styles.title}>{title}</h1>}

        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}

        {meta && <p className={styles.meta}>{meta}</p>}

        {actions && <div className={styles.actions}>{actions}</div>}

        {children}
      </div>
    </section>
  );
}

FeaturedHeroLayout.propTypes = {
  backgroundImage: PropTypes.string,
  title: PropTypes.string,
  subtitle: PropTypes.string,
  meta: PropTypes.string,
  actions: PropTypes.node,
  badge: PropTypes.node,
  contentPosition: PropTypes.oneOf(['center', 'left', 'right']),
  height: PropTypes.oneOf(['sm', 'md', 'lg', 'xl']),
  overlay: PropTypes.bool,
  overlayOpacity: PropTypes.number,
  className: PropTypes.string,
  children: PropTypes.node,
};

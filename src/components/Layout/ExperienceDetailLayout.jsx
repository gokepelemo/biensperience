/**
 * ExperienceDetailLayout Component
 * Full-page layout for experience details with hero, content, and sticky action bar.
 */

import React from 'react';
import PropTypes from 'prop-types';
import styles from './ExperienceDetailLayout.module.scss';
import { lang } from '../../lang.constants';

/**
 * Hero section for experience detail
 */
export function DetailHero({ image, title, subtitle, badge, backAction, shareAction, favoriteAction }) {
  return (
    <div className={styles.hero} style={image ? { backgroundImage: `url(${image})` } : undefined}>
      <div className={styles.heroOverlay} />
      <div className={styles.heroTopBar}>
        {backAction && (
          <button className={styles.heroAction} onClick={backAction} aria-label={lang.current.experienceDetailLayout.goBack}>
            ←
          </button>
        )}
        <div className={styles.heroTopActions}>
          {shareAction && (
            <button className={styles.heroAction} onClick={shareAction} aria-label={lang.current.experienceDetailLayout.share}>
              ↗
            </button>
          )}
          {favoriteAction && (
            <button className={styles.heroAction} onClick={favoriteAction} aria-label={lang.current.experienceDetailLayout.favorite}>
              ♡
            </button>
          )}
        </div>
      </div>
      <div className={styles.heroContent}>
        {badge && <span className={styles.heroBadge}>{badge}</span>}
        {title && <h1 className={styles.heroTitle}>{title}</h1>}
        {subtitle && <p className={styles.heroSubtitle}>{subtitle}</p>}
      </div>
    </div>
  );
}

DetailHero.propTypes = {
  image: PropTypes.string,
  title: PropTypes.string,
  subtitle: PropTypes.string,
  badge: PropTypes.node,
  backAction: PropTypes.func,
  shareAction: PropTypes.func,
  favoriteAction: PropTypes.func,
};

/**
 * Content section wrapper
 */
export function DetailSection({ title, children, action }) {
  return (
    <section className={styles.section}>
      {(title || action) && (
        <div className={styles.sectionHeader}>
          {title && <h2 className={styles.sectionTitle}>{title}</h2>}
          {action && <div className={styles.sectionAction}>{action}</div>}
        </div>
      )}
      <div className={styles.sectionContent}>{children}</div>
    </section>
  );
}

DetailSection.propTypes = {
  title: PropTypes.string,
  children: PropTypes.node,
  action: PropTypes.node,
};

/**
 * Metrics row for experience stats
 */
export function DetailMetrics({ metrics }) {
  if (!metrics?.length) return null;

  return (
    <div className={styles.metrics}>
      {metrics.map((metric, index) => (
        <div key={index} className={styles.metric}>
          {metric.icon && <span className={styles.metricIcon}>{metric.icon}</span>}
          <div className={styles.metricContent}>
            <span className={styles.metricValue}>{metric.value}</span>
            <span className={styles.metricLabel}>{metric.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

DetailMetrics.propTypes = {
  metrics: PropTypes.arrayOf(
    PropTypes.shape({
      icon: PropTypes.node,
      value: PropTypes.string,
      label: PropTypes.string,
    })
  ),
};

/**
 * Sticky action bar at bottom
 */
export function DetailActionBar({ price, priceLabel, primaryAction, secondaryAction }) {
  return (
    <div className={styles.actionBar}>
      <div className={styles.actionBarPrice}>
        {price && <span className={styles.price}>{price}</span>}
        {priceLabel && <span className={styles.priceLabel}>{priceLabel}</span>}
      </div>
      <div className={styles.actionBarButtons}>
        {secondaryAction && (
          <button className={styles.secondaryButton} onClick={secondaryAction.onClick}>
            {secondaryAction.label}
          </button>
        )}
        {primaryAction && (
          <button className={styles.primaryButton} onClick={primaryAction.onClick}>
            {primaryAction.label}
          </button>
        )}
      </div>
    </div>
  );
}

DetailActionBar.propTypes = {
  price: PropTypes.string,
  priceLabel: PropTypes.string,
  primaryAction: PropTypes.shape({
    label: PropTypes.string.isRequired,
    onClick: PropTypes.func,
  }),
  secondaryAction: PropTypes.shape({
    label: PropTypes.string.isRequired,
    onClick: PropTypes.func,
  }),
};

/**
 * ExperienceDetailLayout
 * Complete layout for experience detail pages
 */
export default function ExperienceDetailLayout({
  children,
  hero,
  actionBar,
  className,
}) {
  return (
    <div className={`${styles.detailLayout} ${className || ''}`}>
      {hero}
      <div className={styles.content}>{children}</div>
      {actionBar}
    </div>
  );
}

ExperienceDetailLayout.propTypes = {
  children: PropTypes.node,
  hero: PropTypes.node,
  actionBar: PropTypes.node,
  className: PropTypes.string,
};

// Export sub-components for compound pattern
ExperienceDetailLayout.Hero = DetailHero;
ExperienceDetailLayout.Section = DetailSection;
ExperienceDetailLayout.Metrics = DetailMetrics;
ExperienceDetailLayout.ActionBar = DetailActionBar;

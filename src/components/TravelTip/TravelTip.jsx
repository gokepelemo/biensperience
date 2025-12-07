import styles from "./TravelTip.module.scss";
import { useMemo } from 'react';
import {
  FaLanguage, FaMoneyBillWave, FaBus, FaShieldAlt,
  FaCloudSun, FaHandshake, FaUtensils, FaHotel,
  FaExclamationTriangle, FaThumbtack, FaLightbulb,
  FaExternalLinkAlt, FaTimes, FaComment
} from 'react-icons/fa';
import { Button, Pill } from '../design-system';
import EntitySchema from "../OpenGraph/EntitySchema";

// Emoji icons for colorful display
const TIP_EMOJIS = {
  Language: '🗣️',
  Currency: '💶',
  Transportation: '🚇',
  Safety: '🛡️',
  Weather: '🌤️',
  Customs: '🤝',
  Food: '🍽️',
  Accommodation: '🏨',
  Emergency: '🚨',
  Custom: '📌'
};

// Font Awesome icons for professional display
const TIP_FA_ICONS = {
  Language: FaLanguage,
  Currency: FaMoneyBillWave,
  Transportation: FaBus,
  Safety: FaShieldAlt,
  Weather: FaCloudSun,
  Customs: FaHandshake,
  Food: FaUtensils,
  Accommodation: FaHotel,
  Emergency: FaExclamationTriangle,
  Custom: FaThumbtack
};

const TIP_COLORS = {
  Language: 'info',
  Currency: 'success',
  Transportation: 'primary',
  Safety: 'warning',
  Weather: 'info',
  Customs: 'neutral',
  Food: 'danger',
  Accommodation: 'neutral',
  Emergency: 'danger',
  Custom: 'neutral'
};

export default function TravelTip({ tip, index, onDelete, editable = false, includeSchema = false }) {
  // Calculate dynamic font size based on text length for simple tips
  // Uses clamp() for fluid sizing that adapts to card dimensions and prevents overflow
  const getSimpleTipFontSize = useMemo(() => {
    if (typeof tip !== 'string') return null;

    const length = tip.length;

    // Very short tips (< 25 chars): Largest, bold statement
    if (length < 25) {
      return 'clamp(1.5rem, 5vw, 2.25rem)'; // 24px - 36px
    }
    // Short tips (25-50 chars): Large, impactful
    else if (length < 50) {
      return 'clamp(1.25rem, 4vw, 1.875rem)'; // 20px - 30px
    }
    // Medium tips (50-80 chars): Balanced readability
    else if (length < 80) {
      return 'clamp(1.125rem, 3.5vw, 1.5rem)'; // 18px - 24px
    }
    // Longer tips (80-120 chars): Comfortable reading
    else if (length < 120) {
      return 'clamp(1rem, 3vw, 1.25rem)'; // 16px - 20px
    }
    // Long tips (120-180 chars): Compact but readable
    else if (length < 180) {
      return 'clamp(0.9375rem, 2.5vw, 1.125rem)'; // 15px - 18px
    }
    // Very long tips (>180 chars): Minimum readable size
    else {
      return 'clamp(0.875rem, 2vw, 1rem)'; // 14px - 16px
    }
  }, [tip]);

  // Handle simple string tip
  if (typeof tip === 'string') {
    return (
      <>
        <div
          className={`${styles.travelTip} ${styles.travelTipSimple}`}
          key={index}
        >
          <div className={`${styles.travelTipIconWrapper} ${styles.simple}`}>
            <FaLightbulb className={styles.travelTipFaIcon} />
          </div>
          <div className={styles.travelTipContentSimple}>
            <span
              className={styles.travelTipText}
              style={{ fontSize: getSimpleTipFontSize }}
            >
              {tip}
            </span>
          </div>
          {editable && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete(index)}
              aria-label="Delete tip"
              className={styles.travelTipDelete}
            >
              <FaTimes />
            </Button>
          )}
        </div>
        {includeSchema && tip && (
          <EntitySchema entity={{ name: tip, description: tip, type: 'travel-tip' }} entityType="travel-tip" />
        )}
      </>
    );
  }

  // Handle structured tip
  const {
    type,
    category,
    value,
    note,
    exchangeRate,
    callToAction,
    icon,
    schema
  } = tip;

  const displayEmoji = icon || TIP_EMOJIS[type] || '📌';
  const FAIcon = TIP_FA_ICONS[type] || FaThumbtack;
  const displayCategory = category || type;
  const badgeColor = TIP_COLORS[type] || 'secondary';
  const gradientClass = styles[`travelTipIcon${type.charAt(0).toUpperCase() + type.slice(1).toLowerCase()}`];

  // Schema.org markup attributes
  const schemaProps = schema ? {
    itemScope: true,
    itemType: `https://schema.org/${schema.type}`,
    ...Object.entries(schema.properties || {}).reduce((acc, [key, val]) => {
      acc[`data-schema-${key}`] = val;
      return acc;
    }, {})
  } : {};

  return (
    <>
      <div
        className={`${styles.travelTip} ${styles.travelTipStructured} ${styles[`travelTip${type.charAt(0).toUpperCase() + type.slice(1).toLowerCase()}`]}`}
        {...schemaProps}
      >
        <div className={styles.travelTipHeader}>
          <div
            className={`${styles.travelTipIconWrapper} ${gradientClass}`}
            aria-hidden="true"
          >
            <div className={styles.travelTipEmoji}>{displayEmoji}</div>
            <FAIcon className={styles.travelTipFaIcon} />
          </div>
          <div className={styles.travelTipHeaderContent}>
            <Pill variant={badgeColor} size="sm" className={styles.travelTipBadge}>
              <FAIcon style={{ marginRight: 'var(--space-1)' }} size="0.8em" />
              {displayCategory}
            </Pill>
          </div>
          {editable && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete(index)}
              aria-label="Delete tip"
              className={styles.travelTipDelete}
              style={{ marginLeft: 'auto' }}
            >
              <FaTimes />
            </Button>
          )}
        </div>

        <div className={styles.travelTipContent}>
          <div className={styles.travelTipValue} itemProp="value">
            <strong>{value}</strong>
          </div>

          {note && (
            <div className={styles.travelTipNote} itemProp="description">
              <FaComment style={{ marginRight: 'var(--space-1)' }} /> {note}
            </div>
          )}

          {exchangeRate && type === 'Currency' && (
            <div className={styles.travelTipExchangeRate}>
              <small className="text-muted">
                <FaMoneyBillWave className="me-1" />
                {exchangeRate}
              </small>
            </div>
          )}

          {callToAction && callToAction.url && (
            <div className={styles.travelTipCta} style={{ marginTop: 'var(--space-2)' }}>
              <Button
                as="a"
                href={callToAction.url}
                target="_blank"
                rel="noopener noreferrer"
                size="sm"
                variant="outline"
                className={styles.travelTipCtaButton}
              >
                {callToAction.label || 'Learn More'}
                <FaExternalLinkAlt style={{ marginLeft: 'var(--space-1)' }} size="0.8em" />
              </Button>
            </div>
          )}
        </div>
      </div>
      {includeSchema && tip && (
        <EntitySchema entity={{ name: tip.value || tip.note, description: tip.note, type: 'travel-tip', category: tip.type }} entityType="travel-tip" />
      )}
    </>
  );
}

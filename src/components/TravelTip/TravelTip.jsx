import styles from "./TravelTip.module.scss";
import { useMemo } from 'react';
import {
  FaLanguage, FaMoneyBillWave, FaBus, FaShieldAlt,
  FaCloudSun, FaHandshake, FaUtensils, FaHotel,
  FaExclamationTriangle, FaThumbtack, FaLightbulb,
  FaExternalLinkAlt, FaTimes
} from 'react-icons/fa';
import { Button, Pill, Text } from '../design-system';
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
  const getSimpleTipFontSize = useMemo(() => {
    if (typeof tip !== 'string') return null;

    const length = tip.length;

    // Very short tips (< 30 chars): Largest font to fill space
    if (length < 30) {
      return 'clamp(1.75rem, 4vw, 2.25rem)'; // 28px - 36px
    }
    // Short tips (30-60 chars): Large font
    else if (length < 60) {
      return 'clamp(1.25rem, 3vw, 1.75rem)'; // 20px - 28px
    }
    // Medium tips (60-100 chars): Medium font
    else if (length < 100) {
      return 'clamp(1rem, 2.25vw, 1.25rem)'; // 16px - 20px
    }
    // Long tips (100-150 chars): Smaller font
    else if (length < 150) {
      return 'clamp(0.875rem, 1.75vw, 1rem)'; // 14px - 16px
    }
    // Very long tips (>150 chars): Smallest font
    else {
      return 'clamp(0.75rem, 1.25vw, 0.875rem)'; // 12px - 14px
    }
  }, [tip]);

  // Handle simple string tip
  if (typeof tip === 'string') {
    return (
      <>
        <div className={`${styles.travelTip} ${styles.travelTipSimple}`} key={index}>
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
            💬 {note}
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

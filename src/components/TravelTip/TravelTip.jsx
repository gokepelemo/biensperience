import "./TravelTip.css";
import { Badge, Button } from 'react-bootstrap';
import { useMemo } from 'react';
import {
  FaLanguage, FaMoneyBillWave, FaBus, FaShieldAlt,
  FaCloudSun, FaHandshake, FaUtensils, FaHotel,
  FaExclamationTriangle, FaThumbtack, FaLightbulb,
  FaExternalLinkAlt, FaTimes
} from 'react-icons/fa';

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
  Customs: 'secondary',
  Food: 'danger',
  Accommodation: 'dark',
  Emergency: 'danger',
  Custom: 'secondary'
};

// Gradient backgrounds for each tip type
const TIP_GRADIENTS = {
  Language: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  Currency: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  Transportation: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  Safety: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  Weather: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
  Customs: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
  Food: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
  Accommodation: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
  Emergency: 'linear-gradient(135deg, #ff6a00 0%, #ee0979 100%)',
  Custom: 'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)'
};

export default function TravelTip({ tip, index, onDelete, editable = false }) {
  // Calculate dynamic font size based on text length for simple tips
  const getSimpleTipFontSize = useMemo(() => {
    if (typeof tip !== 'string') return null;

    const length = tip.length;

    // Short tips (< 50 chars): Larger font
    if (length < 50) {
      return 'clamp(1.125rem, 2vw, 1.375rem)'; // 18px - 22px
    }
    // Medium tips (50-100 chars): Medium font
    else if (length < 100) {
      return 'clamp(1rem, 1.75vw, 1.25rem)'; // 16px - 20px
    }
    // Long tips (100-150 chars): Standard font
    else if (length < 150) {
      return 'clamp(0.9375rem, 1.5vw, 1.125rem)'; // 15px - 18px
    }
    // Very long tips (>150 chars): Smaller font
    else {
      return 'clamp(0.875rem, 1.25vw, 1rem)'; // 14px - 16px
    }
  }, [tip]);

  // Handle simple string tip
  if (typeof tip === 'string') {
    return (
      <div className="travel-tip travel-tip-simple" key={index}>
        <div className="travel-tip-icon-wrapper simple">
          <FaLightbulb className="travel-tip-fa-icon" />
        </div>
        <div className="travel-tip-content-simple">
          <span
            className="travel-tip-text"
            style={{ fontSize: getSimpleTipFontSize }}
          >
            {tip}
          </span>
        </div>
        {editable && (
          <button
            type="button"
            className="btn btn-sm btn-outline-danger travel-tip-delete"
            onClick={() => onDelete(index)}
            aria-label="Delete tip"
          >
            <FaTimes />
          </button>
        )}
      </div>
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
  const gradient = TIP_GRADIENTS[type] || TIP_GRADIENTS.Custom;

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
    <div
      className={`travel-tip travel-tip-structured travel-tip-${type.toLowerCase()}`}
      {...schemaProps}
    >
      <div className="travel-tip-header">
        <div
          className="travel-tip-icon-wrapper"
          style={{ background: gradient }}
          aria-hidden="true"
        >
          <div className="travel-tip-emoji">{displayEmoji}</div>
          <FAIcon className="travel-tip-fa-icon" />
        </div>
        <div className="travel-tip-header-content">
          <Badge bg={badgeColor} className="travel-tip-badge">
            <FAIcon className="me-1" size="0.8em" />
            {displayCategory}
          </Badge>
        </div>
        {editable && (
          <button
            type="button"
            className="btn btn-sm btn-outline-danger travel-tip-delete ms-auto"
            onClick={() => onDelete(index)}
            aria-label="Delete tip"
          >
            <FaTimes />
          </button>
        )}
      </div>

      <div className="travel-tip-content">
        <div className="travel-tip-value" itemProp="value">
          <strong>{value}</strong>
        </div>

        {note && (
          <div className="travel-tip-note" itemProp="description">
            💬 {note}
          </div>
        )}

        {exchangeRate && type === 'Currency' && (
          <div className="travel-tip-exchange-rate">
            <small className="text-muted">
              <FaMoneyBillWave className="me-1" />
              {exchangeRate}
            </small>
          </div>
        )}

        {callToAction && callToAction.url && (
          <div className="travel-tip-cta mt-2">
            <Button
              href={callToAction.url}
              target="_blank"
              rel="noopener noreferrer"
              size="sm"
              variant="outline-primary"
              className="travel-tip-cta-button"
            >
              {callToAction.label || 'Learn More'}
              <FaExternalLinkAlt className="ms-1" size="0.8em" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

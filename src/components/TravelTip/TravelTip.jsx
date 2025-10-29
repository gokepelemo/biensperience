import "./TravelTip.css";
import { Badge, Button } from 'react-bootstrap';

const TIP_ICONS = {
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

export default function TravelTip({ tip, index, onDelete, editable = false }) {
  // Handle simple string tip
  if (typeof tip === 'string') {
    return (
      <div className="travel-tip travel-tip-simple" key={index}>
        <div className="travel-tip-content-simple">
          <span className="travel-tip-icon">💡</span>
          <span className="travel-tip-text">{tip}</span>
        </div>
        {editable && (
          <button
            type="button"
            className="btn btn-sm btn-danger travel-tip-delete"
            onClick={() => onDelete(index)}
            aria-label="Delete tip"
          >
            ×
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

  const displayIcon = icon || TIP_ICONS[type] || '📌';
  const displayCategory = category || type;
  const badgeColor = TIP_COLORS[type] || 'secondary';

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
        <span className="travel-tip-icon" aria-hidden="true">{displayIcon}</span>
        <Badge bg={badgeColor} className="travel-tip-badge">
          {displayCategory}
        </Badge>
        {editable && (
          <button
            type="button"
            className="btn btn-sm btn-danger travel-tip-delete ms-auto"
            onClick={() => onDelete(index)}
            aria-label="Delete tip"
          >
            ×
          </button>
        )}
      </div>

      <div className="travel-tip-content">
        <div className="travel-tip-value" itemProp="value">
          <strong>{value}</strong>
        </div>

        {note && (
          <div className="travel-tip-note" itemProp="description">
            {note}
          </div>
        )}

        {exchangeRate && type === 'Currency' && (
          <div className="travel-tip-exchange-rate">
            <small className="text-muted">{exchangeRate}</small>
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
              {callToAction.label || 'Learn More'} →
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

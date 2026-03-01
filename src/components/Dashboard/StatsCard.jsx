import React from 'react';
import { Card } from '../design-system';
import PropTypes from 'prop-types';
import InfoTooltip from '../InfoTooltip/InfoTooltip';

/**
 * StatsCard component for displaying dashboard statistics
 * Reusable component for stats like Active Plans, Experiences, etc.
 * Now uses CSS Grid layout (no Col wrapper needed)
 */
export default function StatsCard({ label, value, color, icon, tooltip, subMetrics }) {
  return (
    <Card
      style={{
        backgroundColor: 'var(--color-bg-primary)',
        border: '1px solid var(--color-border-light)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-6)',
        height: '100%',
      }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
      }}>
        <div>
          <div style={{
            fontSize: 'var(--font-size-3xl)',
            fontWeight: 'var(--font-weight-bold)',
            color: 'var(--color-text-primary)',
            marginBottom: 'var(--space-1)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}>
            {value}
            {tooltip && (
              <InfoTooltip
                content={tooltip}
                ariaLabel={`More info about ${label}`}
              />
            )}
          </div>
          <div style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-muted)',
            marginBottom: subMetrics ? 'var(--space-3)' : undefined,
          }}>
            {label}
          </div>
          {subMetrics && subMetrics.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {subMetrics.map((metric, i) => (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  fontSize: 'var(--font-size-xs)',
                  color: metric.color || 'var(--color-text-secondary)',
                }}>
                  {metric.icon}
                  <span>{metric.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: 'var(--radius-lg)',
          backgroundColor: `${color}20`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 'var(--font-size-xl)',
          color: color,
        }}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

StatsCard.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  color: PropTypes.string.isRequired,
  icon: PropTypes.element.isRequired,
  tooltip: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  subMetrics: PropTypes.arrayOf(PropTypes.shape({
    icon: PropTypes.element,
    label: PropTypes.string.isRequired,
    color: PropTypes.string,
  })),
};
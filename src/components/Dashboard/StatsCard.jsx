import React from 'react';
import { Card, Col } from 'react-bootstrap';
import PropTypes from 'prop-types';

/**
 * StatsCard component for displaying dashboard statistics
 * Reusable component for stats like Active Plans, Experiences, etc.
 */
export default function StatsCard({ label, value, color, icon }) {
  return (
    <Col md={6} lg={3} style={{ marginBottom: 'var(--space-4)' }}>
      <Card style={{
        backgroundColor: 'var(--color-bg-primary)',
        border: '1px solid var(--color-border-light)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-6)',
        height: '100%',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 'var(--space-4)',
        }}>
          <div>
            <div style={{
              fontSize: 'var(--font-size-3xl)',
              fontWeight: 'var(--font-weight-bold)',
              color: 'var(--color-text-primary)',
              marginBottom: 'var(--space-1)',
            }}>
              {value}
            </div>
            <div style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-muted)',
            }}>
              {label}
            </div>
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
    </Col>
  );
}

StatsCard.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  color: PropTypes.string.isRequired,
  icon: PropTypes.element.isRequired,
};
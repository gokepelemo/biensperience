import React from 'react';
import { Card, Button } from 'react-bootstrap';
import { FaClock, FaStar } from 'react-icons/fa';
import PropTypes from 'prop-types';
import { Heading } from '../design-system';

/**
 * ActivityList component for displaying recent user activities
 * Shows a list of recent actions with timestamps
 */
export default function ActivityList({ activities, title = "Recent Activity" }) {
  return (
    <Card style={{
      backgroundColor: 'var(--color-bg-primary)',
      border: '1px solid var(--color-border-light)',
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-6)',
    }}>
      <Heading level={3} style={{
        fontSize: 'var(--font-size-xl)',
        fontWeight: 'var(--font-weight-semibold)',
        color: 'var(--color-text-primary)',
        marginBottom: 'var(--space-6)',
      }}>
        {title}
      </Heading>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {activities.length > 0 ? activities.map((activity) => (
          <div
            key={activity.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: 'var(--space-4)',
              backgroundColor: 'var(--color-bg-secondary)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <div>
              <div style={{
                fontSize: 'var(--font-size-base)',
                color: 'var(--color-text-primary)',
                marginBottom: 'var(--space-1)',
              }}>
                {activity.action} <strong>{activity.item}</strong>
              </div>
              <div style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-muted)',
              }}>
                <FaClock style={{ marginRight: 'var(--space-1)' }} />
                {activity.time}
              </div>
            </div>
            <Button variant="outline-secondary" size="sm" style={{
              borderRadius: 'var(--radius-md)',
            }}>
              View
            </Button>
          </div>
        )) : (
          <div style={{
            textAlign: 'center',
            padding: 'var(--space-8)',
            color: 'var(--color-text-muted)',
          }}>
            <FaStar size={32} style={{ marginBottom: 'var(--space-2)', opacity: 0.5 }} />
            <div>No recent activity</div>
          </div>
        )}
      </div>
    </Card>
  );
}

ActivityList.propTypes = {
  activities: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    action: PropTypes.string.isRequired,
    item: PropTypes.string.isRequired,
    time: PropTypes.string.isRequired,
  })).isRequired,
  title: PropTypes.string,
};
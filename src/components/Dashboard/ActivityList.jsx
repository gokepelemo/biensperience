import React from 'react';
import { Card, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { FaClock, FaStar, FaExternalLinkAlt } from 'react-icons/fa';
import PropTypes from 'prop-types';
import { Heading } from '../design-system';

/**
 * ActivityList component for displaying recent user activities
 * Shows a list of recent actions with timestamps and clickable links to entities
 */
export default function ActivityList({ activities, title = "Recent Activity" }) {
  /**
   * Render the activity description with proper formatting and links
   */
  const renderActivityDescription = (activity) => {
    const { action, item, targetItem, link } = activity;

    // For plan item completions, show "Completed {item_name} in Plan for {experience_name}"
    if (targetItem) {
      return (
        <>
          {action} <strong>{targetItem}</strong> in Plan for{' '}
          {link ? (
            <Link to={link} style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>
              {item}
            </Link>
          ) : (
            <strong>{item}</strong>
          )}
        </>
      );
    }

    // For other activities, show "Action {entity_name}"
    return (
      <>
        {action}{' '}
        {link ? (
          <Link to={link} style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>
            {item}
          </Link>
        ) : (
          <strong>{item}</strong>
        )}
      </>
    );
  };

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
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 'var(--font-size-base)',
                color: 'var(--color-text-primary)',
                marginBottom: 'var(--space-1)',
              }}>
                {renderActivityDescription(activity)}
              </div>
              <div style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-muted)',
              }}>
                <FaClock style={{ marginRight: 'var(--space-1)' }} />
                {activity.time}
              </div>
            </div>
            {activity.link && (
              <Button
                as={Link}
                to={activity.link}
                variant="outline-secondary"
                size="sm"
                style={{
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                }}
              >
                View <FaExternalLinkAlt size={12} />
              </Button>
            )}
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
    targetItem: PropTypes.string, // For plan item completions
    link: PropTypes.string, // Link to the resource
    time: PropTypes.string.isRequired,
    timestamp: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
    resourceType: PropTypes.string,
  })).isRequired,
  title: PropTypes.string,
};
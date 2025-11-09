import React from 'react';
import { Card } from 'react-bootstrap';
import { FaCalendar } from 'react-icons/fa';
import PropTypes from 'prop-types';
import { Heading } from '../design-system';

/**
 * UpcomingPlans component for displaying user's upcoming travel plans
 * Shows a list of plans with dates
 */
export default function UpcomingPlans({ plans, title = "Upcoming Plans" }) {
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
        {plans.length > 0 ? plans.map((plan) => (
          <div
            key={plan.id}
            style={{
              padding: 'var(--space-3)',
              backgroundColor: 'var(--color-bg-secondary)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <div style={{
              fontSize: 'var(--font-size-base)',
              fontWeight: 'var(--font-weight-medium)',
              color: 'var(--color-text-primary)',
              marginBottom: 'var(--space-1)',
            }}>
              {plan.title}
            </div>
            <div style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-muted)',
            }}>
              <FaCalendar style={{ marginRight: 'var(--space-1)' }} />
              {plan.date}
            </div>
          </div>
        )) : (
          <div style={{
            textAlign: 'center',
            padding: 'var(--space-4)',
            color: 'var(--color-text-muted)',
          }}>
            <FaCalendar size={24} style={{ marginBottom: 'var(--space-2)', opacity: 0.5 }} />
            <div>No upcoming plans</div>
          </div>
        )}
      </div>
    </Card>
  );
}

UpcomingPlans.propTypes = {
  plans: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    date: PropTypes.string,
  })).isRequired,
  title: PropTypes.string,
};
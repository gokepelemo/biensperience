import React from 'react';
import { Card, Col } from 'react-bootstrap';
import PropTypes from 'prop-types';
import { FaCalendar, FaUser, FaUsers, FaCheckCircle } from 'react-icons/fa';

/**
 * ActivePlansCard component for displaying detailed active plans metrics
 * Shows total plans, owned plans, shared plans, and completion status
 */
export default function ActivePlansCard({ stats = {}, loading = false }) {
  // No debug logging in production UI

  if (loading) {
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
                --
              </div>
              <div style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-muted)',
              }}>
                Active Plans
              </div>
            </div>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: 'var(--color-primary-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 'var(--font-size-xl)',
              color: 'var(--color-primary)',
            }}>
              <FaCalendar />
            </div>
          </div>
        </Card>
      </Col>
    );
  }

  const {
    totalPlans = 0,
    ownedPlans = 0,
    sharedPlans = 0,
    completedPlans = 0
  } = stats.activePlansDetails || {};

  // Values are displayed in the UI; keep logs out of the browser console.

  return (
    <Col md={6} lg={3} style={{ marginBottom: 'var(--space-4)' }}>
      <Card style={{
        backgroundColor: 'var(--color-bg-primary)',
        border: '1px solid var(--color-border-light)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-6)',
        height: '100%',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
      >
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
              {totalPlans}
            </div>
            <div style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-muted)',
              marginBottom: 'var(--space-3)',
            }}>
              Active Plans
            </div>

            {/* Plan breakdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-text-secondary)',
              }}>
                <FaUser size={12} />
                <span>{ownedPlans} owned</span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-text-secondary)',
              }}>
                <FaUsers size={12} />
                <span>{sharedPlans} shared</span>
              </div>
              {completedPlans > 0 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-success)',
                }}>
                  <FaCheckCircle size={12} />
                  <span>{completedPlans} completed</span>
                </div>
              )}
            </div>
          </div>

          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--color-primary-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 'var(--font-size-xl)',
            color: 'var(--color-primary)',
          }}>
            <FaCalendar />
          </div>
        </div>
      </Card>
    </Col>
  );
}

ActivePlansCard.propTypes = {
  stats: PropTypes.shape({
    activePlansDetails: PropTypes.shape({
      totalPlans: PropTypes.number,
      ownedPlans: PropTypes.number,
      sharedPlans: PropTypes.number,
      completedPlans: PropTypes.number,
    }),
  }),
  loading: PropTypes.bool,
};

// defaultProps removed: using JS default parameters for function components
import React from 'react';
import { Card, Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { Heading } from '../design-system';
import { useExperienceWizard } from '../../contexts/ExperienceWizardContext';
import { lang } from '../../lang.constants';

/**
 * QuickActions component for displaying common user actions
 * Shows buttons for frequently used features
 */
export default function QuickActions({
  actions = [],
  title = "Quick Actions"
}) {
  const navigate = useNavigate();
  const { openExperienceWizard } = useExperienceWizard();

  const defaultActions = [
    { label: lang.current.button.createNewExperience, variant: 'primary', onClick: () => openExperienceWizard() },
    { label: lang.current.button.addDestination, variant: 'outline-secondary', onClick: () => navigate('/destinations/new') },
    { label: lang.current.button.browseExperiences, variant: 'outline-secondary', onClick: () => navigate('/experiences') },
  ];

  const actionsToShow = actions.length > 0 ? actions : defaultActions;

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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {actionsToShow.map((action, index) => (
          <Button
            key={index}
            variant={action.variant || 'outline-secondary'}
            style={{
              borderRadius: 'var(--radius-md)',
              fontWeight: 'var(--font-weight-medium)',
            }}
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        ))}
      </div>
    </Card>
  );
}

QuickActions.propTypes = {
  actions: PropTypes.arrayOf(PropTypes.shape({
    label: PropTypes.string.isRequired,
    variant: PropTypes.string,
    onClick: PropTypes.func,
  })),
  title: PropTypes.string,
};
/**
 * BaseStepper – Native Chakra UI v3 Steps
 *
 * Drop-in replacement for the custom CSS-module Stepper component.
 * Maps the existing `steps` array API to Chakra's Steps primitives.
 *
 * Props:
 *   steps   : Array<{ title, description?, status: 'completed'|'active'|'pending'|'error' }>
 *   variant : 'default' (shows title + description) | 'compact' (title only)
 *   color   : 'primary' | 'success' | 'danger' | 'warning'
 *
 * The Chakra Steps component is driven by a single `step` index (the current
 * active step). This component derives that index from the first step with
 * status 'active'. Steps before it are treated as completed; steps after as
 * incomplete. Error steps show a custom indicator icon.
 *
 * Migrated: biensperience-049a
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Box, Steps } from '@chakra-ui/react';

const COLOR_PALETTE_MAP = {
  primary: 'brand',
  success: 'green',
  warning: 'yellow',
  danger: 'red',
};

/** SVG check icon used for completed steps */
const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <path
      d="M13.5 4.5L6 12L2.5 8.5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/** SVG X icon used for error steps */
const ErrorIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <path
      d="M12 4L4 12M4 4L12 12"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

export default function BaseStepper({ steps = [], variant = 'default', color = 'primary' }) {
  const colorPalette = COLOR_PALETTE_MAP[color] || color || 'brand';

  // Derive the current step index from the first 'active' step.
  // If none is active, set to the count of completed steps (all done or none started).
  const activeIndex = steps.findIndex((s) => s.status === 'active');
  const completedCount = steps.filter((s) => s.status === 'completed').length;
  const currentStep = activeIndex >= 0 ? activeIndex : completedCount;

  return (
    <Steps.Root
      step={currentStep}
      count={steps.length}
      colorPalette={colorPalette}
    >
      <Steps.List>
        {steps.map((step, index) => {
          const isError = step.status === 'error';

          return (
            <Steps.Item key={index} index={index}>
              <Steps.Indicator>
                <Steps.Status
                  complete={<CheckIcon />}
                  current={isError ? <ErrorIcon /> : <Steps.Number />}
                  incomplete={isError ? <ErrorIcon /> : <Steps.Number />}
                />
              </Steps.Indicator>

              {variant !== 'compact' && (
                <Box>
                  <Steps.Title>{step.title}</Steps.Title>
                  {step.description && (
                    <Steps.Description>{step.description}</Steps.Description>
                  )}
                </Box>
              )}

              {index < steps.length - 1 && <Steps.Separator />}
            </Steps.Item>
          );
        })}
      </Steps.List>
    </Steps.Root>
  );
}

BaseStepper.propTypes = {
  /** Step definitions */
  steps: PropTypes.arrayOf(
    PropTypes.shape({
      title: PropTypes.string.isRequired,
      description: PropTypes.string,
      /** 'completed' | 'active' | 'pending' | 'error' */
      status: PropTypes.oneOf(['completed', 'active', 'pending', 'error']).isRequired,
    }),
  ).isRequired,
  /** 'default' shows title + description; 'compact' shows title only */
  variant: PropTypes.oneOf(['default', 'compact']),
  /** Color palette: 'primary' | 'success' | 'danger' | 'warning' */
  color: PropTypes.oneOf(['primary', 'success', 'danger', 'warning']),
};

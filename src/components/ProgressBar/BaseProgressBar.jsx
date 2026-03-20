/**
 * BaseProgressBar – Native Chakra UI v3 Progress
 *
 * Uses the `progress` slotRecipe from ui-theme.js for all visual styling.
 * No CSS Module import — colorPalette, size, striped, animated variant
 * props drive the recipe directly.
 *
 * Chakra v3 Progress compound: Progress.Root / Track / Range / ValueText
 *
 * Migrated: P2.9 — biensperience-feb1
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Flex, Progress, Text } from '@chakra-ui/react';

const COLOR_PALETTE_MAP = {
  primary: 'brand',
  success: 'green',
  danger: 'red',
  warning: 'yellow',
};

export default function BaseProgressBar({
  value,
  color = 'primary',
  size = 'md',
  showPercentage = false,
  animated = false,
  label = null,
  secondaryLabel = null,
}) {
  const clamped = Math.min(100, Math.max(0, value));
  const palette = COLOR_PALETTE_MAP[color] || color;

  /* Map our size names to the recipe's size tokens (sm→sm, md→md, lg→lg) */
  const SIZE_MAP = { sm: 'sm', md: 'md', lg: 'lg' };
  const recipeSize = SIZE_MAP[size] || 'md';

  const hasLabel = label || secondaryLabel;

  return (
    <Progress.Root
      value={clamped}
      max={100}
      min={0}
      size={recipeSize}
      colorPalette={palette}
      striped={animated}
      animated={animated}
      width="100%"
    >
      {hasLabel && (
        <Flex justify="space-between" mb="1">
          {label && (
            <Progress.Label>
              <Text fontSize="xs" fontWeight="semibold" color="fg.muted" truncate>
                {label}
              </Text>
            </Progress.Label>
          )}
          {secondaryLabel && (
            <Text fontSize="xs" color="fg.muted" flexShrink={0}>
              {secondaryLabel}
            </Text>
          )}
        </Flex>
      )}

      <Flex align="center" gap="3" width="100%">
        <Progress.Track flex="1">
          <Progress.Range />
        </Progress.Track>

        {showPercentage && (
          <Progress.ValueText fontSize="sm" fontWeight="semibold" minW="45px" textAlign="end" />
        )}
      </Flex>
    </Progress.Root>
  );
}

BaseProgressBar.propTypes = {
  value: PropTypes.number.isRequired,
  color: PropTypes.oneOf(['primary', 'success', 'danger', 'warning']),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  showPercentage: PropTypes.bool,
  animated: PropTypes.bool,
  /** Optional label displayed above the track (e.g. filename) */
  label: PropTypes.node,
  /** Optional secondary label displayed on the right above the track (e.g. "2 MB / 10 MB") */
  secondaryLabel: PropTypes.node,
};

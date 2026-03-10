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
}) {
  const clamped = Math.min(100, Math.max(0, value));
  const palette = COLOR_PALETTE_MAP[color] || color;

  /* Map our size names to the recipe's size tokens (sm→sm, md→md, lg→lg) */
  const SIZE_MAP = { sm: 'sm', md: 'md', lg: 'lg' };
  const recipeSize = SIZE_MAP[size] || 'md';

  return (
    <Flex align="center" gap="3" width="100%">
      <Progress.Root
        value={clamped}
        max={100}
        min={0}
        size={recipeSize}
        colorPalette={palette}
        striped={animated}
        animated={animated}
        flex="1"
      >
        <Progress.Track>
          <Progress.Range />
        </Progress.Track>
      </Progress.Root>

      {showPercentage && (
        <Text fontSize="sm" fontWeight="semibold" minW="45px" textAlign="end">
          {clamped}%
        </Text>
      )}
    </Flex>
  );
}

BaseProgressBar.propTypes = {
  value: PropTypes.number.isRequired,
  color: PropTypes.oneOf(['primary', 'success', 'danger', 'warning']),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  showPercentage: PropTypes.bool,
  animated: PropTypes.bool,
};

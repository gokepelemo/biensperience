/**
 * Text Abstraction Layer
 *
 * This module provides stable APIs for Text component usage across the application.
 * It wraps either the current custom Text components or the Chakra UI Text implementations,
 * controlled by the 'chakra_ui' feature flag.
 *
 * CRITICAL: This abstraction enables zero-regression migration between implementations.
 * All text consumers should import from design-system, NOT directly from Text.
 *
 * Implementation Status:
 * - Phase 1: Custom Text with CSS Modules (completed)
 * - Phase 2: Feature-flagged Chakra UI (completed) Text
 * - Phase 3: Chakra UI Text validation (completed)
 * - Phase 4 (Current): Chakra UI Text is default; legacy available via 'bootstrap_text' flag
 * - Phase 5: Remove legacy implementation (after validation period)
 *
 * API Stability Guarantee:
 * - Props interface is stable and will not change
 * - All consumers can import { Text, Heading, Paragraph } from 'design-system'
 * - Implementation swap is transparent to consumers
 *
 * Task: biensperience-445f
 * Related: biensperience-8ade (Phase 3), biensperience-6ba4 (umbrella)
 */

import PropTypes from 'prop-types';
import Text, { Heading, Paragraph } from '../Text/Text';
import ChakraText, { ChakraHeading, ChakraParagraph } from '../Text/ChakraText';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';

/**
 * TextWrapper - Design System Abstraction for Text
 *
 * Uses Chakra UI v3 Text implementation when 'chakra_ui' feature flag
 * is enabled, otherwise falls back to the custom CSS Modules Text.
 */
export function TextWrapper(props) {
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_text');
  const TextComponent = useLegacy ? Text : ChakraText;
  return <TextComponent {...props} />;
}

TextWrapper.displayName = 'Text';

TextWrapper.propTypes = {
  children: PropTypes.node.isRequired,
  as: PropTypes.oneOf(['p', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']),
  variant: PropTypes.oneOf(['body', 'lead', 'caption', 'gradient', 'muted', 'heading']),
  size: PropTypes.oneOf(['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', 'heading-1', 'heading-2', 'heading-3', 'heading-4', 'heading-5', 'heading-6']),
  weight: PropTypes.oneOf(['light', 'normal', 'medium', 'semibold', 'bold']),
  gradient: PropTypes.bool,
  shadow: PropTypes.bool,
  truncate: PropTypes.oneOf([0, 1, 2, 3]),
  align: PropTypes.oneOf(['left', 'center', 'right', 'justify']),
  color: PropTypes.string,
  className: PropTypes.string,
  style: PropTypes.object
};

/**
 * HeadingWrapper - Design System Abstraction for Heading
 */
export function HeadingWrapper(props) {
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_text');
  const Component = useLegacy ? Heading : ChakraHeading;
  return <Component {...props} />;
}

HeadingWrapper.displayName = 'Heading';

HeadingWrapper.propTypes = {
  children: PropTypes.node.isRequired,
  level: PropTypes.oneOf([1, 2, 3, 4, 5, 6]),
  variant: PropTypes.oneOf(['body', 'lead', 'caption', 'gradient', 'muted', 'heading']),
  size: PropTypes.oneOf(['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', 'heading-1', 'heading-2', 'heading-3', 'heading-4', 'heading-5', 'heading-6']),
  weight: PropTypes.oneOf(['light', 'normal', 'medium', 'semibold', 'bold']),
  gradient: PropTypes.bool,
  shadow: PropTypes.bool,
  align: PropTypes.oneOf(['left', 'center', 'right', 'justify']),
  className: PropTypes.string,
  style: PropTypes.object
};

/**
 * ParagraphWrapper - Design System Abstraction for Paragraph
 */
export function ParagraphWrapper(props) {
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_text');
  const Component = useLegacy ? Paragraph : ChakraParagraph;
  return <Component {...props} />;
}

ParagraphWrapper.displayName = 'Paragraph';

ParagraphWrapper.propTypes = {
  children: PropTypes.node.isRequired,
  variant: PropTypes.oneOf(['body', 'lead', 'caption', 'gradient', 'muted']),
  size: PropTypes.oneOf(['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl']),
  weight: PropTypes.oneOf(['light', 'normal', 'medium', 'semibold', 'bold']),
  gradient: PropTypes.bool,
  shadow: PropTypes.bool,
  truncate: PropTypes.oneOf([0, 1, 2, 3]),
  align: PropTypes.oneOf(['left', 'center', 'right', 'justify']),
  className: PropTypes.string,
  style: PropTypes.object
};

// Default export for Text
export default TextWrapper;

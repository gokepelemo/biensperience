/**
 * Card Abstraction Layer
 *
 * Provides a stable API for Card usage across the application.
 * Wraps either the react-bootstrap Card or the modern BaseCard (Chakra),
 * controlled by the 'bootstrap_card' feature flag.
 *
 * CRITICAL: This abstraction enables zero-regression migration between implementations.
 * All card consumers should import from design-system, NOT directly from react-bootstrap.
 *
 * Implementation Status:
 * - Phase 4 (Current): modern Card is default; legacy available via 'bootstrap_card' flag
 * - Phase 5: Remove legacy implementation (after validation period)
 *
 * Task: biensperience-9abe
 * Related: biensperience-e5c4 (epic)
 */

import PropTypes from 'prop-types';
import { Card as RBCard } from 'react-bootstrap';
import BaseCard, {
  BaseCardHeader,
  BaseCardBody,
  BaseCardFooter,
  BaseCardTitle,
  BaseCardDescription
} from '../Card/BaseCard';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';

/**
 * CardWrapper - Design System Abstraction for Card
 *
 * Uses modern Card (Chakra) implementation by default.
 * Legacy react-bootstrap Card available via feature flag.
 */
export function CardWrapper(props) {
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_card');
  const CardComponent = useLegacy ? RBCard : BaseCard;
  return <CardComponent {...props} />;
}

CardWrapper.displayName = 'Card';

CardWrapper.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
  style: PropTypes.object,
};

/**
 * CardHeaderWrapper
 */
export function CardHeaderWrapper(props) {
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_card');
  const Component = useLegacy ? RBCard.Header : BaseCardHeader;
  return <Component {...props} />;
}

CardHeaderWrapper.displayName = 'Card.Header';
CardHeaderWrapper.propTypes = { children: PropTypes.node, className: PropTypes.string };

/**
 * CardBodyWrapper
 */
export function CardBodyWrapper(props) {
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_card');
  const Component = useLegacy ? RBCard.Body : BaseCardBody;
  return <Component {...props} />;
}

CardBodyWrapper.displayName = 'Card.Body';
CardBodyWrapper.propTypes = { children: PropTypes.node, className: PropTypes.string };

/**
 * CardFooterWrapper
 */
export function CardFooterWrapper(props) {
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_card');
  const Component = useLegacy ? RBCard.Footer : BaseCardFooter;
  return <Component {...props} />;
}

CardFooterWrapper.displayName = 'Card.Footer';
CardFooterWrapper.propTypes = { children: PropTypes.node, className: PropTypes.string };

/**
 * CardTitleWrapper
 */
export function CardTitleWrapper(props) {
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_card');
  const Component = useLegacy ? RBCard.Title : BaseCardTitle;
  return <Component {...props} />;
}

CardTitleWrapper.displayName = 'Card.Title';
CardTitleWrapper.propTypes = { children: PropTypes.node, className: PropTypes.string };

/**
 * CardTextWrapper (maps to Card.Text in react-bootstrap)
 */
export function CardTextWrapper(props) {
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_card');
  const Component = useLegacy ? RBCard.Text : BaseCardDescription;
  return <Component {...props} />;
}

CardTextWrapper.displayName = 'Card.Text';
CardTextWrapper.propTypes = { children: PropTypes.node, className: PropTypes.string };

// Attach compound sub-components so <Card.Body> works
CardWrapper.Header = CardHeaderWrapper;
CardWrapper.Body = CardBodyWrapper;
CardWrapper.Footer = CardFooterWrapper;
CardWrapper.Title = CardTitleWrapper;
CardWrapper.Text = CardTextWrapper;

export default CardWrapper;

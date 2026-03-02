/**
 * Card Abstraction Layer
 *
 * Provides a stable API for Card usage across the application.
 * All card consumers should import from design-system, NOT directly from BaseCard.
 *
 * Implementation: Chakra UI Card (BaseCard) — Phase 5 complete.
 *
 * Task: biensperience-9abe
 * Related: biensperience-e5c4 (epic)
 */

import PropTypes from 'prop-types';
import BaseCard, {
  BaseCardHeader,
  BaseCardBody,
  BaseCardFooter,
  BaseCardTitle,
  BaseCardDescription
} from '../Card/BaseCard';

/**
 * CardWrapper - Design System Card
 */
export function CardWrapper(props) {
  return <BaseCard {...props} />;
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
  return <BaseCardHeader {...props} />;
}

CardHeaderWrapper.displayName = 'Card.Header';
CardHeaderWrapper.propTypes = { children: PropTypes.node, className: PropTypes.string };

/**
 * CardBodyWrapper
 */
export function CardBodyWrapper(props) {
  return <BaseCardBody {...props} />;
}

CardBodyWrapper.displayName = 'Card.Body';
CardBodyWrapper.propTypes = { children: PropTypes.node, className: PropTypes.string };

/**
 * CardFooterWrapper
 */
export function CardFooterWrapper(props) {
  return <BaseCardFooter {...props} />;
}

CardFooterWrapper.displayName = 'Card.Footer';
CardFooterWrapper.propTypes = { children: PropTypes.node, className: PropTypes.string };

/**
 * CardTitleWrapper
 */
export function CardTitleWrapper(props) {
  return <BaseCardTitle {...props} />;
}

CardTitleWrapper.displayName = 'Card.Title';
CardTitleWrapper.propTypes = { children: PropTypes.node, className: PropTypes.string };

/**
 * CardTextWrapper
 */
export function CardTextWrapper(props) {
  return <BaseCardDescription {...props} />;
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

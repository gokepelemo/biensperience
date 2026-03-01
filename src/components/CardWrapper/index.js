/**
 * CardWrapper - Design System Card Components
 *
 * Re-exports the card wrapper components with user-friendly names.
 * All consumers should import from design-system for automatic
 * feature-flagged switching between implementations.
 */
export {
  CardWrapper as Card,
  CardHeaderWrapper as CardHeader,
  CardBodyWrapper as CardBody,
  CardFooterWrapper as CardFooter,
  CardTitleWrapper as CardTitle,
  CardTextWrapper as CardText
} from './CardWrapper';

export { default } from './CardWrapper';

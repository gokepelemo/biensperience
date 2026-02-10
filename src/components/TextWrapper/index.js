/**
 * TextWrapper - Design System Text Components
 *
 * Re-exports the text wrapper components with user-friendly names.
 * All consumers should import from design-system for automatic
 * feature-flagged switching between implementations.
 */
export {
  TextWrapper as Text,
  HeadingWrapper as Heading,
  ParagraphWrapper as Paragraph
} from './TextWrapper';

export { default } from './TextWrapper';

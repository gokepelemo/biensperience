/**
 * FormWrapper - Design System Form Components
 *
 * Re-exports the form wrapper components with user-friendly names.
 * All consumers should import from design-system for automatic
 * feature-flagged switching between implementations.
 */
export {
  FormWrapper as Form,
  FormGroupWrapper as FormGroup,
  FormLabelWrapper as FormLabel,
  FormControlWrapper as FormControl,
  FormCheckWrapper as FormCheck,
  FormTextWrapper as FormText,
  FormInputGroupWrapper as FormInputGroup
} from './FormWrapper';

export { default } from './FormWrapper';

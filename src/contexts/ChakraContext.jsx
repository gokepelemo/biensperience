/**
 * Chakra UI v3 Provider Context
 * Wraps the application with Chakra UI provider
 *
 * Note: Dark mode is handled by the existing Biensperience theme system
 * via CSS custom properties and data-theme attribute. Chakra components
 * inherit these styles through CSS custom property references.
 */

import React from 'react';
import { ChakraProvider } from '@chakra-ui/react';
import chakraSystem from '../styles/chakra-theme';

/**
 * Biensperience Chakra Provider
 * Wraps children with Chakra UI provider configured for the Biensperience design system
 *
 * Dark mode compatibility is maintained through:
 * 1. CSS custom properties (--color-*, --bg-*, etc.) that change based on data-theme
 * 2. Chakra components referencing these CSS custom properties
 * 3. Global styles in design-tokens.css handling dark mode overrides
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child components
 */
export function BiensperienceChakraProvider({ children }) {
  return (
    <ChakraProvider value={chakraSystem}>
      {children}
    </ChakraProvider>
  );
}

export default BiensperienceChakraProvider;

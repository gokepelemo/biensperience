/**
 * UI Provider Context
 * Wraps the application with the UI component library provider
 *
 * Note: Dark mode is handled by the existing Biensperience theme system
 * via CSS custom properties and data-theme attribute. UI components
 * inherit these styles through CSS custom property references.
 */

import React from 'react';
import { ChakraProvider } from '@chakra-ui/react';
import uiThemeSystem from '../styles/ui-theme';

/**
 * UI Provider
 * Wraps children with the UI component library provider configured for the Biensperience design system
 *
 * Dark mode compatibility is maintained through:
 * 1. CSS custom properties (--color-*, --bg-*, etc.) that change based on data-theme
 * 2. UI components referencing these CSS custom properties
 * 3. Global styles in design-tokens.css handling dark mode overrides
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child components
 */
export function UIProvider({ children }) {
  return (
    <ChakraProvider value={uiThemeSystem}>
      {children}
    </ChakraProvider>
  );
}

export default UIProvider;

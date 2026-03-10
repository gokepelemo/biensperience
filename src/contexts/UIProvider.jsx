/**
 * UI Provider Context
 * Wraps the application with Chakra UI v3 provider configured to the
 * Biensperience design system.
 *
 * Color mode is managed by theme-manager.js which sets both:
 *   - .dark/.light class on <html> (Chakra v3 native)
 *   - data-theme attribute (SCSS backward compat)
 *
 * Convenience re-exports: useColorMode, useColorModeValue
 */

import React from 'react';
import { ChakraProvider } from '@chakra-ui/react';
import uiThemeSystem from '../styles/ui-theme';

// Re-export color mode hooks for consumers
export { useColorMode, useColorModeValue } from '../hooks/useColorMode';

/**
 * UI Provider
 * Wraps children with Chakra UI v3 provider using the Biensperience
 * design system (tokens, recipes, slotRecipes, conditions, globalCss).
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

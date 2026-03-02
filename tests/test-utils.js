/**
 * Custom test utilities for component tests
 * Provides a render wrapper that includes ChakraProvider (required by design-system components)
 */

import React from 'react';
import { render } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import uiThemeSystem from '../src/styles/ui-theme';

/**
 * Custom render that wraps components in ChakraProvider
 * Use this instead of @testing-library/react's render for any component
 * that imports from design-system or uses Chakra primitives.
 */
function renderWithChakra(ui, options = {}) {
  function Wrapper({ children }) {
    return (
      <ChakraProvider value={uiThemeSystem}>
        {children}
      </ChakraProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...options });
}

// Re-export everything from @testing-library/react
export * from '@testing-library/react';

// Override the default render with our custom one
export { renderWithChakra as render };

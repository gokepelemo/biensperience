/**
 * Chakra UI v3 Theme Configuration
 * Integrates with Biensperience design tokens via CSS custom properties
 * Supports dark mode via data-theme attribute
 */

import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react';

/**
 * Custom theme configuration for Chakra UI v3
 * Uses CSS custom properties from the Biensperience design system
 */
const config = defineConfig({
  // Theme configuration
  theme: {
    // Semantic tokens that reference CSS custom properties
    semanticTokens: {
      colors: {
        // Text colors
        'chakra.text.primary': { value: 'var(--color-text-primary)' },
        'chakra.text.secondary': { value: 'var(--color-text-secondary)' },
        'chakra.text.muted': { value: 'var(--color-text-muted)' },
        // Background colors
        'chakra.bg.primary': { value: 'var(--color-bg-primary)' },
        'chakra.bg.secondary': { value: 'var(--color-bg-secondary)' },
        'chakra.bg.tertiary': { value: 'var(--color-bg-tertiary)' },
        // Brand colors
        'chakra.primary': { value: 'var(--color-primary)' },
        'chakra.primary.dark': { value: 'var(--color-primary-dark)' },
        // Semantic colors
        'chakra.success': { value: 'var(--color-success)' },
        'chakra.danger': { value: 'var(--color-danger)' },
        'chakra.warning': { value: 'var(--color-warning)' },
        'chakra.info': { value: 'var(--color-info)' },
      },
    },
  },
  // Global CSS
  globalCss: {
    body: {
      bg: 'var(--color-bg-primary)',
      color: 'var(--color-text-primary)',
    },
    // Ensure SVG icons display inline with text
    'svg': {
      display: 'inline-block',
      verticalAlign: 'middle',
    },
  },
});

/**
 * Create the Chakra system with merged configuration
 */
const chakraSystem = createSystem(defaultConfig, config);

export default chakraSystem;

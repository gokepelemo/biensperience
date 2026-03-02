/**
 * UI Theme Configuration
 * Integrates with Biensperience design tokens via CSS custom properties.
 * Supports dark mode via data-theme attribute.
 *
 * STRATEGY — Biensperience components use CSS Modules for visual styling.
 * Chakra primitives are consumed in one of two modes:
 *
 *   1. **unstyled / chakra() factory** – for components where we fully own the CSS
 *      (Button, Text, Table, Badge, Tag, Progress, Avatar). The Chakra recipe is
 *      disabled so CSS Modules are the sole styling source.
 *
 *   2. **Recipe-enabled** – for components where we leverage Chakra's built-in
 *      styling and only need to wire in our design tokens (Tooltip, Timeline,
 *      Pagination, Breadcrumb, Toast, Fieldset, Alert). These use the recipe
 *      variants/sizes defined below.
 *
 * The semantic tokens below expose every Biensperience CSS custom property
 * inside the Chakra token system so both modes can reference the same values.
 */

import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react';

/**
 * Custom theme configuration
 * Uses CSS custom properties from the Biensperience design system
 */
const config = defineConfig({
  // Override Chakra's default dark/light conditions to match
  // Biensperience's data-theme attribute system (not .dark class)
  conditions: {
    dark: '[data-theme="dark"] &',
    light: ':root &, [data-theme="light"] &',
  },
  // Theme configuration
  theme: {
    // Extend tokens with a brand color palette
    tokens: {
      colors: {
        brand: {
          50: { value: 'var(--color-primary-alpha-10)' },
          100: { value: 'var(--color-primary-alpha-20)' },
          200: { value: 'var(--color-primary-alpha-30)' },
          300: { value: 'var(--color-primary-alpha-40)' },
          400: { value: 'var(--color-primary-alpha-50)' },
          500: { value: 'var(--color-primary)' },
          600: { value: 'var(--color-primary-dark)' },
          700: { value: 'var(--color-primary-dark)' },
          800: { value: 'var(--color-primary-dark)' },
          900: { value: 'var(--color-primary-dark)' },
          950: { value: 'var(--color-primary-dark)' },
        },
      },
      // Map design token sizes into Chakra's token system
      sizes: {
        'btn-sm': { value: 'var(--btn-height-sm)' },
        'btn-md': { value: 'var(--btn-height-md)' },
        'btn-lg': { value: 'var(--btn-height-lg)' },
      },
      radii: {
        'btn-default': { value: 'var(--btn-radius-default)' },
        'btn-pill': { value: 'var(--btn-radius-pill)' },
      },
    },

    // Semantic tokens that reference CSS custom properties
    semanticTokens: {
      colors: {
        // Brand — use as colorPalette="brand" on Chakra recipe components
        'brand.contrast': { value: 'white' },
        'brand.fg': { value: 'var(--color-primary)' },
        'brand.subtle': { value: 'var(--color-primary-alpha-10)' },
        'brand.muted': { value: 'var(--color-primary-alpha-20)' },
        'brand.emphasized': { value: 'var(--color-primary-alpha-40)' },
        'brand.solid': { value: 'var(--color-primary)' },
        'brand.focusRing': { value: 'var(--color-primary-alpha-50)' },
        'brand.border': { value: 'var(--color-primary-alpha-30)' },

        // Text colors
        'chakra.text.primary': { value: 'var(--color-text-primary)' },
        'chakra.text.secondary': { value: 'var(--color-text-secondary)' },
        'chakra.text.muted': { value: 'var(--color-text-muted)' },
        // Background colors
        'chakra.bg.primary': { value: 'var(--color-bg-primary)' },
        'chakra.bg.secondary': { value: 'var(--color-bg-secondary)' },
        'chakra.bg.tertiary': { value: 'var(--color-bg-tertiary)' },
        // Brand colors (legacy flat tokens — kept for backwards-compat)
        'chakra.primary': { value: 'var(--color-primary)' },
        'chakra.primary.dark': { value: 'var(--color-primary-dark)' },
        // Semantic colors
        'chakra.success': { value: 'var(--color-success)' },
        'chakra.danger': { value: 'var(--color-danger)' },
        'chakra.warning': { value: 'var(--color-warning)' },
        'chakra.info': { value: 'var(--color-info)' },
      },
    },

    /**
     * Recipe overrides for Chakra components used in "recipe-enabled" mode.
     *
     * These customize variants and sizes so they reference Biensperience
     * design tokens. Components consumed in "unstyled" mode ignore these
     * entirely (recipes are stripped via the `unstyled` prop or `chakra()` factory).
     */
    recipes: {
      // Button recipe — used only by Toast and ActivityFeed (not BaseButton)
      button: {
        variants: {
          variant: {
            // Match Biensperience gradient style
            gradient: {
              background: 'var(--btn-gradient-bg)',
              color: 'white',
              borderRadius: 'var(--btn-radius-default)',
              _hover: {
                opacity: 0.9,
              },
            },
          },
          size: {
            sm: {
              minHeight: 'var(--btn-height-sm)',
              paddingInline: 'var(--btn-padding-x-sm)',
              paddingBlock: 'var(--btn-padding-y-sm)',
              fontSize: 'var(--btn-font-size-sm)',
            },
            md: {
              minHeight: 'var(--btn-height-md)',
              paddingInline: 'var(--btn-padding-x-md)',
              paddingBlock: 'var(--btn-padding-y-md)',
              fontSize: 'var(--btn-font-size-md)',
            },
            lg: {
              minHeight: 'var(--btn-height-lg)',
              paddingInline: 'var(--btn-padding-x-lg)',
              paddingBlock: 'var(--btn-padding-y-lg)',
              fontSize: 'var(--btn-font-size-lg)',
            },
          },
        },
      },

      // Badge recipe — used only by recipe-enabled consumers
      badge: {
        variants: {
          size: {
            sm: { fontSize: 'var(--font-size-xs)', px: '0.375rem', py: '0.125rem' },
            md: { fontSize: 'var(--font-size-sm)', px: '0.5rem', py: '0.25rem' },
            lg: { fontSize: 'var(--font-size-base)', px: '0.75rem', py: '0.375rem' },
          },
        },
      },

      // Heading recipe — used only by recipe-enabled consumers
      heading: {
        variants: {
          size: {
            sm: { fontSize: 'var(--font-size-lg)' },
            md: { fontSize: 'var(--font-size-xl)' },
            lg: { fontSize: 'var(--font-size-2xl)' },
            xl: { fontSize: 'var(--font-size-3xl)' },
          },
        },
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
 * Create the UI theme system with merged configuration
 */
const uiThemeSystem = createSystem(defaultConfig, config);

export default uiThemeSystem;

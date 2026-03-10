/**
 * Biensperience Chakra UI v3 Theme Configuration
 *
 * NATIVE Chakra theme — all design tokens are defined directly in the
 * Chakra token system. No CSS custom property bridge layer.
 *
 * This file is the SINGLE SOURCE OF TRUTH for all design tokens:
 * - Colors (brand, semantic, text, background, border, social, badge)
 * - Typography (font families, sizes, weights, line heights, letter spacing)
 * - Spacing scale
 * - Border radii
 * - Shadows
 * - Breakpoints
 * - Z-indices
 * - Transitions / durations / easings
 * - Layout sizes (containers, sidebars, cards, auth forms)
 * - Text styles (typography presets)
 * - Layer styles (surface/container presets)
 * - Animation styles
 * - Component recipes (Button, Badge, Heading, Alert, Card, etc.)
 * - Global CSS
 *
 * Replaces:
 * - src/styles/scss/abstracts/_variables.scss
 * - src/styles/scss/abstracts/_tokens.scss
 * - src/styles/design-tokens.scss
 * - Previous ui-theme.js (partial bridge)
 */

import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react';

// ---------------------------------------------------------------------------
// Token definitions
// ---------------------------------------------------------------------------

const config = defineConfig({

  // -----------------------------------------------------------------------
  // Conditions — dark/light mode
  // Matches both .dark class (Chakra v3 native) and [data-theme="dark"]
  // (SCSS backward compat during migration). theme-manager.js sets both.
  // -----------------------------------------------------------------------
  conditions: {
    dark: '.dark &, [data-theme="dark"] &, @media (prefers-color-scheme: dark)',
    light: ':root &, .light &, [data-theme="light"] &',
  },

  // -----------------------------------------------------------------------
  // Theme
  // -----------------------------------------------------------------------
  theme: {

    // =====================================================================
    // CORE TOKENS (non-semantic, constant values)
    // =====================================================================
    tokens: {

      // -------------------------------------------------------------------
      // COLORS
      // -------------------------------------------------------------------
      colors: {
        // Brand palette — indigo/purple gradient
        brand: {
          50:  { value: '#eef2ff' },
          100: { value: '#e0e7ff' },
          200: { value: '#c7d2fe' },
          300: { value: '#a5b4fc' },
          400: { value: '#818cf8' },
          500: { value: '#667eea' },   // Primary indigo
          600: { value: '#5a67d8' },   // Primary hover
          700: { value: '#764ba2' },   // Purple / secondary
          800: { value: '#6b3fa0' },
          900: { value: '#553c9a' },
          950: { value: '#44337a' },
        },

        // Accent
        accent: {
          50:  { value: '#fef5ff' },
          100: { value: '#fce7fe' },
          200: { value: '#f9cefd' },
          300: { value: '#f5a3fb' },
          400: { value: '#f093fb' },   // Main accent
          500: { value: '#e879f5' },
          600: { value: '#d946ef' },
          700: { value: '#c026d3' },
          800: { value: '#a21caf' },
          900: { value: '#86198f' },
          950: { value: '#701a75' },
        },

        // Social media brand colors
        social: {
          facebook:  { value: '#1877F2' },
          google:    { value: '#DB4437' },
          twitter:   { value: '#1DA1F2' },
        },

        // Utility colors
        star:            { value: '#ffc107' },
        readReceipt:     { value: '#4ade80' },
        messageSent:     { value: '#10b981' },
        messagePending:  { value: '#fbbf24' },
      },

      // -------------------------------------------------------------------
      // FONTS
      // -------------------------------------------------------------------
      fonts: {
        body:    { value: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' },
        heading: { value: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' },
        mono:    { value: '"SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace' },
      },

      // -------------------------------------------------------------------
      // FONT SIZES — static values (responsive clamp handled in textStyles)
      // -------------------------------------------------------------------
      fontSizes: {
        '2xs': { value: '0.625rem' },   // 10px
        xs:    { value: '0.75rem' },     // 12px
        sm:    { value: '0.875rem' },    // 14px
        md:    { value: '1rem' },        // 16px (base)
        lg:    { value: '1.125rem' },    // 18px
        xl:    { value: '1.25rem' },     // 20px
        '2xl': { value: '1.5rem' },      // 24px
        '3xl': { value: '1.875rem' },    // 30px
        '4xl': { value: '2.25rem' },     // 36px
        '5xl': { value: '3rem' },        // 48px
        '6xl': { value: '3.75rem' },     // 60px
        '7xl': { value: '4.5rem' },      // 72px
      },

      // -------------------------------------------------------------------
      // FONT WEIGHTS
      // -------------------------------------------------------------------
      fontWeights: {
        light:     { value: '300' },
        normal:    { value: '400' },
        medium:    { value: '500' },
        semibold:  { value: '600' },
        bold:      { value: '700' },
        extrabold: { value: '800' },
      },

      // -------------------------------------------------------------------
      // LINE HEIGHTS
      // -------------------------------------------------------------------
      lineHeights: {
        none:     { value: '1' },
        tight:    { value: '1.25' },
        snug:     { value: '1.375' },
        normal:   { value: '1.5' },
        relaxed:  { value: '1.625' },
        loose:    { value: '2' },
      },

      // -------------------------------------------------------------------
      // LETTER SPACINGS
      // -------------------------------------------------------------------
      letterSpacings: {
        tighter: { value: '-0.05em' },
        tight:   { value: '-0.025em' },
        normal:  { value: '0' },
        wide:    { value: '0.025em' },
        wider:   { value: '0.05em' },
        widest:  { value: '0.1em' },
      },

      // -------------------------------------------------------------------
      // SPACING SCALE
      // -------------------------------------------------------------------
      spacing: {
        0:     { value: '0' },
        0.5:   { value: '0.125rem' },   // 2px
        1:     { value: '0.25rem' },     // 4px
        1.5:   { value: '0.375rem' },    // 6px
        2:     { value: '0.5rem' },      // 8px
        2.5:   { value: '0.625rem' },    // 10px
        3:     { value: '0.75rem' },     // 12px
        3.5:   { value: '0.875rem' },    // 14px
        4:     { value: '1rem' },        // 16px
        5:     { value: '1.25rem' },     // 20px
        6:     { value: '1.5rem' },      // 24px
        7:     { value: '1.75rem' },     // 28px
        8:     { value: '2rem' },        // 32px
        9:     { value: '2.25rem' },     // 36px
        10:    { value: '2.5rem' },      // 40px
        12:    { value: '3rem' },        // 48px
        14:    { value: '3.5rem' },      // 56px
        16:    { value: '4rem' },        // 64px
        20:    { value: '5rem' },        // 80px
        24:    { value: '6rem' },        // 96px
        28:    { value: '7rem' },        // 112px
        32:    { value: '8rem' },        // 128px
        36:    { value: '9rem' },        // 144px
        40:    { value: '10rem' },       // 160px
      },

      // -------------------------------------------------------------------
      // SIZES (widths, heights, max-widths)
      // -------------------------------------------------------------------
      sizes: {
        // Button heights
        'btn.sm':  { value: '36px' },
        'btn.md':  { value: '44px' },   // WCAG 2.1 AA minimum
        'btn.lg':  { value: '52px' },

        // Button widths
        'btn.minWidth':  { value: '120px' },
        'btn.widthSm':   { value: '140px' },
        'btn.widthMd':   { value: '160px' },
        'btn.widthLg':   { value: '200px' },

        // Form field
        'form.fieldMinHeight':       { value: '56px' },
        'form.fieldMinHeightMobile': { value: '52px' },

        // Container max-widths
        'container.sm':  { value: '640px' },
        'container.md':  { value: '768px' },
        'container.lg':  { value: '1024px' },
        'container.xl':  { value: '1280px' },
        'container.2xl': { value: '1536px' },

        // Sidebar widths
        'sidebar.sm': { value: '280px' },
        'sidebar.md': { value: '320px' },
        'sidebar.lg': { value: '360px' },

        // Card widths
        'card.sm': { value: '280px' },
        'card.md': { value: '320px' },
        'card.lg': { value: '360px' },

        // Auth form containers
        'auth.mobile':  { value: '100%' },
        'auth.tablet':  { value: '480px' },
        'auth.desktop': { value: '520px' },
        'auth.large':   { value: '560px' },

        // Auth input heights
        'auth.inputHeight':       { value: '56px' },
        'auth.inputHeightMobile': { value: '52px' },

        // Bottom nav
        'bottomNav.height': { value: '64px' },

        // Metrics bar
        'metricsBar.height':       { value: '80px' },
        'metricsBar.heightMobile': { value: '100px' },

        // Menu items (WCAG)
        'menu.minHeight': { value: '44px' },

        // Progress bar heights
        'progress.sm': { value: '8px' },
        'progress.md': { value: '12px' },
        'progress.lg': { value: '16px' },

        // Timeline
        'timeline.lineWidth':      { value: '2px' },
        'timeline.nodeSize':       { value: '12px' },
        'timeline.nodeSizeActive': { value: '16px' },

        // Layout
        'layout.minHeightCard': { value: '400px' },

        // Modal
        'modal.contentPadding':    { value: '1rem' },
        'modal.sectionMargin':     { value: '1rem' },
        'modal.buttonGroupMargin': { value: '0.75rem' },
      },

      // -------------------------------------------------------------------
      // BORDER RADII
      // -------------------------------------------------------------------
      radii: {
        none: { value: '0' },
        xs:   { value: '0.25rem' },    // 4px
        sm:   { value: '0.375rem' },   // 6px
        md:   { value: '0.5rem' },     // 8px
        lg:   { value: '0.75rem' },    // 12px
        xl:   { value: '1rem' },       // 16px
        '2xl': { value: '1.5rem' },    // 24px
        full: { value: '9999px' },
      },

      // -------------------------------------------------------------------
      // SHADOWS
      // -------------------------------------------------------------------
      shadows: {
        xs:   { value: '0 1px 2px rgba(0, 0, 0, 0.05)' },
        sm:   { value: '0 2px 8px rgba(102, 126, 234, 0.1)' },
        md:   { value: '0 4px 12px rgba(102, 126, 234, 0.15)' },
        lg:   { value: '0 10px 30px rgba(102, 126, 234, 0.2)' },
        xl:   { value: '0 20px 40px rgba(0, 0, 0, 0.25)' },
        '2xl': { value: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' },
        'text.sm': { value: '0 1px 2px rgba(0, 0, 0, 0.05)' },
        'text.md': { value: '0 2px 4px rgba(0, 0, 0, 0.1)' },
      },

      // -------------------------------------------------------------------
      // Z-INDEX SCALE
      // -------------------------------------------------------------------
      zIndex: {
        base:            { value: '0' },
        docked:          { value: '10' },
        dropdown:        { value: '1000' },
        sticky:          { value: '1020' },
        fixed:           { value: '1030' },
        modalBackdrop:   { value: '1040' },
        modal:           { value: '1050' },
        modalDropdown:   { value: '1055' },
        popover:         { value: '1060' },
        tooltip:         { value: '1070' },
        toast:           { value: '1080' },
        max:             { value: '9999' },
      },

      // -------------------------------------------------------------------
      // DURATIONS
      // -------------------------------------------------------------------
      durations: {
        fastest:  { value: '50ms' },
        faster:   { value: '100ms' },
        fast:     { value: '150ms' },
        normal:   { value: '200ms' },
        slow:     { value: '300ms' },
        slower:   { value: '500ms' },
        slowest:  { value: '1000ms' },
      },

      // -------------------------------------------------------------------
      // EASINGS
      // -------------------------------------------------------------------
      easings: {
        linear:    { value: 'linear' },
        ease:      { value: 'ease' },
        easeIn:    { value: 'ease-in' },
        easeOut:   { value: 'ease-out' },
        easeInOut: { value: 'ease-in-out' },
        custom:    { value: 'cubic-bezier(0.4, 0, 0.2, 1)' },
      },

      // -------------------------------------------------------------------
      // BREAKPOINTS (defined as tokens for reference; Chakra uses its own)
      // -------------------------------------------------------------------
      breakpoints: {
        xs:  { value: '320px' },
        sm:  { value: '576px' },
        md:  { value: '768px' },
        lg:  { value: '992px' },
        xl:  { value: '1200px' },
        '2xl': { value: '1400px' },
      },

      // -------------------------------------------------------------------
      // GRADIENTS
      // -------------------------------------------------------------------
      gradients: {
        primary:         { value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
        primaryReverse:  { value: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)' },
        primaryAnimated: { value: 'linear-gradient(-45deg, #667eea, #764ba2, #667eea, #764ba2)' },
      },
    },

    // =====================================================================
    // SEMANTIC TOKENS (context-aware, support light/dark automatically)
    // =====================================================================
    semanticTokens: {
      colors: {
        // -----------------------------------------------------------------
        // Brand semantic tokens (required for colorPalette="brand")
        // -----------------------------------------------------------------
        'brand.solid':      { value: { _light: '{colors.brand.500}', _dark: '{colors.brand.400}' } },
        'brand.contrast':   { value: { _light: 'white', _dark: 'white' } },
        'brand.fg':         { value: { _light: '{colors.brand.500}', _dark: '{colors.brand.300}' } },
        'brand.muted':      { value: { _light: '{colors.brand.100}', _dark: 'rgba(102, 126, 234, 0.2)' } },
        'brand.subtle':     { value: { _light: '{colors.brand.50}', _dark: 'rgba(102, 126, 234, 0.1)' } },
        'brand.emphasized': { value: { _light: '{colors.brand.200}', _dark: 'rgba(102, 126, 234, 0.4)' } },
        'brand.focusRing':  { value: { _light: '{colors.brand.500}', _dark: '{colors.brand.400}' } },
        'brand.border':     { value: { _light: '{colors.brand.200}', _dark: 'rgba(102, 126, 234, 0.3)' } },

        // -----------------------------------------------------------------
        // Accent semantic tokens (for colorPalette="accent")
        // -----------------------------------------------------------------
        'accent.solid':      { value: { _light: '{colors.accent.400}', _dark: '{colors.accent.400}' } },
        'accent.contrast':   { value: 'white' },
        'accent.fg':         { value: { _light: '{colors.accent.600}', _dark: '{colors.accent.300}' } },
        'accent.muted':      { value: { _light: '{colors.accent.100}', _dark: 'rgba(240, 147, 251, 0.2)' } },
        'accent.subtle':     { value: { _light: '{colors.accent.50}', _dark: 'rgba(240, 147, 251, 0.1)' } },
        'accent.emphasized': { value: { _light: '{colors.accent.200}', _dark: 'rgba(240, 147, 251, 0.4)' } },
        'accent.focusRing':  { value: { _light: '{colors.accent.500}', _dark: '{colors.accent.400}' } },
        'accent.border':     { value: { _light: '{colors.accent.200}', _dark: 'rgba(240, 147, 251, 0.3)' } },

        // -----------------------------------------------------------------
        // Text colors
        // -----------------------------------------------------------------
        'fg':           { value: { _light: '#1a202c', _dark: '#f8f9fa' } },
        'fg.secondary': { value: { _light: '#2d3748', _dark: '#e9ecef' } },
        'fg.tertiary':  { value: { _light: '#4a5568', _dark: '#dee2e6' } },
        'fg.muted':     { value: { _light: '#5a6370', _dark: '#adb5bd' } },
        'fg.disabled':  { value: { _light: '#9ca3af', _dark: '#6c757d' } },
        'fg.inverted':  { value: { _light: '#ffffff', _dark: '#1a202c' } },

        // -----------------------------------------------------------------
        // Background colors
        // -----------------------------------------------------------------
        'bg':              { value: { _light: '#ffffff', _dark: '#121212' } },
        'bg.secondary':    { value: { _light: '#f8f9fa', _dark: '#1e1e1e' } },
        'bg.tertiary':     { value: { _light: '#e9ecef', _dark: '#2d2d2d' } },
        'bg.hover':        { value: { _light: 'rgba(102, 126, 234, 0.05)', _dark: 'rgba(255, 255, 255, 0.05)' } },
        'bg.overlay':      { value: { _light: 'rgba(0, 0, 0, 0.75)', _dark: 'rgba(0, 0, 0, 0.85)' } },
        'bg.overlayLight': { value: 'rgba(255, 255, 255, 0.15)' },
        'bg.input':        { value: { _light: '#ffffff', _dark: '#2d2d2d' } },

        // -----------------------------------------------------------------
        // Border colors
        // -----------------------------------------------------------------
        'border':         { value: { _light: 'rgba(0, 0, 0, 0.1)', _dark: 'rgba(255, 255, 255, 0.2)' } },
        'border.light':   { value: { _light: 'rgba(0, 0, 0, 0.05)', _dark: 'rgba(255, 255, 255, 0.1)' } },
        'border.dark':    { value: { _light: 'rgba(0, 0, 0, 0.2)', _dark: 'rgba(255, 255, 255, 0.3)' } },
        'border.brand':   { value: { _light: 'rgba(102, 126, 234, 0.2)', _dark: 'rgba(102, 126, 234, 0.3)' } },
        'border.overlay': { value: 'rgba(255, 255, 255, 0.25)' },

        // -----------------------------------------------------------------
        // Semantic status colors
        // -----------------------------------------------------------------
        'success.solid':      { value: { _light: '#28a745', _dark: '#40c057' } },
        'success.fg':         { value: { _light: '#28a745', _dark: '#40c057' } },
        'success.muted':      { value: { _light: 'rgba(40, 167, 69, 0.1)', _dark: 'rgba(64, 192, 87, 0.15)' } },
        'success.subtle':     { value: { _light: 'rgba(40, 167, 69, 0.1)', _dark: 'rgba(64, 192, 87, 0.15)' } },
        'success.contrast':   { value: 'white' },
        'success.emphasized': { value: { _light: '#218838', _dark: '#2f9e44' } },
        'success.border':     { value: { _light: 'rgba(40, 167, 69, 0.3)', _dark: 'rgba(64, 192, 87, 0.3)' } },
        'success.focusRing':  { value: { _light: '#28a745', _dark: '#40c057' } },
        'success.text':       { value: { _light: '#155724', _dark: '#8ce99a' } },

        'danger.solid':      { value: { _light: '#dc3545', _dark: '#fa5252' } },
        'danger.fg':         { value: { _light: '#dc3545', _dark: '#fa5252' } },
        'danger.muted':      { value: { _light: 'rgba(220, 53, 69, 0.1)', _dark: 'rgba(250, 82, 82, 0.15)' } },
        'danger.subtle':     { value: { _light: 'rgba(220, 53, 69, 0.1)', _dark: 'rgba(250, 82, 82, 0.15)' } },
        'danger.contrast':   { value: 'white' },
        'danger.emphasized': { value: { _light: '#c82333', _dark: '#e03131' } },
        'danger.border':     { value: { _light: 'rgba(220, 53, 69, 0.3)', _dark: 'rgba(250, 82, 82, 0.3)' } },
        'danger.focusRing':  { value: { _light: '#dc3545', _dark: '#fa5252' } },
        'danger.text':       { value: { _light: '#721c24', _dark: '#ffa8a8' } },

        'warning.solid':      { value: { _light: '#ffc107', _dark: '#ffd43b' } },
        'warning.fg':         { value: { _light: '#ffc107', _dark: '#ffd43b' } },
        'warning.muted':      { value: { _light: 'rgba(255, 193, 7, 0.1)', _dark: 'rgba(255, 212, 59, 0.15)' } },
        'warning.subtle':     { value: { _light: 'rgba(255, 193, 7, 0.1)', _dark: 'rgba(255, 212, 59, 0.15)' } },
        'warning.contrast':   { value: { _light: '#1a202c', _dark: '#000000' } },
        'warning.emphasized': { value: { _light: '#e0a800', _dark: '#fab005' } },
        'warning.border':     { value: { _light: 'rgba(255, 193, 7, 0.3)', _dark: 'rgba(255, 212, 59, 0.3)' } },
        'warning.focusRing':  { value: { _light: '#ffc107', _dark: '#ffd43b' } },
        'warning.text':       { value: { _light: '#856404', _dark: '#ffe066' } },

        'info.solid':      { value: { _light: '#17a2b8', _dark: '#339af0' } },
        'info.fg':         { value: { _light: '#17a2b8', _dark: '#339af0' } },
        'info.muted':      { value: { _light: 'rgba(23, 162, 184, 0.1)', _dark: 'rgba(51, 154, 240, 0.15)' } },
        'info.subtle':     { value: { _light: 'rgba(23, 162, 184, 0.1)', _dark: 'rgba(51, 154, 240, 0.15)' } },
        'info.contrast':   { value: 'white' },
        'info.emphasized': { value: { _light: '#138496', _dark: '#1c7ed6' } },
        'info.border':     { value: { _light: 'rgba(23, 162, 184, 0.3)', _dark: 'rgba(51, 154, 240, 0.3)' } },
        'info.focusRing':  { value: { _light: '#17a2b8', _dark: '#339af0' } },
        'info.text':       { value: { _light: '#0c5460', _dark: '#74c0fc' } },

        // -----------------------------------------------------------------
        // Semantic "on" colors (text on colored backgrounds)
        // -----------------------------------------------------------------
        'on.primary': { value: '#ffffff' },
        'on.success': { value: '#ffffff' },
        'on.warning': { value: '#1a202c' },
        'on.danger':  { value: '#ffffff' },
        'on.info':    { value: '#ffffff' },

        // -----------------------------------------------------------------
        // Badge category colors — light/dark variants
        // -----------------------------------------------------------------
        'badge.primary.bg':   { value: { _light: '#667eea', _dark: '#7c93f7' } },
        'badge.primary.text': { value: { _light: '#ffffff', _dark: '#000000' } },

        'badge.success.bg':   { value: { _light: '#28a745', _dark: '#40c057' } },
        'badge.success.text': { value: { _light: '#ffffff', _dark: '#000000' } },

        'badge.danger.bg':    { value: { _light: '#dc3545', _dark: '#fa5252' } },
        'badge.danger.text':  { value: { _light: '#ffffff', _dark: '#000000' } },

        'badge.warning.bg':   { value: { _light: '#ffc107', _dark: '#ffd43b' } },
        'badge.warning.text': { value: { _light: '#333333', _dark: '#000000' } },

        'badge.info.bg':      { value: { _light: '#138496', _dark: '#4dabf7' } },
        'badge.info.text':    { value: { _light: '#ffffff', _dark: '#000000' } },

        'badge.neutral.bg':   { value: { _light: '#6c757d', _dark: '#adb5bd' } },
        'badge.neutral.text': { value: { _light: '#ffffff', _dark: '#000000' } },

        // Category-specific badges
        'badge.nature.bg':       { value: { _light: '#28a745', _dark: '#51cf66' } },
        'badge.nature.text':     { value: { _light: '#ffffff', _dark: '#000000' } },
        'badge.culture.bg':      { value: { _light: '#764ba2', _dark: '#9775fa' } },
        'badge.culture.text':    { value: { _light: '#ffffff', _dark: '#000000' } },
        'badge.food.bg':         { value: { _light: '#fd7e14', _dark: '#ff922b' } },
        'badge.food.text':       { value: { _light: '#ffffff', _dark: '#000000' } },
        'badge.adventure.bg':    { value: { _light: '#dc3545', _dark: '#ff6b6b' } },
        'badge.adventure.text':  { value: { _light: '#ffffff', _dark: '#000000' } },
        'badge.relaxation.bg':   { value: { _light: '#17a2b8', _dark: '#4dabf7' } },
        'badge.relaxation.text': { value: { _light: '#ffffff', _dark: '#000000' } },
        'badge.photography.bg':  { value: { _light: '#e83e8c', _dark: '#ff6b9d' } },
        'badge.photography.text': { value: { _light: '#ffffff', _dark: '#000000' } },
        'badge.seasonal.bg':     { value: { _light: '#ffc107', _dark: '#ffd43b' } },
        'badge.seasonal.text':   { value: { _light: '#000000', _dark: '#000000' } },
        'badge.nightlife.bg':    { value: { _light: '#6610f2', _dark: '#9775fa' } },
        'badge.nightlife.text':  { value: { _light: '#ffffff', _dark: '#000000' } },
        'badge.shopping.bg':     { value: { _light: '#20c997', _dark: '#63e6be' } },
        'badge.shopping.text':   { value: { _light: '#ffffff', _dark: '#000000' } },
        'badge.historical.bg':   { value: { _light: '#6c757d', _dark: '#adb5bd' } },
        'badge.historical.text': { value: { _light: '#ffffff', _dark: '#000000' } },

        // -----------------------------------------------------------------
        // Favorite button colors
        // -----------------------------------------------------------------
        'favorite.addHoverStart':    { value: { _light: '#28a745', _dark: '#40c057' } },
        'favorite.addHoverEnd':      { value: { _light: '#218838', _dark: '#2f9e44' } },
        'favorite.removeHoverStart': { value: { _light: '#dc3545', _dark: '#fa5252' } },
        'favorite.removeHoverEnd':   { value: { _light: '#c82333', _dark: '#e03131' } },
        'favorite.pillBg':           { value: '#667eea' },
        'favorite.pillBgEnd':        { value: '#764ba2' },
        'favorite.text':             { value: '#ffffff' },

        // -----------------------------------------------------------------
        // Shimmer / loading
        // -----------------------------------------------------------------
        'shimmer.light': { value: 'rgba(255, 255, 255, 0.4)' },
        'shimmer.dark':  { value: 'rgba(255, 255, 255, 0.1)' },

        // -----------------------------------------------------------------
        // Form field semantic colors
        // -----------------------------------------------------------------
        'form.fieldBorder': { value: { _light: 'rgba(0, 0, 0, 0.1)', _dark: 'rgba(255, 255, 255, 0.2)' } },
        'form.addonBg':     { value: { _light: '#f8f9fa', _dark: '#2d2d2d' } },
        'form.addonColor':  { value: { _light: '#5a6370', _dark: '#adb5bd' } },
        'form.controlBg':   { value: { _light: '#ffffff', _dark: '#2d2d2d' } },
        'form.bgSecondary': { value: { _light: '#f8f9fa', _dark: '#2d2d2d' } },
        'form.borderLight': { value: { _light: 'rgba(0, 0, 0, 0.05)', _dark: 'rgba(255, 255, 255, 0.2)' } },

        // -----------------------------------------------------------------
        // Shadows — semantic (light/dark variants)
        // -----------------------------------------------------------------
        'shadow.xs':      { value: { _light: '0 1px 2px rgba(0, 0, 0, 0.05)', _dark: '0 1px 2px rgba(0, 0, 0, 0.3)' } },
        'shadow.sm':      { value: { _light: '0 2px 8px rgba(102, 126, 234, 0.1)', _dark: '0 2px 8px rgba(102, 126, 234, 0.15)' } },
        'shadow.md':      { value: { _light: '0 4px 12px rgba(102, 126, 234, 0.15)', _dark: '0 4px 12px rgba(102, 126, 234, 0.2)' } },
        'shadow.lg':      { value: { _light: '0 10px 30px rgba(102, 126, 234, 0.2)', _dark: '0 10px 30px rgba(102, 126, 234, 0.3)' } },
        'shadow.xl':      { value: { _light: '0 20px 40px rgba(0, 0, 0, 0.25)', _dark: '0 20px 40px rgba(0, 0, 0, 0.5)' } },
        'shadow.text.sm': { value: { _light: '0 1px 2px rgba(0, 0, 0, 0.05)', _dark: '0 1px 2px rgba(0, 0, 0, 0.5)' } },
        'shadow.text.md': { value: { _light: '0 2px 4px rgba(0, 0, 0, 0.1)', _dark: '0 2px 4px rgba(0, 0, 0, 0.7)' } },

        // -----------------------------------------------------------------
        // Legacy compatibility aliases
        // These allow existing code using 'chakra.*' tokens to keep working
        // during migration. Remove after Phase 5.
        // -----------------------------------------------------------------
        'chakra.text.primary':   { value: { _light: '#1a202c', _dark: '#f8f9fa' } },
        'chakra.text.secondary': { value: { _light: '#2d3748', _dark: '#e9ecef' } },
        'chakra.text.muted':     { value: { _light: '#5a6370', _dark: '#adb5bd' } },
        'chakra.bg.primary':     { value: { _light: '#ffffff', _dark: '#121212' } },
        'chakra.bg.secondary':   { value: { _light: '#f8f9fa', _dark: '#1e1e1e' } },
        'chakra.bg.tertiary':    { value: { _light: '#e9ecef', _dark: '#2d2d2d' } },
        'chakra.primary':        { value: { _light: '#667eea', _dark: '#818cf8' } },
        'chakra.primary.dark':   { value: { _light: '#764ba2', _dark: '#9775fa' } },
        'chakra.success':        { value: { _light: '#28a745', _dark: '#40c057' } },
        'chakra.danger':         { value: { _light: '#dc3545', _dark: '#fa5252' } },
        'chakra.warning':        { value: { _light: '#ffc107', _dark: '#ffd43b' } },
        'chakra.info':           { value: { _light: '#17a2b8', _dark: '#339af0' } },
      },
    },

    // =====================================================================
    // TEXT STYLES — typography presets
    // =====================================================================
    textStyles: {
      '2xs': {
        value: { fontSize: '0.625rem', lineHeight: '1', fontWeight: '400' },
      },
      xs: {
        value: { fontSize: 'clamp(0.75rem, 1vw, 0.875rem)', lineHeight: '1.25', fontWeight: '400' },
      },
      sm: {
        value: { fontSize: 'clamp(0.875rem, 1.25vw, 1rem)', lineHeight: '1.375', fontWeight: '400' },
      },
      md: {
        value: { fontSize: 'clamp(0.9375rem, 1.5vw, 1.0625rem)', lineHeight: '1.5', fontWeight: '400' },
      },
      lg: {
        value: { fontSize: 'clamp(1.0625rem, 2vw, 1.3125rem)', lineHeight: '1.5', fontWeight: '400' },
      },
      xl: {
        value: { fontSize: 'clamp(1.25rem, 2.5vw, 1.5rem)', lineHeight: '1.375', fontWeight: '600' },
      },
      '2xl': {
        value: { fontSize: 'clamp(1.5rem, 3vw, 1.875rem)', lineHeight: '1.25', fontWeight: '700' },
      },
      '3xl': {
        value: { fontSize: 'clamp(1.875rem, 4vw, 2.25rem)', lineHeight: '1.25', fontWeight: '700' },
      },
      '4xl': {
        value: { fontSize: 'clamp(2.25rem, 5vw, 3rem)', lineHeight: '1.125', fontWeight: '800' },
      },
      '5xl': {
        value: { fontSize: 'clamp(3rem, 6vw, 4rem)', lineHeight: '1', fontWeight: '800' },
      },
      '6xl': {
        value: { fontSize: '3.75rem', lineHeight: '1', fontWeight: '800' },
      },
      '7xl': {
        value: { fontSize: '4.5rem', lineHeight: '1', fontWeight: '800' },
      },
      label: {
        value: { fontSize: 'clamp(0.75rem, 1vw, 0.875rem)', lineHeight: '1.25', fontWeight: '600', letterSpacing: '0.025em' },
      },
    },

    // =====================================================================
    // LAYER STYLES — surface/container presets
    // =====================================================================
    layerStyles: {
      'fill.muted': {
        value: {
          background: { _light: '#f8f9fa', _dark: '#1e1e1e' },
          borderRadius: '{radii.lg}',
        },
      },
      'fill.subtle': {
        value: {
          background: { _light: '#e9ecef', _dark: '#2d2d2d' },
          borderRadius: '{radii.lg}',
        },
      },
      'fill.surface': {
        value: {
          background: { _light: '#ffffff', _dark: '#1e1e1e' },
          boxShadow: { _light: '0 2px 8px rgba(102, 126, 234, 0.1)', _dark: '0 2px 8px rgba(102, 126, 234, 0.15)' },
          borderRadius: '{radii.lg}',
        },
      },
      'fill.solid': {
        value: {
          background: '{colors.brand.500}',
          color: 'white',
          borderRadius: '{radii.lg}',
        },
      },
      'outline.subtle': {
        value: {
          borderWidth: '1px',
          borderColor: { _light: 'rgba(0, 0, 0, 0.05)', _dark: 'rgba(255, 255, 255, 0.1)' },
          borderRadius: '{radii.lg}',
        },
      },
      'outline.solid': {
        value: {
          borderWidth: '2px',
          borderColor: { _light: 'rgba(0, 0, 0, 0.1)', _dark: 'rgba(255, 255, 255, 0.2)' },
          borderRadius: '{radii.lg}',
        },
      },
      disabled: {
        value: {
          opacity: '0.6',
          cursor: 'not-allowed',
          pointerEvents: 'none',
        },
      },
      'card.default': {
        value: {
          background: { _light: '#ffffff', _dark: '#1e1e1e' },
          borderWidth: '1px',
          borderColor: { _light: 'rgba(0, 0, 0, 0.05)', _dark: 'rgba(255, 255, 255, 0.1)' },
          borderRadius: '{radii.xl}',
          boxShadow: { _light: '0 2px 8px rgba(102, 126, 234, 0.1)', _dark: '0 2px 8px rgba(102, 126, 234, 0.15)' },
        },
      },
      'card.hover': {
        value: {
          background: { _light: '#ffffff', _dark: '#1e1e1e' },
          borderWidth: '1px',
          borderColor: { _light: 'rgba(102, 126, 234, 0.2)', _dark: 'rgba(102, 126, 234, 0.3)' },
          borderRadius: '{radii.xl}',
          boxShadow: { _light: '0 4px 12px rgba(102, 126, 234, 0.15)', _dark: '0 4px 12px rgba(102, 126, 234, 0.2)' },
          transform: 'translateY(-2px)',
        },
      },
      'card.selected': {
        value: {
          background: { _light: 'rgba(102, 126, 234, 0.05)', _dark: 'rgba(102, 126, 234, 0.1)' },
          borderWidth: '2px',
          borderColor: '{colors.brand.500}',
          borderRadius: '{radii.xl}',
          boxShadow: { _light: '0 4px 12px rgba(102, 126, 234, 0.15)', _dark: '0 4px 12px rgba(102, 126, 234, 0.2)' },
        },
      },
      'form.container': {
        value: {
          background: { _light: '#ffffff', _dark: '#121212' },
          borderRadius: '{radii.xl}',
          boxShadow: { _light: '0 4px 12px rgba(102, 126, 234, 0.15)', _dark: '0 4px 12px rgba(102, 126, 234, 0.2)' },
          padding: '{spacing.6}',
          maxWidth: '800px',
          margin: '{spacing.8} auto',
        },
      },
      overlay: {
        value: {
          background: { _light: 'rgba(0, 0, 0, 0.75)', _dark: 'rgba(0, 0, 0, 0.85)' },
        },
      },
    },

    // =====================================================================
    // ANIMATION STYLES
    // =====================================================================
    animationStyles: {
      'slide-fade-in': {
        value: {
          animationName: 'slide-from-bottom, fade-in',
          animationTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
        },
      },
      'slide-fade-out': {
        value: {
          animationName: 'slide-to-bottom, fade-out',
          animationTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
        },
      },
      'scale-fade-in': {
        value: {
          animationName: 'scale-in, fade-in',
          animationTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
        },
      },
      'scale-fade-out': {
        value: {
          animationName: 'scale-out, fade-out',
          animationTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
        },
      },
    },

    // =====================================================================
    // COMPONENT RECIPES (single-slot)
    // =====================================================================
    recipes: {
      // -----------------------------------------------------------------
      // Button recipe — full variant matrix
      // -----------------------------------------------------------------
      button: {
        base: {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '{spacing.2}',
          fontWeight: '{fontWeights.semibold}',
          borderRadius: '{radii.md}',
          cursor: 'pointer',
          transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
          _disabled: {
            opacity: 0.6,
            cursor: 'not-allowed',
            pointerEvents: 'none',
          },
        },
        variants: {
          variant: {
            gradient: {
              background: 'linear-gradient(135deg, {colors.brand.500} 0%, {colors.brand.700} 100%)',
              color: 'white',
              border: 'none',
              _hover: {
                opacity: 0.9,
                transform: 'translateY(-2px)',
                boxShadow: '{shadows.md}',
              },
              _active: { transform: 'translateY(0)', opacity: 0.95 },
            },
            secondary: {
              background: { _light: '#f8f9fa', _dark: '#2d2d2d' },
              color: { _light: '#4a5568', _dark: '#dee2e6' },
              border: '1px solid',
              borderColor: { _light: 'rgba(0, 0, 0, 0.1)', _dark: 'rgba(255, 255, 255, 0.2)' },
              _hover: {
                background: { _light: '#e9ecef', _dark: '#3d3d3d' },
                transform: 'translateY(-1px)',
              },
              _active: { transform: 'translateY(0)' },
            },
            tertiary: {
              background: 'transparent',
              color: '{colors.brand.500}',
              border: 'none',
              _hover: {
                background: { _light: 'rgba(102, 126, 234, 0.08)', _dark: 'rgba(102, 126, 234, 0.15)' },
              },
            },
            danger: {
              background: { _light: '#dc3545', _dark: '#fa5252' },
              color: 'white',
              border: 'none',
              _hover: {
                background: { _light: '#c82333', _dark: '#e03131' },
                transform: 'translateY(-1px)',
                boxShadow: '0 4px 12px rgba(220, 53, 69, 0.3)',
              },
              _active: { transform: 'translateY(0)' },
            },
            success: {
              background: { _light: '#28a745', _dark: '#40c057' },
              color: 'white',
              border: 'none',
              _hover: {
                background: { _light: '#218838', _dark: '#2f9e44' },
                transform: 'translateY(-1px)',
                boxShadow: '0 4px 12px rgba(40, 167, 69, 0.3)',
              },
              _active: { transform: 'translateY(0)' },
            },
            link: {
              background: 'transparent',
              color: '{colors.brand.500}',
              border: 'none',
              padding: '0',
              minHeight: 'auto',
              textDecoration: 'underline',
              _hover: { color: '{colors.brand.600}' },
            },
            outline: {
              background: 'transparent',
              color: '{colors.brand.500}',
              border: '2px solid',
              borderColor: '{colors.brand.500}',
              _hover: {
                background: { _light: 'rgba(102, 126, 234, 0.08)', _dark: 'rgba(102, 126, 234, 0.15)' },
                transform: 'translateY(-1px)',
              },
              _active: { transform: 'translateY(0)' },
            },
            ghost: {
              background: 'transparent',
              color: { _light: '#4a5568', _dark: '#dee2e6' },
              border: 'none',
              _hover: {
                background: { _light: 'rgba(0, 0, 0, 0.04)', _dark: 'rgba(255, 255, 255, 0.06)' },
              },
            },
          },
          size: {
            xs: {
              minHeight: '28px',
              paddingInline: '{spacing.2}',
              paddingBlock: '{spacing.0.5}',
              fontSize: '{fontSizes.xs}',
            },
            sm: {
              minHeight: '36px',
              paddingInline: '{spacing.2}',
              paddingBlock: '{spacing.1}',
              fontSize: '{fontSizes.sm}',
            },
            md: {
              minHeight: '44px',
              paddingInline: '{spacing.3}',
              paddingBlock: '{spacing.2}',
              fontSize: '{fontSizes.md}',
            },
            lg: {
              minHeight: '52px',
              paddingInline: '{spacing.5}',
              paddingBlock: '{spacing.3}',
              fontSize: '{fontSizes.lg}',
            },
          },
        },
        defaultVariants: {
          variant: 'gradient',
          size: 'md',
        },
      },

      // -----------------------------------------------------------------
      // Badge recipe
      // -----------------------------------------------------------------
      badge: {
        base: {
          display: 'inline-flex',
          alignItems: 'center',
          fontWeight: '{fontWeights.semibold}',
          borderRadius: '{radii.full}',
          whiteSpace: 'nowrap',
        },
        variants: {
          variant: {
            solid: {
              background: 'colorPalette.solid',
              color: 'colorPalette.contrast',
            },
            subtle: {
              background: 'colorPalette.subtle',
              color: 'colorPalette.fg',
            },
            outline: {
              background: 'transparent',
              border: '1px solid',
              borderColor: 'colorPalette.border',
              color: 'colorPalette.fg',
            },
            surface: {
              background: 'colorPalette.muted',
              color: 'colorPalette.fg',
              border: '1px solid',
              borderColor: 'colorPalette.border',
            },
          },
          size: {
            sm: { fontSize: '{fontSizes.xs}', px: '{spacing.1.5}', py: '1px' },
            md: { fontSize: '{fontSizes.sm}', px: '{spacing.2}', py: '{spacing.0.5}' },
            lg: { fontSize: '{fontSizes.md}', px: '{spacing.3}', py: '{spacing.1}' },
          },
        },
        defaultVariants: {
          variant: 'subtle',
          size: 'md',
        },
      },

      // -----------------------------------------------------------------
      // Heading recipe
      // -----------------------------------------------------------------
      heading: {
        base: {
          fontFamily: '{fonts.heading}',
          fontWeight: '{fontWeights.bold}',
          color: 'fg',
        },
        variants: {
          size: {
            xs:   { fontSize: '{fontSizes.sm}', lineHeight: '{lineHeights.snug}' },
            sm:   { fontSize: '{fontSizes.lg}', lineHeight: '{lineHeights.snug}' },
            md:   { fontSize: '{fontSizes.xl}', lineHeight: '{lineHeights.tight}' },
            lg:   { fontSize: '{fontSizes.2xl}', lineHeight: '{lineHeights.tight}' },
            xl:   { fontSize: '{fontSizes.3xl}', lineHeight: '{lineHeights.tight}' },
            '2xl': { fontSize: '{fontSizes.4xl}', lineHeight: '{lineHeights.none}' },
            '3xl': { fontSize: '{fontSizes.5xl}', lineHeight: '{lineHeights.none}' },
          },
        },
        defaultVariants: {
          size: 'lg',
        },
      },

      // -----------------------------------------------------------------
      // Input recipe (single-slot for input/textarea/select)
      // -----------------------------------------------------------------
      input: {
        base: {
          width: '100%',
          minHeight: '44px',
          padding: '{spacing.3} {spacing.4}',
          border: '1px solid',
          borderColor: { _light: 'rgba(0, 0, 0, 0.1)', _dark: 'rgba(255, 255, 255, 0.2)' },
          borderRadius: '{radii.md}',
          fontSize: '{fontSizes.md}',
          lineHeight: '{lineHeights.normal}',
          color: 'fg',
          background: { _light: '#ffffff', _dark: '#2d2d2d' },
          transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
          _placeholder: { color: 'fg.muted' },
          _focus: {
            outline: '2px solid',
            outlineColor: '{colors.brand.500}',
            outlineOffset: '2px',
            borderColor: '{colors.brand.500}',
            boxShadow: '0 0 0 3px rgba(102, 126, 234, 0.1)',
          },
          _disabled: {
            background: { _light: '#f8f9fa', _dark: '#1e1e1e' },
            color: 'fg.muted',
            cursor: 'not-allowed',
            opacity: 0.6,
          },
          _invalid: {
            borderColor: { _light: '#dc3545', _dark: '#fa5252' },
            boxShadow: '0 0 0 3px rgba(255, 107, 107, 0.08)',
          },
        },
        variants: {
          variant: {
            outline: {},  // default — base styles apply
            accent: {
              borderColor: '#9b76ff',
              _focus: {
                borderColor: '#9b76ff',
                boxShadow: '0 6px 20px rgba(155, 118, 255, 0.12)',
              },
            },
            filled: {
              background: { _light: '#f8f9fa', _dark: '#2d2d2d' },
              border: '1px solid transparent',
              _focus: {
                background: { _light: '#ffffff', _dark: '#1e1e1e' },
                borderColor: '{colors.brand.500}',
              },
            },
          },
          size: {
            sm: {
              minHeight: '36px',
              padding: '{spacing.2} {spacing.3}',
              fontSize: '{fontSizes.sm}',
            },
            md: {
              minHeight: '44px',
              padding: '{spacing.3} {spacing.4}',
              fontSize: '{fontSizes.md}',
            },
            lg: {
              minHeight: '52px',
              padding: '{spacing.4} {spacing.5}',
              fontSize: '{fontSizes.lg}',
            },
          },
        },
        defaultVariants: {
          variant: 'outline',
          size: 'md',
        },
      },

      // -----------------------------------------------------------------
      // Checkbox recipe
      // -----------------------------------------------------------------
      checkbox: {
        base: {
          display: 'inline-flex',
          cursor: 'pointer',
          _disabled: { opacity: 0.4, cursor: 'not-allowed' },
        },
        variants: {
          variant: {
            outline: {
              border: '2px solid',
              borderColor: { _light: 'rgba(0, 0, 0, 0.2)', _dark: 'rgba(255, 255, 255, 0.3)' },
              background: { _light: '#ffffff', _dark: 'transparent' },
              borderRadius: '{radii.xs}',
              _checked: {
                background: 'colorPalette.solid',
                borderColor: 'transparent',
                color: 'white',
              },
            },
            subtle: {
              background: { _light: 'rgba(102, 126, 234, 0.12)', _dark: 'rgba(102, 126, 234, 0.15)' },
              border: 'none',
              borderRadius: '{radii.xs}',
              _checked: {
                background: { _light: 'rgba(102, 126, 234, 0.2)', _dark: 'rgba(102, 126, 234, 0.25)' },
                color: 'colorPalette.solid',
              },
            },
            solid: {
              background: 'colorPalette.solid',
              border: 'none',
              borderRadius: '{radii.xs}',
              color: 'rgba(255, 255, 255, 0.35)',
              _checked: { color: 'white' },
            },
          },
          size: {
            sm: { width: '18px', height: '18px' },
            md: { width: '22px', height: '22px' },
            lg: { width: '26px', height: '26px' },
          },
        },
        defaultVariants: {
          variant: 'outline',
          size: 'md',
        },
      },
    },

    // =====================================================================
    // SLOT RECIPES (multi-part components)
    // =====================================================================
    slotRecipes: {
      // -----------------------------------------------------------------
      // Alert slot recipe
      // Chakra v3 slots: root, content, indicator, title, description
      // -----------------------------------------------------------------
      alert: {
        slots: ['root', 'content', 'indicator', 'title', 'description'],
        base: {
          root: {
            display: 'flex',
            alignItems: 'flex-start',
            gap: '{spacing.3}',
            padding: '{spacing.4} {spacing.5}',
            marginBottom: '{spacing.4}',
            borderRadius: '{radii.md}',
            border: '1px solid transparent',
            position: 'relative',
          },
          indicator: {
            flexShrink: 0,
            fontSize: '{fontSizes.xl}',
          },
          content: {
            flex: 1,
            minWidth: 0,
          },
          title: {
            fontWeight: '{fontWeights.semibold}',
            marginBottom: '{spacing.1}',
          },
          description: {
            lineHeight: '{lineHeights.normal}',
          },
        },
        variants: {
          status: {
            info: {
              root: {
                background: { _light: 'rgba(23, 162, 184, 0.1)', _dark: 'rgba(51, 154, 240, 0.15)' },
                borderColor: { _light: 'rgba(23, 162, 184, 0.3)', _dark: 'rgba(51, 154, 240, 0.3)' },
                color: { _light: '#0c5460', _dark: '#74c0fc' },
              },
              indicator: { color: { _light: '#17a2b8', _dark: '#339af0' } },
            },
            success: {
              root: {
                background: { _light: 'rgba(40, 167, 69, 0.1)', _dark: 'rgba(64, 192, 87, 0.15)' },
                borderColor: { _light: 'rgba(40, 167, 69, 0.3)', _dark: 'rgba(64, 192, 87, 0.3)' },
                color: { _light: '#155724', _dark: '#8ce99a' },
              },
              indicator: { color: { _light: '#28a745', _dark: '#40c057' } },
            },
            warning: {
              root: {
                background: { _light: 'rgba(255, 193, 7, 0.1)', _dark: 'rgba(255, 212, 59, 0.15)' },
                borderColor: { _light: 'rgba(255, 193, 7, 0.3)', _dark: 'rgba(255, 212, 59, 0.3)' },
                color: { _light: '#856404', _dark: '#ffe066' },
              },
              indicator: { color: { _light: '#ffc107', _dark: '#ffd43b' } },
            },
            error: {
              root: {
                background: { _light: 'rgba(220, 53, 69, 0.1)', _dark: 'rgba(250, 82, 82, 0.15)' },
                borderColor: { _light: 'rgba(220, 53, 69, 0.3)', _dark: 'rgba(250, 82, 82, 0.3)' },
                color: { _light: '#721c24', _dark: '#ffa8a8' },
              },
              indicator: { color: { _light: '#dc3545', _dark: '#fa5252' } },
            },
            neutral: {
              root: {
                background: { _light: '#f8f9fa', _dark: '#2d2d2d' },
                borderColor: { _light: 'rgba(0, 0, 0, 0.1)', _dark: 'rgba(255, 255, 255, 0.2)' },
                color: 'fg',
              },
              indicator: { color: 'fg.muted' },
            },
          },
          variant: {
            subtle: {},  // Default — status styles apply directly
            solid: {
              root: { color: 'white' },
              indicator: { color: 'white' },
            },
            outline: {
              root: { background: 'transparent' },
            },
            surface: {
              root: { borderWidth: '1px' },
            },
          },
          size: {
            sm: {
              root: { padding: '{spacing.2} {spacing.3}', fontSize: '{fontSizes.sm}' },
              indicator: { fontSize: '{fontSizes.md}' },
            },
            md: {
              root: { padding: '{spacing.4} {spacing.5}' },
              indicator: { fontSize: '{fontSizes.xl}' },
            },
            lg: {
              root: { padding: '{spacing.6} {spacing.8}', fontSize: '{fontSizes.lg}' },
              indicator: { fontSize: '{fontSizes.2xl}' },
            },
          },
        },
        defaultVariants: {
          status: 'info',
          variant: 'subtle',
          size: 'md',
        },
      },

      // -----------------------------------------------------------------
      // Dialog (Modal) slot recipe
      // Chakra v3 slots: backdrop, positioner, content, header, body,
      //                   footer, closeTrigger, title, description
      // -----------------------------------------------------------------
      dialog: {
        slots: ['backdrop', 'positioner', 'content', 'header', 'body', 'footer', 'closeTrigger', 'title', 'description'],
        base: {
          backdrop: {
            background: { _light: 'rgba(0, 0, 0, 0.75)', _dark: 'rgba(0, 0, 0, 0.85)' },
            position: 'fixed',
            inset: 0,
            zIndex: '{zIndex.modalBackdrop}',
          },
          positioner: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'fixed',
            inset: 0,
            zIndex: '{zIndex.modal}',
            overflow: 'auto',
            padding: '{spacing.4}',
          },
          content: {
            background: { _light: '#ffffff', _dark: '#1e1e1e' },
            borderRadius: '{radii.lg}',
            boxShadow: '{shadows.lg}',
            maxHeight: '90vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
          },
          header: {
            background: 'linear-gradient(135deg, {colors.brand.500} 0%, {colors.brand.700} 100%)',
            backgroundSize: '400% 400%',
            color: 'white',
            padding: '{spacing.4} {spacing.5}',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          },
          title: {
            fontWeight: '{fontWeights.bold}',
            color: 'white',
            fontSize: 'clamp(1rem, 2vw, 1.25rem)',
          },
          description: {
            color: 'fg.secondary',
            fontSize: '{fontSizes.sm}',
            lineHeight: '{lineHeights.normal}',
          },
          body: {
            padding: '{spacing.5}',
            overflow: 'auto',
            flex: 1,
            color: 'fg',
          },
          footer: {
            borderTop: '1px solid',
            borderColor: { _light: 'rgba(0, 0, 0, 0.1)', _dark: 'rgba(255, 255, 255, 0.2)' },
            padding: '{spacing.4} {spacing.5}',
            background: { _light: '#f8f9fa', _dark: '#1e1e1e' },
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '{spacing.3}',
          },
          closeTrigger: {
            width: '44px',
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '{radii.sm}',
            color: 'white',
            background: 'transparent',
            cursor: 'pointer',
            transition: 'all 200ms',
            _hover: {
              background: 'rgba(255, 255, 255, 0.15)',
              transform: 'scale(1.05)',
            },
            _active: { transform: 'scale(0.95)' },
          },
        },
        variants: {
          size: {
            sm: { content: { maxWidth: '320px', width: '100%' } },
            md: { content: { maxWidth: '560px', width: '100%' } },
            lg: { content: { maxWidth: '800px', width: '100%' } },
            xl: { content: { maxWidth: '1200px', width: '95%' } },
            full: {
              content: {
                maxWidth: '100%',
                width: '100%',
                height: '100dvh',
                maxHeight: '100dvh',
                borderRadius: 0,
              },
              positioner: { padding: 0 },
            },
          },
          scrollBehavior: {
            inside: {
              body: { overflowY: 'auto', maxHeight: 'calc(90vh - 120px)' },
            },
            outside: {
              positioner: { overflow: 'auto' },
              content: { maxHeight: 'none' },
            },
          },
          centered: {
            true: {
              positioner: { alignItems: 'center' },
            },
            false: {
              positioner: { alignItems: 'flex-start', paddingTop: '{spacing.16}' },
            },
          },
        },
        defaultVariants: {
          size: 'md',
          scrollBehavior: 'inside',
          centered: true,
        },
      },

      // -----------------------------------------------------------------
      // Table slot recipe
      // Chakra v3 slots: root, header, body, row, columnHeader, cell,
      //                   footer, caption
      // -----------------------------------------------------------------
      table: {
        slots: ['root', 'header', 'body', 'row', 'columnHeader', 'cell', 'footer', 'caption'],
        base: {
          root: {
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '{fontSizes.md}',
          },
          columnHeader: {
            fontWeight: '{fontWeights.semibold}',
            color: 'fg.secondary',
            background: { _light: '#f8f9fa', _dark: '#1e1e1e' },
            borderBottom: '2px solid',
            borderColor: { _light: 'rgba(0, 0, 0, 0.1)', _dark: 'rgba(255, 255, 255, 0.2)' },
            textAlign: 'start',
            position: 'sticky',
            top: 0,
            zIndex: 10,
          },
          cell: {
            borderBottom: '1px solid',
            borderColor: { _light: 'rgba(0, 0, 0, 0.05)', _dark: 'rgba(255, 255, 255, 0.1)' },
          },
          row: {
            transition: 'background-color 150ms',
          },
          footer: {
            fontWeight: '{fontWeights.semibold}',
          },
          caption: {
            color: 'fg.muted',
            fontSize: '{fontSizes.sm}',
            padding: '{spacing.2}',
          },
        },
        variants: {
          variant: {
            line: {},  // Default — base styles only
            outline: {
              root: {
                border: '1px solid',
                borderColor: { _light: 'rgba(0, 0, 0, 0.1)', _dark: 'rgba(255, 255, 255, 0.2)' },
                borderRadius: '{radii.md}',
                overflow: 'hidden',
              },
              cell: {
                borderRight: '1px solid',
                borderColor: { _light: 'rgba(0, 0, 0, 0.05)', _dark: 'rgba(255, 255, 255, 0.1)' },
                _last: { borderRight: 'none' },
              },
              columnHeader: {
                borderRight: '1px solid',
                borderColor: { _light: 'rgba(0, 0, 0, 0.05)', _dark: 'rgba(255, 255, 255, 0.1)' },
                _last: { borderRight: 'none' },
              },
            },
          },
          size: {
            sm: {
              columnHeader: { padding: '{spacing.2} {spacing.3}', fontSize: '{fontSizes.sm}' },
              cell: { padding: '{spacing.2} {spacing.3}', fontSize: '{fontSizes.sm}' },
            },
            md: {
              columnHeader: { padding: '{spacing.3} {spacing.4}' },
              cell: { padding: '{spacing.3} {spacing.4}' },
            },
            lg: {
              columnHeader: { padding: '{spacing.4} {spacing.5}', fontSize: '{fontSizes.lg}' },
              cell: { padding: '{spacing.4} {spacing.5}', fontSize: '{fontSizes.lg}' },
            },
          },
          interactive: {
            true: {
              row: {
                _hover: {
                  background: { _light: 'rgba(102, 126, 234, 0.05)', _dark: 'rgba(255, 255, 255, 0.05)' },
                },
              },
            },
          },
          striped: {
            true: {
              row: {
                _odd: {
                  background: { _light: '#f8f9fa', _dark: 'rgba(255, 255, 255, 0.02)' },
                },
              },
            },
          },
          stickyHeader: {
            true: {
              columnHeader: { position: 'sticky', top: 0, zIndex: 10 },
            },
          },
        },
        defaultVariants: {
          variant: 'line',
          size: 'md',
          interactive: true,
        },
      },

      // -----------------------------------------------------------------
      // Tabs slot recipe
      // Chakra v3 slots: root, list, trigger, content, indicator
      // -----------------------------------------------------------------
      tabs: {
        slots: ['root', 'list', 'trigger', 'content', 'indicator'],
        base: {
          list: {
            display: 'flex',
            gap: '{spacing.1}',
            borderBottom: '2px solid',
            borderColor: { _light: 'rgba(0, 0, 0, 0.05)', _dark: 'rgba(255, 255, 255, 0.1)' },
          },
          trigger: {
            padding: '{spacing.2} {spacing.4}',
            fontWeight: '{fontWeights.medium}',
            color: 'fg.muted',
            cursor: 'pointer',
            background: 'transparent',
            border: 'none',
            borderBottom: '2px solid transparent',
            marginBottom: '-2px',
            transition: 'all 200ms',
            _hover: { color: '{colors.brand.500}' },
            _selected: {
              color: '{colors.brand.500}',
              borderBottomColor: '{colors.brand.500}',
              fontWeight: '{fontWeights.semibold}',
            },
            _disabled: { opacity: 0.5, cursor: 'not-allowed' },
          },
          content: {
            padding: '{spacing.4} 0',
          },
          indicator: {
            background: '{colors.brand.500}',
            height: '2px',
            bottom: '-2px',
          },
        },
        variants: {
          variant: {
            line: {},  // Default — base styles apply
            enclosed: {
              list: { borderBottom: 'none' },
              trigger: {
                border: '1px solid transparent',
                borderBottom: 'none',
                borderRadius: '{radii.md} {radii.md} 0 0',
                _selected: {
                  border: '1px solid',
                  borderColor: { _light: 'rgba(0, 0, 0, 0.1)', _dark: 'rgba(255, 255, 255, 0.2)' },
                  borderBottom: '1px solid',
                  borderBottomColor: { _light: '#ffffff', _dark: '#1e1e1e' },
                  background: { _light: '#ffffff', _dark: '#1e1e1e' },
                },
              },
            },
            subtle: {
              list: { borderBottom: 'none', gap: '{spacing.1}' },
              trigger: {
                borderBottom: 'none',
                borderRadius: '{radii.md}',
                _selected: {
                  background: { _light: 'rgba(102, 126, 234, 0.1)', _dark: 'rgba(102, 126, 234, 0.15)' },
                  color: '{colors.brand.500}',
                },
              },
            },
            outline: {
              trigger: {
                border: '1px solid',
                borderColor: { _light: 'rgba(0, 0, 0, 0.1)', _dark: 'rgba(255, 255, 255, 0.2)' },
                borderRadius: '{radii.md}',
                marginBottom: 0,
                _selected: {
                  borderColor: '{colors.brand.500}',
                  color: '{colors.brand.500}',
                },
              },
            },
          },
          size: {
            sm: {
              trigger: { padding: '{spacing.1} {spacing.3}', fontSize: '{fontSizes.sm}' },
            },
            md: {
              trigger: { padding: '{spacing.2} {spacing.4}', fontSize: '{fontSizes.md}' },
            },
            lg: {
              trigger: { padding: '{spacing.3} {spacing.5}', fontSize: '{fontSizes.lg}' },
            },
          },
          fitted: {
            true: {
              trigger: { flex: 1, textAlign: 'center' },
            },
          },
        },
        defaultVariants: {
          variant: 'line',
          size: 'md',
        },
      },

      // -----------------------------------------------------------------
      // Accordion slot recipe
      // Chakra v3 slots: root, item, itemTrigger, itemContent, itemIndicator, itemBody
      // -----------------------------------------------------------------
      accordion: {
        slots: ['root', 'item', 'itemTrigger', 'itemContent', 'itemIndicator', 'itemBody'],
        base: {
          root: {
            width: '100%',
          },
          item: {
            background: { _light: '#f8f9fa', _dark: '#1e1e1e' },
            borderRadius: '{radii.md}',
            marginBottom: '{spacing.3}',
            overflow: 'hidden',
          },
          itemTrigger: {
            display: 'flex',
            alignItems: 'center',
            gap: '{spacing.3}',
            width: '100%',
            padding: '{spacing.4}',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'fg',
            fontWeight: '{fontWeights.semibold}',
            textAlign: 'start',
            transition: 'all 200ms',
            _expanded: {
              background: 'linear-gradient(90deg, {colors.brand.500} 0%, {colors.brand.600} 100%)',
              color: 'white',
            },
          },
          itemIndicator: {
            marginLeft: 'auto',
            transition: 'transform 200ms',
            _open: { transform: 'rotate(-180deg)' },
          },
          itemContent: {
            overflow: 'hidden',
          },
          itemBody: {
            background: { _light: '#ffffff', _dark: '#121212' },
            color: 'fg',
            padding: '{spacing.4}',
            borderTop: '1px dashed',
            borderColor: { _light: 'rgba(0, 0, 0, 0.1)', _dark: 'rgba(255, 255, 255, 0.2)' },
          },
        },
        variants: {
          variant: {
            subtle: {},  // Default — base styles
            enclosed: {
              item: {
                border: '1px solid',
                borderColor: { _light: 'rgba(0, 0, 0, 0.1)', _dark: 'rgba(255, 255, 255, 0.2)' },
              },
            },
          },
        },
        defaultVariants: {
          variant: 'subtle',
        },
      },

      // -----------------------------------------------------------------
      // Progress slot recipe
      // Chakra v3 slots: root, track, range, label, valueText
      // -----------------------------------------------------------------
      progress: {
        slots: ['root', 'track', 'range', 'label', 'valueText'],
        base: {
          root: {
            display: 'flex',
            alignItems: 'center',
            gap: '{spacing.3}',
            width: '100%',
          },
          track: {
            flex: 1,
            background: { _light: '#e9ecef', _dark: '#2d2d2d' },
            borderRadius: '{radii.full}',
            overflow: 'hidden',
          },
          range: {
            height: '100%',
            borderRadius: '{radii.full}',
            background: 'colorPalette.solid',
            transition: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)',
          },
          label: {
            fontSize: '{fontSizes.sm}',
            fontWeight: '{fontWeights.medium}',
            color: 'fg.secondary',
          },
          valueText: {
            fontSize: '{fontSizes.sm}',
            fontWeight: '{fontWeights.semibold}',
            minWidth: '45px',
            textAlign: 'end',
          },
        },
        variants: {
          variant: {
            outline: {
              track: {
                border: '1px solid',
                borderColor: { _light: 'rgba(0, 0, 0, 0.1)', _dark: 'rgba(255, 255, 255, 0.2)' },
              },
            },
            subtle: {},  // Default — base styles
          },
          size: {
            xs: { track: { height: '4px' } },
            sm: { track: { height: '8px' } },
            md: { track: { height: '12px' } },
            lg: { track: { height: '16px' } },
            xl: { track: { height: '20px' } },
          },
          shape: {
            square: {
              track: { borderRadius: 0 },
              range: { borderRadius: 0 },
            },
            rounded: {
              track: { borderRadius: '{radii.sm}' },
              range: { borderRadius: '{radii.sm}' },
            },
            full: {
              track: { borderRadius: '{radii.full}' },
              range: { borderRadius: '{radii.full}' },
            },
          },
          striped: {
            true: {
              range: {
                backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,0.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.15) 75%, transparent 75%, transparent)',
                backgroundSize: '1rem 1rem',
              },
            },
          },
          animated: {
            true: {
              range: {
                animation: 'progress-bar-stripes 1s linear infinite',
              },
            },
          },
        },
        defaultVariants: {
          variant: 'subtle',
          size: 'md',
          shape: 'full',
        },
      },

      // -----------------------------------------------------------------
      // Tooltip slot recipe
      // Chakra v3 slots: trigger, content, arrow, arrowTip
      // -----------------------------------------------------------------
      tooltip: {
        slots: ['trigger', 'content', 'arrow', 'arrowTip'],
        base: {
          content: {
            background: { _light: '#2d2d2d', _dark: '#2d2d2d' },
            color: 'white',
            fontSize: '{fontSizes.sm}',
            borderRadius: '{radii.sm}',
            paddingInline: '{spacing.3}',
            paddingBlock: '{spacing.2}',
            boxShadow: '{shadows.md}',
            maxWidth: '300px',
            zIndex: '{zIndex.tooltip}',
          },
          arrow: {
            '--arrow-background': { _light: '#2d2d2d', _dark: '#2d2d2d' },
          },
        },
      },

      // -----------------------------------------------------------------
      // Card slot recipe
      // Chakra v3 slots: root, header, body, footer, title, description
      // -----------------------------------------------------------------
      card: {
        slots: ['root', 'header', 'body', 'footer', 'title', 'description'],
        base: {
          root: {
            background: { _light: '#ffffff', _dark: '#1e1e1e' },
            borderRadius: '{radii.xl}',
            border: '1px solid',
            borderColor: { _light: 'rgba(0, 0, 0, 0.05)', _dark: 'rgba(255, 255, 255, 0.1)' },
            boxShadow: { _light: '0 2px 8px rgba(102, 126, 234, 0.1)', _dark: '0 2px 8px rgba(102, 126, 234, 0.15)' },
            overflow: 'hidden',
            transition: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)',
          },
          header: {
            padding: '{spacing.4} {spacing.5}',
            borderBottom: '1px solid',
            borderColor: { _light: 'rgba(0, 0, 0, 0.05)', _dark: 'rgba(255, 255, 255, 0.1)' },
          },
          body: {
            padding: '{spacing.4} {spacing.5}',
          },
          footer: {
            padding: '{spacing.4} {spacing.5}',
            borderTop: '1px solid',
            borderColor: { _light: 'rgba(0, 0, 0, 0.05)', _dark: 'rgba(255, 255, 255, 0.1)' },
          },
          title: {
            fontWeight: '{fontWeights.semibold}',
            fontSize: '{fontSizes.lg}',
          },
          description: {
            color: 'fg.muted',
            fontSize: '{fontSizes.sm}',
          },
        },
        variants: {
          variant: {
            elevated: {
              root: {
                border: 'none',
                boxShadow: { _light: '0 4px 12px rgba(102, 126, 234, 0.15)', _dark: '0 4px 12px rgba(102, 126, 234, 0.2)' },
              },
            },
            outline: {
              root: {
                boxShadow: 'none',
                borderWidth: '1px',
              },
            },
            subtle: {
              root: {
                background: { _light: '#f8f9fa', _dark: '#2d2d2d' },
                border: 'none',
                boxShadow: 'none',
              },
            },
            unstyled: {
              root: {
                background: 'transparent',
                border: 'none',
                boxShadow: 'none',
                padding: 0,
                borderRadius: 0,
              },
            },
          },
          size: {
            sm: {
              header: { padding: '{spacing.3} {spacing.4}' },
              body: { padding: '{spacing.3} {spacing.4}' },
              footer: { padding: '{spacing.3} {spacing.4}' },
              title: { fontSize: '{fontSizes.md}' },
            },
            md: {
              header: { padding: '{spacing.4} {spacing.5}' },
              body: { padding: '{spacing.4} {spacing.5}' },
              footer: { padding: '{spacing.4} {spacing.5}' },
            },
            lg: {
              header: { padding: '{spacing.5} {spacing.6}' },
              body: { padding: '{spacing.5} {spacing.6}' },
              footer: { padding: '{spacing.5} {spacing.6}' },
              title: { fontSize: '{fontSizes.xl}' },
            },
          },
        },
        defaultVariants: {
          variant: 'elevated',
          size: 'md',
        },
      },

      // -----------------------------------------------------------------
      // Toast slot recipe (Toaster)
      // -----------------------------------------------------------------
      toast: {
        slots: ['root', 'title', 'description', 'closeTrigger', 'actionTrigger'],
        base: {
          root: {
            display: 'flex',
            alignItems: 'flex-start',
            gap: '{spacing.3}',
            minWidth: '300px',
            maxWidth: '500px',
            borderRadius: '{radii.md}',
            boxShadow: '{shadows.md}',
            padding: '{spacing.3} {spacing.4}',
            color: 'white',
            position: 'relative',
            overflow: 'hidden',
          },
          title: {
            fontWeight: '{fontWeights.semibold}',
            lineHeight: '{lineHeights.relaxed}',
          },
          description: {
            fontSize: '{fontSizes.sm}',
            lineHeight: '{lineHeights.normal}',
            opacity: 0.9,
          },
          closeTrigger: {
            opacity: 0.8,
            cursor: 'pointer',
            background: 'transparent',
            border: 'none',
            color: 'inherit',
            _hover: { opacity: 1, background: 'rgba(255, 255, 255, 0.2)' },
            borderRadius: '{radii.sm}',
            padding: '{spacing.1}',
          },
          actionTrigger: {
            fontWeight: '{fontWeights.semibold}',
            textDecoration: 'underline',
            cursor: 'pointer',
            background: 'transparent',
            border: 'none',
            color: 'inherit',
          },
        },
        variants: {
          status: {
            info: {
              root: { background: { _light: '#17a2b8', _dark: '#339af0' } },
            },
            success: {
              root: { background: { _light: '#28a745', _dark: '#40c057' } },
            },
            warning: {
              root: {
                background: { _light: '#ffc107', _dark: '#ffd43b' },
                color: { _light: '#1a202c', _dark: '#000000' },
              },
            },
            error: {
              root: { background: { _light: '#dc3545', _dark: '#fa5252' } },
            },
          },
        },
        defaultVariants: {
          status: 'info',
        },
      },
    },
  },

  // -----------------------------------------------------------------------
  // Global CSS
  // -----------------------------------------------------------------------
  globalCss: {
    body: {
      bg: 'bg',
      color: 'fg',
      fontFamily: 'body',
      lineHeight: 'normal',
      WebkitFontSmoothing: 'antialiased',
      MozOsxFontSmoothing: 'grayscale',
    },
    svg: {
      display: 'inline-block',
      verticalAlign: 'middle',
    },
    '*:focus-visible': {
      outline: '2px solid',
      outlineColor: 'brand.focusRing',
      outlineOffset: '2px',
    },
  },
});

// ---------------------------------------------------------------------------
// Create theme system
// ---------------------------------------------------------------------------
const uiThemeSystem = createSystem(defaultConfig, config);

export default uiThemeSystem;

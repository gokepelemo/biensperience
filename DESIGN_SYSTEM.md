# Biensperience Design System

*A comprehensive guide to building a consistent, accessible, and beautiful UI for Biensperience*

**Version**: 1.0.0
**Last Updated**: November 1, 2025

---

## Table of Contents

1. [Introduction](#introduction)
2. [Design Principles](#design-principles)
3. [Color System](#color-system)
4. [Typography](#typography)
5. [Spacing & Layout](#spacing--layout)
6. [Components](#components)
7. [Dark Mode](#dark-mode)
8. [Accessibility](#accessibility)
9. [Motion & Animation](#motion--animation)
10. [Iconography](#iconography)

---

## Introduction

This design system defines the visual language, patterns, and components for Biensperience. It ensures consistency across the application while maintaining flexibility for growth and iteration.

### Goals

- **Consistency**: Every component looks and behaves predictably
- **Accessibility**: WCAG 2.1 Level AA compliance minimum
- **Maintainability**: Clear patterns reduce technical debt
- **Scalability**: System grows with the product

---

## Design Principles

### 1. **User-Centric**
Every design decision prioritizes user needs and real-world travel planning workflows.

### 2. **Progressive Enhancement**
Core functionality works everywhere; enhancements layer on top.

### 3. **Performance First**
Fast load times and smooth interactions are non-negotiable.

### 4. **Accessible by Default**
Accessibility isn't optional—it's baked into every component.

### 5. **Content First**
Design serves content; content doesn't serve design.

---

## Color System

### Brand Colors

#### Primary (Purple)
```css
--color-primary-100: #f5f3ff;  /* Lightest */
--color-primary-200: #ede9fe;
--color-primary-300: #ddd6fe;
--color-primary-400: #c4b5fd;
--color-primary-500: #a78bfa;  /* Base */
--color-primary-600: #6f42c1;  /* Brand Purple */
--color-primary-700: #5a32a0;
--color-primary-800: #4a2880;
--color-primary-900: #3b1f66;  /* Darkest */
```

**Usage**: Primary actions, links, focus states, brand elements

#### Secondary (Blue-Purple Gradient)
```css
--color-secondary-start: #667eea;
--color-secondary-end: #764ba2;
```

**Usage**: Decorative elements, cards, headers

### Semantic Colors

#### Success (Green)
```css
--color-success-light: #d1fae5;
--color-success: #10b981;
--color-success-dark: #047857;
```

**Usage**: Success messages, confirmations, completed states

#### Warning (Amber)
```css
--color-warning-light: #fef3c7;
--color-warning: #f59e0b;
--color-warning-dark: #d97706;
```

**Usage**: Warnings, cautions, pending states

#### Error (Red)
```css
--color-error-light: #fee2e2;
--color-error: #ef4444;
--color-error-dark: #dc2626;
```

**Usage**: Errors, destructive actions, validation failures

#### Info (Blue)
```css
--color-info-light: #dbeafe;
--color-info: #3b82f6;
--color-info-dark: #1d4ed8;
```

**Usage**: Informational messages, neutral notifications

### Neutral Colors (Light Mode)

```css
--color-white: #ffffff;
--color-gray-50: #f9fafb;
--color-gray-100: #f3f4f6;
--color-gray-200: #e5e7eb;
--color-gray-300: #d1d5db;
--color-gray-400: #9ca3af;
--color-gray-500: #6b7280;
--color-gray-600: #4b5563;
--color-gray-700: #374151;
--color-gray-800: #1f2937;
--color-gray-900: #111827;
--color-black: #000000;
```

### Dark Mode Palette

```css
/* Dark Mode Backgrounds */
--color-dark-bg-primary: #0f172a;      /* Slate-900 */
--color-dark-bg-secondary: #1e293b;    /* Slate-800 */
--color-dark-bg-tertiary: #334155;     /* Slate-700 */
--color-dark-bg-elevated: #475569;     /* Slate-600 */

/* Dark Mode Surfaces */
--color-dark-surface-1: #1e293b;       /* Elevation 1 */
--color-dark-surface-2: #2d3748;       /* Elevation 2 */
--color-dark-surface-3: #3a4556;       /* Elevation 3 */

/* Dark Mode Text */
--color-dark-text-primary: #f1f5f9;    /* Slate-100 */
--color-dark-text-secondary: #cbd5e1;  /* Slate-300 */
--color-dark-text-tertiary: #94a3b8;   /* Slate-400 */
--color-dark-text-muted: #64748b;      /* Slate-500 */

/* Dark Mode Borders */
--color-dark-border: #475569;          /* Slate-600 */
--color-dark-border-light: #334155;    /* Slate-700 */
```

### Color Usage Guidelines

#### Contrast Requirements
- **Text on Backgrounds**: Minimum 4.5:1 contrast ratio
- **Large Text (18pt+)**: Minimum 3:1 contrast ratio
- **Interactive Elements**: Minimum 3:1 contrast ratio

#### Dark Mode Specific Requirements

**Problem**: Travel tips and information visibility is poor in dark mode.

**Solution**: Enhance contrast for content containers

```css
/* Travel Tips Container - Dark Mode */
.travel-tip-card {
  background: var(--color-dark-surface-2);
  border: 1px solid var(--color-dark-border);
  color: var(--color-dark-text-primary);
}

.travel-tip-card .tip-label {
  color: var(--color-dark-text-secondary);
  font-weight: 600;
}

.travel-tip-card .tip-value {
  color: var(--color-dark-text-primary);
  font-weight: 400;
}

/* Enhanced contrast for important information */
.travel-tip-card.tip-important {
  background: var(--color-dark-surface-3);
  border-color: var(--color-primary-600);
  box-shadow: 0 0 0 1px var(--color-primary-600);
}
```

---

## Typography

### Font Families

```css
/* Primary Font (UI Text) */
--font-family-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto',
                    'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans',
                    'Droid Sans', 'Helvetica Neue', sans-serif;

/* Monospace Font (Code) */
--font-family-mono: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Mono',
                    'Droid Sans Mono', 'Source Code Pro', monospace;
```

### Type Scale

Use a fluid type scale for responsive typography:

```css
/* Headings */
--font-size-h1: clamp(2rem, 5vw, 3rem);          /* 32px - 48px */
--font-size-h2: clamp(1.75rem, 4vw, 2.5rem);     /* 28px - 40px */
--font-size-h3: clamp(1.5rem, 3vw, 2rem);        /* 24px - 32px */
--font-size-h4: clamp(1.25rem, 2.5vw, 1.75rem);  /* 20px - 28px */
--font-size-h5: clamp(1.125rem, 2vw, 1.5rem);    /* 18px - 24px */
--font-size-h6: clamp(1rem, 1.5vw, 1.25rem);     /* 16px - 20px */

/* Body Text */
--font-size-body-lg: clamp(1.125rem, 1.5vw, 1.25rem);  /* 18px - 20px */
--font-size-body: clamp(0.875rem, 1.5vw, 1rem);        /* 14px - 16px */
--font-size-body-sm: clamp(0.875rem, 1.25vw, 0.9375rem); /* 14px - 15px */

/* UI Elements */
--font-size-button: clamp(0.875rem, 1.5vw, 1rem);    /* 14px - 16px */
--font-size-label: clamp(0.875rem, 1.5vw, 1rem);     /* 14px - 16px */
--font-size-caption: clamp(0.75rem, 1.25vw, 0.875rem); /* 12px - 14px */
```

### Font Weights

```css
--font-weight-light: 300;
--font-weight-regular: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
--font-weight-bold: 700;
```

### Line Heights

```css
--line-height-tight: 1.25;    /* Headings */
--line-height-normal: 1.5;    /* Body text */
--line-height-relaxed: 1.75;  /* Long-form content */
```

### Dark Mode Typography Adjustments

```css
@media (prefers-color-scheme: dark) {
  body {
    /* Slightly increase font weight for better readability */
    font-weight: 450;

    /* Reduce pure white text glare */
    color: var(--color-dark-text-primary);
  }

  h1, h2, h3, h4, h5, h6 {
    /* Headings need full brightness */
    color: var(--color-dark-text-primary);
  }

  p, span, label {
    /* Body text slightly dimmed */
    color: var(--color-dark-text-secondary);
  }
}
```

---

## Spacing & Layout

### Spacing Scale

Use a consistent 8px base unit:

```css
--spacing-1: 0.25rem;   /* 4px */
--spacing-2: 0.5rem;    /* 8px */
--spacing-3: 0.75rem;   /* 12px */
--spacing-4: 1rem;      /* 16px */
--spacing-5: 1.25rem;   /* 20px */
--spacing-6: 1.5rem;    /* 24px */
--spacing-8: 2rem;      /* 32px */
--spacing-10: 2.5rem;   /* 40px */
--spacing-12: 3rem;     /* 48px */
--spacing-16: 4rem;     /* 64px */
--spacing-20: 5rem;     /* 80px */
```

### Container Widths

```css
--container-sm: 640px;
--container-md: 768px;
--container-lg: 1024px;
--container-xl: 1280px;
--container-2xl: 1536px;
```

### Border Radius

```css
--radius-sm: 0.25rem;   /* 4px */
--radius-md: 0.5rem;    /* 8px */
--radius-lg: 0.75rem;   /* 12px */
--radius-xl: 1rem;      /* 16px */
--radius-2xl: 1.5rem;   /* 24px */
--radius-full: 9999px;  /* Pills/Circles */
```

### Z-Index Scale

```css
--z-index-dropdown: 1000;
--z-index-sticky: 1020;
--z-index-fixed: 1030;
--z-index-modal-backdrop: 1040;
--z-index-modal: 1050;
--z-index-popover: 1060;
--z-index-tooltip: 1070;
--z-index-toast: 1080;
```

---

## Components

### Buttons

#### Button Variants

```css
/* Primary Button */
.btn-primary {
  background: linear-gradient(135deg, var(--color-primary-600), var(--color-primary-700));
  color: var(--color-white);
  border: none;
  padding: var(--spacing-3) var(--spacing-6);
  border-radius: var(--radius-md);
  font-weight: var(--font-weight-medium);
  transition: all 0.2s ease-in-out;
}

.btn-primary:hover {
  background: linear-gradient(135deg, var(--color-primary-700), var(--color-primary-800));
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(111, 66, 193, 0.3);
}

/* Dark Mode Override */
@media (prefers-color-scheme: dark) {
  .btn-primary {
    background: linear-gradient(135deg, var(--color-primary-500), var(--color-primary-600));
  }

  .btn-primary:hover {
    background: linear-gradient(135deg, var(--color-primary-600), var(--color-primary-700));
  }
}
```

#### Button Sizes

```css
.btn-sm {
  padding: var(--spacing-2) var(--spacing-4);
  font-size: var(--font-size-caption);
}

.btn-md {
  padding: var(--spacing-3) var(--spacing-6);
  font-size: var(--font-size-button);
}

.btn-lg {
  padding: var(--spacing-4) var(--spacing-8);
  font-size: var(--font-size-body-lg);
}
```

### Cards

```css
.card {
  background: var(--color-white);
  border: 1px solid var(--color-gray-200);
  border-radius: var(--radius-lg);
  padding: var(--spacing-6);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: box-shadow 0.2s ease-in-out;
}

.card:hover {
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

/* Dark Mode */
@media (prefers-color-scheme: dark) {
  .card {
    background: var(--color-dark-surface-1);
    border-color: var(--color-dark-border);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }

  .card:hover {
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.5);
  }
}
```

### Travel Tips Card (Dark Mode Fix)

```css
.travel-tip-card {
  background: var(--color-white);
  border: 1px solid var(--color-gray-200);
  border-radius: var(--radius-lg);
  padding: var(--spacing-4);
  margin-bottom: var(--spacing-4);
}

.travel-tip-card .tip-icon {
  font-size: 1.5rem;
  margin-right: var(--spacing-3);
}

.travel-tip-card .tip-label {
  font-weight: var(--font-weight-semibold);
  color: var(--color-gray-700);
  text-transform: uppercase;
  font-size: var(--font-size-caption);
  letter-spacing: 0.05em;
  margin-bottom: var(--spacing-2);
}

.travel-tip-card .tip-value {
  color: var(--color-gray-900);
  font-size: var(--font-size-body);
  line-height: var(--line-height-relaxed);
}

/* Dark Mode - Enhanced Contrast */
@media (prefers-color-scheme: dark) {
  .travel-tip-card {
    background: var(--color-dark-surface-2);
    border-color: var(--color-dark-border);
  }

  .travel-tip-card .tip-label {
    color: var(--color-dark-text-secondary);
    font-weight: var(--font-weight-bold); /* Increased from semibold */
  }

  .travel-tip-card .tip-value {
    color: var(--color-dark-text-primary);
    font-weight: var(--font-weight-medium); /* Slight increase */
  }

  /* Important tips get extra contrast */
  .travel-tip-card[data-importance="high"] {
    background: var(--color-dark-surface-3);
    border-color: var(--color-primary-600);
    box-shadow: 0 0 0 1px var(--color-primary-600);
  }
}
```

### Forms

```css
.form-control {
  width: 100%;
  padding: var(--spacing-3) var(--spacing-4);
  border: 1px solid var(--color-gray-300);
  border-radius: var(--radius-md);
  font-size: var(--font-size-body);
  background: var(--color-white);
  color: var(--color-gray-900);
  transition: all 0.2s ease-in-out;
}

.form-control:focus {
  outline: none;
  border-color: var(--color-primary-600);
  box-shadow: 0 0 0 3px rgba(111, 66, 193, 0.1);
}

/* Dark Mode */
@media (prefers-color-scheme: dark) {
  .form-control {
    background: var(--color-dark-surface-1);
    border-color: var(--color-dark-border);
    color: var(--color-dark-text-primary);
  }

  .form-control::placeholder {
    color: var(--color-dark-text-muted);
  }

  .form-control:focus {
    border-color: var(--color-primary-500);
    box-shadow: 0 0 0 3px rgba(167, 139, 250, 0.2);
  }
}
```

---

## Dark Mode

### Implementation Strategy

Use CSS custom properties and `prefers-color-scheme`:

```css
:root {
  /* Light mode (default) */
  --bg-primary: var(--color-white);
  --bg-secondary: var(--color-gray-50);
  --text-primary: var(--color-gray-900);
  --text-secondary: var(--color-gray-600);
  --border-color: var(--color-gray-200);
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg-primary: var(--color-dark-bg-primary);
    --bg-secondary: var(--color-dark-bg-secondary);
    --text-primary: var(--color-dark-text-primary);
    --text-secondary: var(--color-dark-text-secondary);
    --border-color: var(--color-dark-border);
  }
}
```

### Dark Mode Best Practices

1. **Use Elevation Instead of Shadows**
   - Light mode: Use box-shadows
   - Dark mode: Use lighter background colors for elevation

2. **Reduce Pure White/Black**
   - Avoid `#000000` and `#ffffff` in dark mode
   - Use slate colors for better eye comfort

3. **Increase Font Weights**
   - Text appears thinner on dark backgrounds
   - Bump font-weight by 50-100 (e.g., 400 → 450)

4. **Test Contrast Ratios**
   - Use browser DevTools or online contrast checkers
   - Aim for 7:1 for body text (AAA standard)

5. **Use Semi-Transparent Overlays**
   ```css
   .overlay-light {
     background: rgba(255, 255, 255, 0.1);
   }

   .overlay-dark {
     background: rgba(0, 0, 0, 0.2);
   }
   ```

### Travel Tips - Dark Mode Example

```css
/* Light Mode */
.tip-container {
  background: #f9fafb;
  color: #111827;
  border: 1px solid #e5e7eb;
}

.tip-label {
  color: #6b7280;
  font-weight: 600;
}

/* Dark Mode - Enhanced Visibility */
@media (prefers-color-scheme: dark) {
  .tip-container {
    background: #1e293b;  /* Surface 1 */
    color: #f1f5f9;       /* Bright text */
    border: 1px solid #475569;
  }

  .tip-label {
    color: #cbd5e1;       /* Lighter than light mode */
    font-weight: 700;     /* Heavier weight */
  }

  .tip-value {
    color: #f1f5f9;       /* Full brightness */
    font-weight: 500;     /* Medium weight for readability */
  }
}
```

---

## Accessibility

### Focus States

```css
/* Visible focus indicator */
*:focus {
  outline: 2px solid var(--color-primary-600);
  outline-offset: 2px;
}

/* Button focus states */
.btn:focus {
  outline: 2px solid var(--color-primary-600);
  outline-offset: 2px;
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  *:focus {
    outline-color: var(--color-primary-400);
  }
}
```

### Screen Reader Only

```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

### ARIA Labels

Always provide ARIA labels for:
- Icon-only buttons
- Form inputs (via `<label>` or `aria-label`)
- Navigation landmarks
- Dynamic content updates

---

## Motion & Animation

### Animation Durations

```css
--duration-fast: 150ms;
--duration-normal: 250ms;
--duration-slow: 350ms;
```

### Easing Functions

```css
--ease-in: cubic-bezier(0.4, 0, 1, 1);
--ease-out: cubic-bezier(0, 0, 0.2, 1);
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
```

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Iconography

### Icon Sizes

```css
--icon-xs: 1rem;    /* 16px */
--icon-sm: 1.25rem; /* 20px */
--icon-md: 1.5rem;  /* 24px */
--icon-lg: 2rem;    /* 32px */
--icon-xl: 3rem;    /* 48px */
```

### Icon Usage

- Use React Icons library for consistency
- Ensure 44x44px touch target for interactive icons
- Provide `aria-label` for icon-only buttons

---

## Implementation Checklist

- [ ] Create `src/styles/design-system.css` with all CSS variables
- [ ] Update existing components to use design system tokens
- [ ] Implement dark mode across all components
- [ ] Test contrast ratios for all text/background combinations
- [ ] Add focus states to all interactive elements
- [ ] Test with screen readers
- [ ] Test with reduced motion enabled
- [ ] Create Storybook stories for all components

---

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Material Design Dark Theme](https://material.io/design/color/dark-theme.html)
- [Apple Human Interface Guidelines - Dark Mode](https://developer.apple.com/design/human-interface-guidelines/dark-mode)

---

*For questions or suggestions, please open an issue or PR.*

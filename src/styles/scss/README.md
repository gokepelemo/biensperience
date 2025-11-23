# SASS Design System

This directory contains the SASS-based design system for Biensperience. It provides variables, mixins, and utilities for consistent, maintainable styling across the application.

## Directory Structure

```
scss/
├── abstracts/           # Variables, mixins, functions (no CSS output)
│   ├── _variables.scss  # Design tokens (colors, spacing, typography)
│   ├── _mixins.scss     # Reusable mixins
│   └── _index.scss      # Export all abstracts
├── base/                # Base styles (typography, reset)
├── components/          # Component-specific styles
├── layout/              # Layout patterns (grid, containers)
└── utils/               # Utility classes
```

## Quick Start

### 1. Import abstracts in your SCSS file

```scss
@use '../../styles/scss/abstracts' as *;

.myComponent {
  @include card;
  @include breakpoint-max(lg) {
    @include heading-mobile-lg;
  }
}
```

### 2. Use variables

```scss
.myComponent {
  padding: $space-4;
  color: $color-primary;
  border-radius: $radius-lg;
  box-shadow: $shadow-md;
}
```

### 3. Use mixins

```scss
.myHeading {
  @include heading-mobile-lg; // Responsive 20px-26px
}

.myCard {
  @include card-interactive; // Card with hover effect
}

.myButton {
  @include button-responsive; // Fluid padding and font size
}
```

## Available Mixins

### Responsive Breakpoints

```scss
// Min-width (mobile-first)
@include breakpoint(sm) { } // >= 576px
@include breakpoint(md) { } // >= 768px
@include breakpoint(lg) { } // >= 992px
@include breakpoint(xl) { } // >= 1200px

// Max-width (desktop-first)
@include breakpoint-max(sm) { } // < 576px
@include breakpoint-max(md) { } // < 768px
@include breakpoint-max(lg) { } // < 992px

// Between breakpoints
@include breakpoint-between(576px, 992px) { }
```

### Responsive Typography

```scss
// Fluid font sizes with clamp()
@include fluid-font(1rem, 2.5vw, 1.25rem); // min, preferred, max

// Preset heading sizes
@include heading-mobile-xl;  // 24px - 32px
@include heading-mobile-lg;  // 20px - 26px
@include heading-mobile-md;  // 18px - 22px
@include heading-mobile-sm;  // 16px - 20px

// Preset text sizes
@include text-mobile-lg;     // 18px - 22px
@include text-mobile-md;     // 16px - 18px
@include text-mobile-sm;     // 14px - 16px
```

### Flexbox Layouts

```scss
@include flex-center;         // Center both axes
@include flex-between;        // Space between with center alignment
@include flex-start;          // Align left with center alignment
@include flex-end;            // Align right with center alignment
@include flex-column;         // Column direction
@include flex-column-center;  // Column with center alignment

// Stack layouts with gap
@include stack($space-4);           // Vertical stack
@include inline-stack($space-3);    // Horizontal stack
```

### Spacing

```scss
// Responsive padding/margin with clamp()
@include padding-responsive($space-2, $space-4);
@include padding-x-responsive($space-3, $space-6);
@include padding-y-responsive($space-2, $space-4);
@include margin-responsive($space-4, $space-6);
@include margin-bottom-responsive($space-4, $space-8);
```

### Cards & Containers

```scss
@include card;              // Basic card styling
@include card-hover;        // Hover effect
@include card-interactive;  // Card with hover (includes cursor)
```

### Buttons

```scss
@include button-base;       // Base button styles
@include button-responsive; // Fluid padding and font size
```

### Utilities

```scss
@include truncate;                    // Single-line ellipsis
@include line-clamp(3);              // Multi-line truncation
@include focus-ring;                 // Accessible focus state
@include smooth-scroll;              // Smooth scrolling
@include gpu-accelerate;             // GPU optimization
@include hide-scrollbar;             // Hide scrollbars
@include custom-scrollbar(8px);      // Styled scrollbar
```

### Animations

```scss
@include fade-in($transition-normal);
@include slide-in('up', $transition-normal);   // up, down, left, right
```

## Variables

### Breakpoints

```scss
$breakpoint-xs: 320px;
$breakpoint-sm: 576px;
$breakpoint-md: 768px;
$breakpoint-lg: 992px;
$breakpoint-xl: 1200px;
$breakpoint-xxl: 1400px;
```

### Spacing Scale

```scss
$space-0: 0;
$space-1: 0.25rem;   // 4px
$space-2: 0.5rem;    // 8px
$space-3: 0.75rem;   // 12px
$space-4: 1rem;      // 16px
$space-5: 1.5rem;    // 24px
$space-6: 2rem;      // 32px
$space-8: 3rem;      // 48px
$space-10: 4rem;     // 64px
$space-12: 6rem;     // 96px
```

### Typography

```scss
// Font families
$font-family-base
$font-family-heading
$font-family-mono

// Font weights
$font-weight-light: 300;
$font-weight-normal: 400;
$font-weight-medium: 500;
$font-weight-semibold: 600;
$font-weight-bold: 700;
$font-weight-extrabold: 800;

// Font sizes
$font-size-xs: 0.75rem;    // 12px
$font-size-sm: 0.875rem;   // 14px
$font-size-base: 1rem;     // 16px
$font-size-lg: 1.125rem;   // 18px
$font-size-xl: 1.25rem;    // 20px
$font-size-2xl: 1.5rem;    // 24px
$font-size-3xl: 1.875rem;  // 30px
$font-size-4xl: 2.25rem;   // 36px
$font-size-5xl: 3rem;      // 48px

// Line heights
$line-height-none: 1;
$line-height-tight: 1.25;
$line-height-snug: 1.375;
$line-height-normal: 1.5;
$line-height-relaxed: 1.625;
$line-height-loose: 2;
```

### Colors

```scss
// Brand
$color-primary: #667eea;
$color-primary-light: #7c8ff0;
$color-primary-dark: #5568d3;
$color-secondary: #764ba2;
$color-accent: #f093fb;

// Semantic
$color-success: #10b981;
$color-warning: #f59e0b;
$color-danger: #ef4444;
$color-info: #3b82f6;

// Text
$color-text-primary: #1a202c;
$color-text-secondary: #4a5568;
$color-text-muted: #a0aec0;
$color-text-inverse: #ffffff;

// Backgrounds
$color-bg-primary: #ffffff;
$color-bg-secondary: #f7fafc;
$color-bg-tertiary: #edf2f7;
$color-bg-hover: #e2e8f0;

// Borders
$color-border-light: #e2e8f0;
$color-border-medium: #cbd5e0;
$color-border-dark: #a0aec0;
```

### Shadows

```scss
$shadow-xs
$shadow-sm
$shadow-md
$shadow-lg
$shadow-xl
$shadow-2xl
```

### Border Radius

```scss
$radius-none: 0;
$radius-sm: 0.25rem;   // 4px
$radius-md: 0.5rem;    // 8px
$radius-lg: 0.75rem;   // 12px
$radius-xl: 1rem;      // 16px
$radius-2xl: 1.5rem;   // 24px
$radius-full: 9999px;
```

### Transitions

```scss
$transition-fast: 150ms;
$transition-normal: 250ms;
$transition-slow: 350ms;

$easing-linear
$easing-ease
$easing-ease-in
$easing-ease-out
$easing-ease-in-out
```

## Migration Guide

### Before (CSS)

```css
.plan-item-card {
  margin-bottom: 1.5rem;
}

@media (max-width: 991px) {
  .plan-item-title {
    font-size: clamp(1.25rem, 4.5vw, 1.625rem);
    font-weight: 600;
    line-height: 1.3;
  }

  .plan-item-meta {
    font-size: clamp(1.125rem, 3.5vw, 1.375rem);
    font-weight: 500;
  }
}
```

### After (SCSS)

```scss
@use '../../styles/scss/abstracts' as *;

.planItemCard {
  margin-bottom: $space-5;

  @include breakpoint-max(lg) {
    .planItemTitle {
      @include heading-mobile-lg; // Same as clamp(1.25rem, 4.5vw, 1.625rem)
    }

    .planItemMeta {
      @include text-mobile-lg; // Same as clamp(1.125rem, 3.5vw, 1.375rem)
    }
  }
}
```

## Benefits of SASS Migration

### 1. DRY (Don't Repeat Yourself)
- Define responsive typography once in mixins
- Reuse across all components
- Single source of truth

### 2. Maintainability
- Change breakpoints in one place
- Update design tokens globally
- Easier refactoring

### 3. Type Safety
- Variable autocomplete in VSCode
- Catch typos at compile time
- Better developer experience

### 4. Calculations
- Math operations: `$space-4 * 2`
- Color functions: `lighten($color-primary, 10%)`
- Unit conversions: `px-to-rem(24px)`

### 5. Organization
- Nested selectors
- Logical grouping
- Clear file structure

## Example Component

See `src/views/SingleExperience/SingleExperience.module.scss` for a complete example of:
- Responsive typography with mixins
- Breakpoint usage
- Variable usage
- Layout mixins
- Button styling
- Card patterns

## Build Process

Vite automatically compiles SCSS files:
1. Import `.scss` files in your components
2. Vite compiles to CSS during development
3. Production build includes optimized CSS

No additional configuration needed!

## CSS Modules vs Global SCSS

### Use CSS Modules (.module.scss) for:
- Component-specific styles
- Scoped class names
- Avoiding naming conflicts

### Use Global SCSS (.scss) for:
- Design tokens
- Global utilities
- Theme overrides
- Base styles

## Migration Status

- [x] Variables created (_variables.scss)
- [x] Mixins created (_mixins.scss)
- [x] Example component (SingleExperience.module.scss)
- [ ] Migrate design-tokens.css → _variables.scss (in CSS custom properties)
- [ ] Migrate utilities.css → utility mixins
- [ ] Migrate component CSS files to .scss
- [ ] Update imports in all components

## Resources

- [SASS Documentation](https://sass-lang.com/documentation)
- [CSS Modules with Vite](https://vitejs.dev/guide/features.html#css-modules)
- [Design System Best Practices](https://www.smashingmagazine.com/2019/05/design-system-frontend-tools/)

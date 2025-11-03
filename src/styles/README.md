# Biensperience Design System

## Overview
This design system provides a comprehensive, consistent foundation for all UI development in the Biensperience application. It prevents layout shifts, ensures visual consistency, and optimizes CSS performance.

## Core Principles

### 🚨 Loading States - Use the Loading Component
**IMPORTANT**: All loading states MUST use the `Loading` component. Never create custom loading spinners, animations, or indicators.

```jsx
import Loading from '../components/Loading/Loading';

// ✅ CORRECT: Use Loading component with appropriate variant
<Loading variant="centered" size="lg" message="Loading data..." />

// ❌ WRONG: Don't create custom spinners
<div className="spinner-border"></div>
<div className="custom-loading-circle"></div>
```

**Loading Component Variants:**
- **Large centered loading**: `<Loading variant="centered" size="lg" message="Loading..." />`
- **Medium centered loading**: `<Loading variant="centered" size="md" message="Loading..." />`
- **Small inline loading**: `<Loading size="sm" showMessage={false} />`
- **Fullscreen overlay**: `<Loading variant="fullscreen" size="lg" overlay="light" message="Processing..." />`

See [Loading Component Documentation](../components/Loading/Loading.jsx) for full API.

## Architecture

### File Structure
```
src/styles/
├── design-tokens.css      # Single source of truth for all design values
├── headings.css           # Heading styles with layout shift prevention
├── utilities.css          # Atomic utility classes
├── theme.css              # Theme-specific overrides (legacy)
├── accessibility.css      # Accessibility enhancements
├── alerts.css             # Alert component styles
├── animations.css         # Animation definitions
└── shared/
    ├── typography.css     # Legacy typography (being deprecated)
    ├── modal.css          # Modal styles
    ├── forms.css          # Form styles
    └── animations.css     # Shared animations
```

## Design Tokens (Variables)

### Usage
Design tokens are CSS custom properties defined in `design-tokens.css`. They provide a single source of truth for all design values.

**Example:**
```css
.my-component {
  font-size: var(--font-size-lg);
  color: var(--color-text-primary);
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  transition: all var(--transition-normal);
}
```

### Token Categories

#### Typography
- **Font Families**: `--font-family-base`, `--font-family-code`
- **Font Weights**: `--font-weight-regular` through `--font-weight-extrabold`
- **Font Sizes**: `--font-size-xs` through `--font-size-4xl`
- **Line Heights**: `--line-height-tight` through `--line-height-loose`
- **Letter Spacing**: `--letter-spacing-tighter` through `--letter-spacing-wider`

#### Spacing
- **Scale**: `--space-0` (0) through `--space-24` (96px)
- **Usage**: Consistent spacing for margins, padding, gaps

#### Colors
- **Brand**: `--color-primary`, `--color-primary-dark`, `--color-primary-light`
- **Text**: `--color-text-primary` through `--color-text-disabled`
- **Background**: `--color-bg-primary`, `--color-bg-secondary`, `--color-bg-tertiary`
- **Semantic**: `--color-success`, `--color-danger`, `--color-warning`, `--color-info`
- **Borders**: `--color-border-light`, `--color-border-medium`, `--color-border-dark`

#### Shadows
- **Box Shadows**: `--shadow-xs` through `--shadow-xl`
- **Text Shadows**: `--shadow-text-sm`, `--shadow-text-md`

#### Border Radius
- **Scale**: `--radius-sm` through `--radius-2xl`, `--radius-full`

#### Transitions
- **Timing**: `--transition-fast` through `--transition-slow`

## Headings System

### Preventing Layout Shifts
All headings use `contain: layout style` to prevent cumulative layout shift (CLS).

### Usage
```jsx
// Standard HTML headings (automatically styled)
<h1>Page Title</h1>
<h2>Section Title</h2>

// Semantic class names
<div className="heading-page">Page Title</div>
<div className="heading-section">Section Title</div>
<div className="heading-card">Card Title</div>
```

### Heading Hierarchy
- **h1 / .heading-page**: Main page title (largest)
- **h2 / .heading-section**: Major sections
- **h3 / .heading-card**: Cards and components
- **h4 / .heading-sub**: Subsections
- **h5, h6**: Smaller headings

### Modifiers
- `.heading-no-margin`: Remove bottom margin
- `.heading-center`: Center align
- `.heading-truncate`: Ellipsis overflow
- `.heading-underline`: Add bottom border
- `.heading-gradient`: Gradient text effect

## Utility Classes

### Text Utilities
```jsx
<p className="text-lg text-semibold text-primary">
  Large, semi-bold, primary color text
</p>

<div className="text-center text-muted">
  Centered, muted text
</div>

<span className="text-truncate">
  This text will truncate with ellipsis if too long
</span>
```

### Spacing Utilities
```jsx
<div className="mt-4 mb-6 p-4">
  Margin top 16px, margin bottom 24px, padding 16px
</div>

<div className="m-0 p-0">
  No margin or padding
</div>
```

### Layout Utilities
```jsx
<div className="d-flex justify-center items-center gap-4">
  Flex container with centered items and 16px gap
</div>

<div className="d-grid">
  Grid container
</div>
```

### Background & Border
```jsx
<div className="bg-secondary rounded-lg border shadow-md">
  Secondary background, large rounded corners, border, medium shadow
</div>
```

## Component-Specific Styles

### CSS Modules (Recommended)
For component-specific styles, use CSS Modules to prevent style leakage and optimize bundle size.

**Example: `MyComponent.module.css`**
```css
.container {
  /* Use design tokens */
  padding: var(--space-6);
  background: var(--color-bg-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);

  /* Prevent layout shifts */
  contain: layout style;
}

.title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  margin-bottom: var(--space-4);
}

.button {
  padding: var(--space-3) var(--space-6);
  background: var(--color-primary);
  color: white;
  border-radius: var(--radius-md);
  transition: all var(--transition-normal);
}

.button:hover {
  background: var(--color-primary-dark);
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}
```

**Component:**
```jsx
import styles from './MyComponent.module.css';

function MyComponent() {
  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Title</h2>
      <button className={styles.button}>Click Me</button>
    </div>
  );
}
```

### Traditional CSS (Legacy)
Only use for global styles or when CSS Modules aren't practical.

## Performance Best Practices

### 1. CSS Containment
Use `contain: layout` or `contain: layout style` to prevent layout shifts:

```css
.stable-component {
  contain: layout style;
}
```

### 2. Font Loading
Fonts use `font-display: swap` to prevent FOIT (Flash of Invisible Text).

### 3. GPU Acceleration
For animated elements:

```css
.animated-element {
  will-change: transform;
  transform: translateZ(0);
  backface-visibility: hidden;
}
```

### 4. Minimize CSS Bloat
- Use utility classes for common patterns
- Use CSS Modules for component-specific styles
- Avoid deep nesting (max 3 levels)
- Avoid overly specific selectors

## Accessibility

### High Contrast Mode
All components support high contrast mode automatically.

### Reduced Motion
Animations respect `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation: none !important;
    transition: none !important;
  }
}
```

### Focus Styles
All interactive elements have visible focus indicators for keyboard navigation.

## Responsive Design

### Breakpoints
```css
/* Mobile first approach */
.component {
  /* Mobile styles (default) */
}

@media (min-width: 576px) {
  /* Tablet and up */
}

@media (min-width: 768px) {
  /* Desktop and up */
}

@media (min-width: 992px) {
  /* Large desktop */
}
```

### Responsive Utilities
```jsx
<div className="d-sm-none d-md-block">
  Hidden on mobile, visible on desktop
</div>
```

## Migration Guide

### From Legacy to Design System

**Old:**
```css
.my-heading {
  font-size: 2rem;
  font-weight: 700;
  color: #1a202c;
  margin-bottom: 1.5rem;
}
```

**New:**
```css
.my-heading {
  font-size: var(--font-size-3xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  margin-bottom: var(--space-6);
  contain: layout style;
}
```

**Or use utility classes:**
```jsx
<h2 className="text-3xl font-bold text-primary mb-6">
  My Heading
</h2>
```

## Testing for Layout Shifts

### Google Lighthouse
Run Lighthouse in Chrome DevTools to check Cumulative Layout Shift (CLS):
- Target: CLS < 0.1 (good)
- Avoid: CLS > 0.25 (poor)

### Manual Testing
1. Open Chrome DevTools
2. Performance tab → Reload page
3. Look for "Experience" section
4. Check "Cumulative Layout Shift"

## Common Patterns

### Card Component
```jsx
<div className="bg-primary rounded-xl shadow-lg p-6">
  <h3 className="heading-card">Card Title</h3>
  <p className="text-base text-secondary">Card content</p>
  <button className="btn btn-primary mt-4">Action</button>
</div>
```

### Form Field
```jsx
<div className="mb-4">
  <label className="text-sm font-semibold text-secondary mb-2 d-block">
    Field Label
  </label>
  <input
    type="text"
    className="form-control rounded-lg border p-3"
  />
</div>
```

### Alert Message
```jsx
<div className="bg-danger-light border border-danger rounded-lg p-4 mb-4">
  <div className="d-flex items-center gap-2">
    <span className="text-danger font-semibold">Error:</span>
    <span className="text-secondary">Something went wrong</span>
  </div>
</div>
```

## Resources

- **Design Tokens**: `src/styles/design-tokens.css`
- **Headings**: `src/styles/headings.css`
- **Utilities**: `src/styles/utilities.css`
- **Examples**: See existing components for patterns

## Questions?

Check existing components for examples or refer to the design system files directly.

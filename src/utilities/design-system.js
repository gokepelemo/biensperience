/**
 * Design System Utilities
 * Provides consistent styling and layout helpers for the Biensperience design system
 */

/**
 * Button styling utilities
 */
export const buttonStyles = {
  // Primary button (gradient)
  primary: `
    background: var(--gradient-primary);
    color: var(--color-bg-primary);
    border: none;
    padding: var(--space-3) var(--space-6);
    border-radius: var(--radius-md);
    font-weight: var(--font-weight-medium);
    font-size: var(--font-size-base);
    transition: var(--transition-base);
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
  `,

  primaryHover: `
    background: var(--gradient-primary-reverse);
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  `,

  // Secondary button
  secondary: `
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
    border: 1px solid var(--color-border-medium);
    padding: var(--space-3) var(--space-6);
    border-radius: var(--radius-md);
    font-weight: var(--font-weight-medium);
    font-size: var(--font-size-base);
    transition: var(--transition-base);
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
  `,

  secondaryHover: `
    background: var(--color-bg-tertiary);
    border-color: var(--color-border-dark);
  `,

  // Button sizes
  sm: `
    padding: var(--space-2) var(--space-4);
    font-size: var(--font-size-xs);
  `,

  lg: `
    padding: var(--space-4) var(--space-8);
    font-size: var(--font-size-lg);
  `,
};

/**
 * Layout utilities for consistent button alignment
 */
export const layoutStyles = {
  // Center buttons in containers
  buttonContainer: `
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
    flex-wrap: wrap;
  `,

  // Button group for modal footers
  buttonGroup: `
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
    margin-top: var(--space-4);
  `,

  // Card action buttons
  cardActions: `
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding: var(--space-3);
  `,
};

/**
 * Component-specific styling helpers
 */
export const componentStyles = {
  // Alert action buttons
  alertActions: `
    margin-top: var(--space-4);
    padding-top: var(--space-4);
    border-top: 1px solid var(--color-border-medium);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
  `,

  // Modal footer buttons
  modalFooter: `
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
    padding: var(--space-4) var(--space-6);
    border-top: 1px solid var(--color-border-medium);
  `,

  // Card footer buttons
  cardFooter: `
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding: var(--space-3);
    border-top: 1px solid var(--color-border-medium);
  `,
};

/**
 * Dark mode overrides
 */
export const darkModeStyles = {
  primary: `
    background: linear-gradient(135deg, var(--color-primary-500), var(--color-primary-600));
  `,

  primaryHover: `
    background: linear-gradient(135deg, var(--color-primary-600), var(--color-primary-700));
  `,

  secondary: `
    background: var(--color-dark-surface-2);
    color: var(--color-dark-text-primary);
    border-color: var(--color-dark-border);
  `,

  secondaryHover: `
    background: var(--color-dark-surface-3);
    border-color: var(--color-dark-border-hover);
  `,
};

/**
 * Utility function to get button classes
 * @param {string} variant - Button variant (primary, secondary)
 * @param {string} size - Button size (sm, md, lg)
 * @returns {string} CSS classes
 */
export function getButtonClasses(variant = 'primary', size = 'md') {
  const baseClasses = ['btn'];
  const variantClass = `btn-${variant}`;
  const sizeClass = size !== 'md' ? `btn-${size}` : '';

  return [...baseClasses, variantClass, sizeClass].filter(Boolean).join(' ');
}

/**
 * Utility function to get button styles
 * @param {string} variant - Button variant
 * @param {string} size - Button size
 * @param {boolean} isDark - Whether in dark mode
 * @returns {string} CSS styles
 */
export function getButtonStyles(variant = 'primary', size = 'md', isDark = false) {
  let styles = buttonStyles[variant] || buttonStyles.primary;

  if (size !== 'md') {
    styles += buttonStyles[size];
  }

  if (isDark) {
    styles += darkModeStyles[variant] || '';
  }

  return styles;
}

/**
 * Utility function to get layout styles
 * @param {string} type - Layout type (buttonContainer, buttonGroup, cardActions)
 * @returns {string} CSS styles
 */
export function getLayoutStyles(type) {
  return layoutStyles[type] || layoutStyles.buttonContainer;
}

/**
 * Utility function to get component styles
 * @param {string} component - Component type (alertActions, modalFooter, cardFooter)
 * @returns {string} CSS styles
 */
export function getComponentStyles(component) {
  return componentStyles[component] || '';
}
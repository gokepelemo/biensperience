/**
 * useKeyboardNavigation Hook
 * Provides keyboard navigation for modals, tabs, and card grids
 * 
 * Features:
 * - ESC key closes modals/info windows
 * - Arrow keys navigate between focusable elements
 * - Automatic focus management
 * 
 * @example
 * // For modal/dialog ESC handling
 * useKeyboardNavigation({
 *   onEscape: handleClose,
 *   enabled: isOpen
 * });
 * 
 * @example
 * // For card grid navigation
 * useKeyboardNavigation({
 *   containerRef,
 *   selector: '.card-item',
 *   onNavigate: (index) => console.log('Navigated to card:', index)
 * });
 */

import { useEffect, useRef, useCallback } from 'react';
import { logger } from '../utilities/logger';

/**
 * Hook for keyboard navigation and shortcuts
 * 
 * @param {Object} options
 * @param {Function} options.onEscape - Callback when ESC is pressed
 * @param {React.RefObject} options.containerRef - Container ref for arrow navigation
 * @param {string} options.selector - CSS selector for navigable items
 * @param {Function} options.onNavigate - Callback when navigation occurs (index)
 * @param {boolean} options.enabled - Whether keyboard handling is enabled (default: true)
 * @param {boolean} options.trapFocus - Whether to trap focus within container (default: false)
 */
export function useKeyboardNavigation(options = {}) {
  const {
    onEscape,
    containerRef,
    selector = '[tabindex="0"], button:not(:disabled), a[href]',
    onNavigate,
    enabled = true,
    trapFocus = false
  } = options;

  const currentIndexRef = useRef(-1);

  const getNavigableElements = useCallback(() => {
    if (!containerRef?.current) return [];
    return Array.from(containerRef.current.querySelectorAll(selector));
  }, [containerRef, selector]);

  const focusElement = useCallback((index) => {
    const elements = getNavigableElements();
    if (elements.length === 0) return;

    // Wrap around
    const wrappedIndex = ((index % elements.length) + elements.length) % elements.length;
    const element = elements[wrappedIndex];

    if (element) {
      element.focus();
      currentIndexRef.current = wrappedIndex;
      onNavigate?.(wrappedIndex);
    }
  }, [getNavigableElements, onNavigate]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event) => {
      // ESC key handling
      if (event.key === 'Escape' && onEscape) {
        event.preventDefault();
        event.stopPropagation();
        onEscape();
        return;
      }

      // Arrow key navigation (only if container is provided)
      if (!containerRef?.current) return;

      const elements = getNavigableElements();
      if (elements.length === 0) return;

      // Find currently focused element index
      const activeElement = document.activeElement;
      const currentIndex = elements.indexOf(activeElement);

      let handled = false;
      let newIndex = currentIndex;

      switch (event.key) {
        case 'ArrowDown':
        case 'ArrowRight':
          event.preventDefault();
          newIndex = currentIndex + 1;
          handled = true;
          break;

        case 'ArrowUp':
        case 'ArrowLeft':
          event.preventDefault();
          newIndex = currentIndex - 1;
          handled = true;
          break;

        case 'Home':
          event.preventDefault();
          newIndex = 0;
          handled = true;
          break;

        case 'End':
          event.preventDefault();
          newIndex = elements.length - 1;
          handled = true;
          break;

        case 'Tab':
          if (trapFocus) {
            event.preventDefault();
            newIndex = event.shiftKey ? currentIndex - 1 : currentIndex + 1;
            handled = true;
          }
          break;

        default:
          break;
      }

      if (handled) {
        focusElement(newIndex);
      }
    };

    // Add event listener to document for global keyboard handling
    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [enabled, onEscape, containerRef, getNavigableElements, focusElement, trapFocus]);

  // Return focus management utilities
  return {
    focusFirst: () => focusElement(0),
    focusLast: () => {
      const elements = getNavigableElements();
      focusElement(elements.length - 1);
    },
    focusNext: () => focusElement(currentIndexRef.current + 1),
    focusPrevious: () => focusElement(currentIndexRef.current - 1),
    focusIndex: (index) => focusElement(index),
  };
}

/**
 * Hook specifically for modal ESC handling
 * Simplified version for common modal use case
 * 
 * @param {Function} onClose - Callback when ESC is pressed
 * @param {boolean} isOpen - Whether the modal is open
 */
export function useModalEscape(onClose, isOpen = true) {
  return useKeyboardNavigation({
    onEscape: onClose,
    enabled: isOpen
  });
}

/**
 * Hook for grid/list navigation
 * Simplified version for card grids
 * 
 * @param {React.RefObject} containerRef - Container ref
 * @param {string} itemSelector - Selector for navigable items
 * @param {boolean} enabled - Whether navigation is enabled
 */
export function useGridNavigation(containerRef, itemSelector = '.card', enabled = true) {
  return useKeyboardNavigation({
    containerRef,
    selector: itemSelector,
    enabled
  });
}

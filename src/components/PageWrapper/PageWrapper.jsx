import { useEffect } from 'react';
import { useApp } from '../../contexts/AppContext';

/**
 * PageWrapper Component
 * Simplifies integration with AppContext for views
 * Automatically handles h1 registration and action button cleanup
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Page content
 * @param {string} props.title - Page title (optional, uses h1 text if not provided)
 * @param {Array} props.actionButtons - Action buttons for this page
 * @param {string} props.h1Selector - CSS selector for h1 element (default: 'h1')
 */
export default function PageWrapper({
  children,
  title,
  actionButtons = [],
  h1Selector = 'h1'
}) {
  const {
    registerH1,
    updatePageTitle,
    setPageActionButtons,
    clearActionButtons
  } = useApp();

  // Register h1 and set up page context
  useEffect(() => {
    // Find and register h1 element
    const h1 = document.querySelector(h1Selector);
    if (h1) {
      registerH1(h1);

      // Use h1 text as title if title prop not provided
      if (!title && h1.textContent) {
        updatePageTitle(h1.textContent);
      }
    }

    // Set custom title if provided
    if (title) {
      updatePageTitle(title);
    }

    // Set action buttons
    if (actionButtons.length > 0) {
      setPageActionButtons(actionButtons);
    }

    // Cleanup on unmount
    return () => {
      clearActionButtons();
      updatePageTitle('Biensperience');
    };
  }, [title, actionButtons, h1Selector, registerH1, updatePageTitle, setPageActionButtons, clearActionButtons]);

  return <>{children}</>;
}

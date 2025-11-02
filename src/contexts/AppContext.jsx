import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const AppContext = createContext();

/**
 * Hook to access app-level state (scroll, navbar, page context)
 * @returns {Object} App context with scroll state, page title, action buttons
 */
export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

/**
 * App Provider Component
 * Manages app-level state including scroll position, page context, and navbar configuration
 */
export function AppProvider({ children }) {
  const [scrollY, setScrollY] = useState(0);
  const [isScrolled, setIsScrolled] = useState(false);
  const [pageTitle, setPageTitle] = useState('Biensperience');
  const [h1Element, setH1Element] = useState(null);
  const [h1Text, setH1Text] = useState('');
  const [h1Visible, setH1Visible] = useState(true);
  const [actionButtons, setActionButtons] = useState([]);
  const [showActionButtons, setShowActionButtons] = useState(false);
  const [showH1InNavbar, setShowH1InNavbar] = useState(false);

  /**
   * Register the h1 element for tracking
   * @param {HTMLElement} element - The h1 element to track
   */
  const registerH1 = useCallback((element) => {
    setH1Element(element);
    if (element) {
      setH1Text(element.textContent || '');
    }
  }, []);

  /**
   * Update the page action buttons
   * @param {Array} buttons - Array of button configurations
   * Example: [{ label: 'Edit', onClick: handleEdit, variant: 'primary', icon: 'pencil' }]
   */
  const setPageActionButtons = useCallback((buttons) => {
    setActionButtons(prevButtons => {
      const newButtons = buttons || [];
      // Only update if buttons actually changed
      if (JSON.stringify(prevButtons) !== JSON.stringify(newButtons)) {
        return newButtons;
      }
      return prevButtons;
    });
  }, []);

  /**
   * Clear the page action buttons
   */
  const clearActionButtons = useCallback(() => {
    setActionButtons([]);
    setShowActionButtons(false);
  }, []);

  /**
   * Set whether to show h1 text in navbar when scrolled
   * @param {boolean} show - Whether to show h1 text in navbar
   */
  const updateShowH1InNavbar = useCallback((show) => {
    setShowH1InNavbar(show);
  }, []);

  /**
   * Update the page title (shown in navbar when scrolled past h1)
   * @param {string} title - Page title
   */
  const updatePageTitle = useCallback((title) => {
    setPageTitle(title || 'Biensperience');
  }, []);

  // Track scroll position and h1 visibility
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setScrollY(currentScrollY);
      setIsScrolled(currentScrollY > 10);

      // Check if h1 is visible
      if (h1Element) {
        const rect = h1Element.getBoundingClientRect();
        const isVisible = rect.bottom > 80; // 80px is approximate navbar height
        setH1Visible(isVisible);
        setShowActionButtons(!isVisible && actionButtons.length > 0);
      }
    };

    // Initial check
    handleScroll();

    // Add scroll listener with passive flag for better performance
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [h1Element, actionButtons.length]);

  // Update h1 text when h1 element changes
  useEffect(() => {
    if (h1Element) {
      const observer = new MutationObserver(() => {
        setH1Text(h1Element.textContent || '');
      });

      observer.observe(h1Element, {
        childList: true,
        characterData: true,
        subtree: true,
      });

      return () => observer.disconnect();
    }
  }, [h1Element]);

  const value = {
    // Scroll state
    scrollY,
    isScrolled,

    // Page context
    pageTitle,
    updatePageTitle,

    // H1 tracking
    h1Element,
    h1Text,
    h1Visible,
    registerH1,
    showH1InNavbar,
    updateShowH1InNavbar,

    // Action buttons
    actionButtons,
    showActionButtons,
    setPageActionButtons,
    clearActionButtons,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

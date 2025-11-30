import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * ScrollToTop component
 *
 * Automatically scrolls to the top of the page when the route changes.
 * This provides better UX by ensuring users start at the top of the viewport
 * for new content.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Scroll to top of the page instantly for faster navigation
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
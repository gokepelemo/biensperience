import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Hook to preserve hash fragments during React Router navigation
 *
 * React Router v6 strips hash fragments during client-side navigation.
 * This hook detects when a hash should be present and restores it.
 *
 * Usage: Add to App.jsx right after Routes component
 */
export function useHashPreservation() {
  const location = useLocation();
  const hashToRestoreRef = useRef(null);
  const isRestoringRef = useRef(false);

  useEffect(() => {
    // If we have a hash to restore and we're not currently restoring
    if (hashToRestoreRef.current && !isRestoringRef.current) {
      isRestoringRef.current = true;

      const hashToRestore = hashToRestoreRef.current;
      hashToRestoreRef.current = null;

      // Small delay to ensure component has mounted
      setTimeout(() => {
        if (window.location.hash !== hashToRestore) {
          console.log('[Hash Preservation] Restoring hash:', hashToRestore);
          window.location.hash = hashToRestore;
        }
        isRestoringRef.current = false;
      }, 0);
    }
  }, [location.pathname]);

  // Listen for hash in state from React Router Link
  useEffect(() => {
    if (location.state && location.state.hash) {
      hashToRestoreRef.current = location.state.hash;
    }
  }, [location.state]);

  // Intercept Link clicks to preserve hash
  useEffect(() => {
    const handleClick = (e) => {
      const link = e.target.closest('a[href]');
      if (!link) return;

      const href = link.getAttribute('href');
      if (href && href.includes('#')) {
        const hashIndex = href.indexOf('#');
        const hash = href.substring(hashIndex);

        // Store hash for restoration
        hashToRestoreRef.current = hash;
        console.log('[Hash Preservation] Captured hash from link:', hash);
      }
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, []);
}

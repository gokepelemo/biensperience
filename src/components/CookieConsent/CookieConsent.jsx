/**
 * CookieConsent Component
 * Displays a toast notification requesting cookie consent from the user
 * Only shows if user hasn't made a consent decision yet
 * Integrates with cookie-utils to manage consent state
 */

import { useEffect, useRef } from 'react';
import { useToast } from '../../contexts/ToastContext';
import {
  hasConsentDecided,
  setConsentGiven,
  setConsentDeclined
} from '../../utilities/cookie-utils';
import { lang } from '../../lang.constants';

export default function CookieConsent() {
  const { addToast } = useToast();
  // Track if we've already shown the consent toast this session
  const hasShownRef = useRef(false);

  useEffect(() => {
    // Only show consent toast if user hasn't decided yet AND we haven't shown it this session
    if (!hasConsentDecided() && !hasShownRef.current) {
      hasShownRef.current = true;
      addToast({
        message: lang.current.cookieConsent.message,
        type: 'primary',
        bg: 'primary',
        position: 'bottom-end', // Bottom-right position
        duration: 30000, // 30 seconds
        showCloseButton: true,
        animation: 'slide',
        actions: [
          {
            label: lang.current.cookieConsent.accept,
            variant: 'light',
            onClick: () => {
              setConsentGiven();
              // Toast will auto-dismiss, cookies enabled for future requests
            }
          },
          {
            label: lang.current.cookieConsent.decline,
            variant: 'outline-light',
            onClick: () => {
              setConsentDeclined();
              // App will continue using localStorage
            }
          }
        ]
      });
    }
  }, [addToast]); // Re-run if addToast changes - ref prevents duplicate toasts

  // This component doesn't render anything visible
  // It only manages the toast notification
  return null;
}

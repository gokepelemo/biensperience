/**
 * CookieConsent Component
 * Displays a toast notification requesting cookie consent from the user
 * Only shows if user hasn't made a consent decision yet
 * Integrates with cookie-utils to manage consent state
 */

import { useEffect } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { 
  hasConsentDecided, 
  setConsentGiven, 
  setConsentDeclined 
} from '../../utilities/cookie-utils';
import { lang } from '../../lang.constants';

export default function CookieConsent() {
  const { addToast } = useToast();

  useEffect(() => {
    // Only show consent toast if user hasn't decided yet
    if (!hasConsentDecided()) {
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
  }, [addToast]); // Re-run if addToast changes (shouldn't happen due to useCallback in context)

  // This component doesn't render anything visible
  // It only manages the toast notification
  return null;
}

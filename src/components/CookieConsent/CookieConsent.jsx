/**
 * CookieConsent Component
 * Displays a simple toast notification with cookie consent options
 * Links to the full Cookie Policy modal via hash navigation
 */

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../contexts/ToastContext';
import {
  hasConsentDecided,
  setConsentGiven,
  setConsentDeclined
} from '../../utilities/cookie-utils';
import { lang } from '../../lang.constants';

export default function CookieConsent() {
  const { addToast, removeToast } = useToast();
  const navigate = useNavigate();
  // Track if we've already shown the consent toast this session
  const hasShownRef = useRef(false);
  // Store toast ID to remove it when Learn More is clicked
  const toastIdRef = useRef(null);

  useEffect(() => {
    // Only show consent toast if user hasn't decided yet AND we haven't shown it this session
    if (!hasConsentDecided() && !hasShownRef.current) {
      hasShownRef.current = true;

      const handleLearnMoreClick = (e) => {
        e.preventDefault();
        // Remove the toast before navigating to the modal
        if (toastIdRef.current) {
          removeToast(toastIdRef.current);
        }
        // Navigate to cookie policy modal with consent mode flag
        navigate('#cookies?consent=true');
      };

      const toastId = addToast({
        message: (
          <span>
            {lang.current.cookieConsent.message}
            <a
              href="#cookies"
              onClick={handleLearnMoreClick}
              style={{
                color: 'inherit',
                textDecoration: 'none',
                fontWeight: 600,
                marginLeft: '0.5em',
                borderBottom: '2px dotted currentColor',
                paddingBottom: '2px',
                cursor: 'pointer'
              }}
            >
              {lang.current.cookieConsent.learnMore}
            </a>
          </span>
        ),
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

      toastIdRef.current = toastId;
    }
  }, [addToast, removeToast, navigate]); // Re-run if addToast changes - ref prevents duplicate toasts

  // This component doesn't render anything visible
  // It only manages the toast notification
  return null;
}

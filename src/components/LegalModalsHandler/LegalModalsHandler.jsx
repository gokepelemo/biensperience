import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import TermsOfServiceModal from '../TermsOfServiceModal/TermsOfServiceModal';
import PrivacyPolicyModal from '../PrivacyPolicyModal/PrivacyPolicyModal';
import CookiePolicyModal from '../CookiePolicyModal/CookiePolicyModal';
import { logger } from '../../utilities/logger';
import { STORAGE_KEYS } from '../../utilities/storage-keys';
import {
  setConsentGiven,
  setConsentDeclined
} from '../../utilities/cookie-utils';

/**
 * Hash-based modal handler for Terms of Service, Privacy Policy, and Cookie Policy
 *
 * Listens for URL hash changes and displays the appropriate modal:
 * - #terms or #terms-of-service → Terms of Service Modal
 * - #privacy or #privacy-policy → Privacy Policy Modal
 * - #cookies or #cookie-policy → Cookie Policy Modal
 * - #cookies?consent=true → Cookie Policy Modal with Accept/Decline buttons
 *
 * When the modal is closed, the hash is removed from the URL.
 * This enables direct linking to these legal documents.
 *
 * @example
 * // Direct links:
 * https://biensperience.com/#terms
 * https://biensperience.com/#privacy
 * https://biensperience.com/#cookies
 *
 * // Also works with paths:
 * https://biensperience.com/experiences#terms
 */
export default function LegalModalsHandler() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showCookies, setShowCookies] = useState(false);
  const [cookieConsentMode, setCookieConsentMode] = useState(false);
  const closingRef = useRef(false);

  const isLegalHash = useCallback((hash) => {
    const h = (hash || '').toLowerCase();
    return (
      h === '#terms' ||
      h === '#terms-of-service' ||
      h === '#privacy' ||
      h === '#privacy-policy' ||
      h.startsWith('#cookies') ||
      h === '#cookie-policy'
    );
  }, []);

  // Handle hash changes to show/hide modals
  useEffect(() => {
    // Skip if a close is in progress — the hash will be cleared momentarily
    if (closingRef.current) return;

    const hash = location.hash.toLowerCase();

    if (hash === '#terms' || hash === '#terms-of-service') {
      logger.debug('[LegalModalsHandler] Opening Terms of Service modal via hash');
      setShowTerms(true);
      setShowPrivacy(false);
      setShowCookies(false);
      setCookieConsentMode(false);
    } else if (hash === '#privacy' || hash === '#privacy-policy') {
      logger.debug('[LegalModalsHandler] Opening Privacy Policy modal via hash');
      setShowPrivacy(true);
      setShowTerms(false);
      setShowCookies(false);
      setCookieConsentMode(false);
    } else if (hash.startsWith('#cookies') || hash === '#cookie-policy') {
      // Check if consent mode is enabled via query param in hash
      const isConsentMode = hash.includes('consent=true');
      logger.debug('[LegalModalsHandler] Opening Cookie Policy modal via hash', { isConsentMode });
      setShowCookies(true);
      setShowTerms(false);
      setShowPrivacy(false);
      setCookieConsentMode(isConsentMode);
    } else {
      setShowTerms(false);
      setShowPrivacy(false);
      setShowCookies(false);
      setCookieConsentMode(false);
    }
  }, [location.hash]);

  // Clear hash when modal is closed
  const clearHash = useCallback(() => {
    // Only clear hashes we own (terms/privacy/cookies). This prevents accidental
    // clobbering of other deep links (e.g. #plan-... for SingleExperience).
    if (!isLegalHash(location.hash)) {
      logger.debug('[LegalModalsHandler] Skipping hash clear (non-legal hash)', {
        hash: location.hash
      });
      return;
    }

    // Remove hash from URL while preserving the current path and search params
    const newUrl = location.pathname + location.search;
    navigate(newUrl, { replace: true });

    // Clear the pending hash from localStorage so the hash restoration effect
    // in App.jsx does not re-apply it after login
    try {
      localStorage.removeItem(STORAGE_KEYS.pendingHash);
    } catch (e) {
      // Silently ignore storage errors
    }
  }, [isLegalHash, location.hash, location.pathname, location.search, navigate]);

  const handleTermsClose = useCallback(() => {
    logger.debug('[LegalModalsHandler] Closing Terms of Service modal');
    closingRef.current = true;
    setShowTerms(false);
    clearHash();
    // Allow the hash effect to run again after navigate has settled
    requestAnimationFrame(() => { closingRef.current = false; });
  }, [clearHash]);

  const handlePrivacyClose = useCallback(() => {
    logger.debug('[LegalModalsHandler] Closing Privacy Policy modal');
    closingRef.current = true;
    setShowPrivacy(false);
    clearHash();
    requestAnimationFrame(() => { closingRef.current = false; });
  }, [clearHash]);

  const handleCookiesClose = useCallback(() => {
    logger.debug('[LegalModalsHandler] Closing Cookie Policy modal');
    closingRef.current = true;
    setShowCookies(false);
    clearHash();
    requestAnimationFrame(() => { closingRef.current = false; });
  }, [clearHash]);

  // Always render modals but control visibility through show prop for instant unmounting
  return (
    <>
      <TermsOfServiceModal
        show={showTerms}
        onClose={handleTermsClose}
        showBackButton={false}
      />
      <PrivacyPolicyModal
        show={showPrivacy}
        onClose={handlePrivacyClose}
        showBackButton={false}
      />
      <CookiePolicyModal
        show={showCookies}
        onClose={handleCookiesClose}
        showBackButton={false}
        showConsentButtons={cookieConsentMode}
        onAccept={setConsentGiven}
        onDecline={setConsentDeclined}
      />
    </>
  );
}

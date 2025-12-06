import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import TermsOfServiceModal from '../TermsOfServiceModal/TermsOfServiceModal';
import PrivacyPolicyModal from '../PrivacyPolicyModal/PrivacyPolicyModal';
import { logger } from '../../utilities/logger';

/**
 * Hash-based modal handler for Terms of Service and Privacy Policy
 *
 * Listens for URL hash changes and displays the appropriate modal:
 * - #terms or #terms-of-service → Terms of Service Modal
 * - #privacy or #privacy-policy → Privacy Policy Modal
 *
 * When the modal is closed, the hash is removed from the URL.
 * This enables direct linking to these legal documents.
 *
 * @example
 * // Direct links:
 * https://biensperience.com/#terms
 * https://biensperience.com/#privacy
 *
 * // Also works with paths:
 * https://biensperience.com/experiences#terms
 */
export default function LegalModalsHandler() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  // Handle hash changes to show/hide modals
  useEffect(() => {
    const hash = location.hash.toLowerCase();

    if (hash === '#terms' || hash === '#terms-of-service') {
      logger.debug('[LegalModalsHandler] Opening Terms of Service modal via hash');
      setShowTerms(true);
      setShowPrivacy(false);
    } else if (hash === '#privacy' || hash === '#privacy-policy') {
      logger.debug('[LegalModalsHandler] Opening Privacy Policy modal via hash');
      setShowPrivacy(true);
      setShowTerms(false);
    } else {
      // Close modals if hash changes to something else
      if (showTerms || showPrivacy) {
        setShowTerms(false);
        setShowPrivacy(false);
      }
    }
  }, [location.hash, showTerms, showPrivacy]);

  // Clear hash when modal is closed
  const clearHash = useCallback(() => {
    // Remove hash from URL while preserving the current path and search params
    const newUrl = location.pathname + location.search;
    navigate(newUrl, { replace: true });
  }, [location.pathname, location.search, navigate]);

  const handleTermsClose = useCallback(() => {
    logger.debug('[LegalModalsHandler] Closing Terms of Service modal');
    setShowTerms(false);
    clearHash();
  }, [clearHash]);

  const handlePrivacyClose = useCallback(() => {
    logger.debug('[LegalModalsHandler] Closing Privacy Policy modal');
    setShowPrivacy(false);
    clearHash();
  }, [clearHash]);

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
    </>
  );
}

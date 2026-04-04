/**
 * BienBotHashHandler — global hash-based deep-link handler for BienBot sessions.
 *
 * Listens for URL hash changes and opens the BienBot panel to the requested session:
 *   #bienbot-session-{24-hex-objectid}  →  opens BienBot to that session
 *
 * Works for:
 *  - ActivityFeed "View session" anchor links
 *  - In-app notification actions
 *  - Sharable/external links (e.g. future email notifications)
 *
 * Rendered exclusively for authenticated users in App.jsx, alongside
 * LegalModalsHandler.
 *
 * @module components/BienBotHashHandler
 */

import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { openWithSession } from '../../hooks/useBienBot';
import { isBienBotHash, parseBienBotHash } from '../../utilities/hash-navigation';
import { logger } from '../../utilities/logger';

/**
 * BienBotHashHandler is a pure side-effect component — it renders nothing.
 *
 * @returns {null}
 */
export default function BienBotHashHandler() {
  const location = useLocation();
  const navigate = useNavigate();
  // Track the last-handled hash to prevent double-firing (StrictMode / fast navigation)
  const lastHandledRef = useRef(null);

  useEffect(() => {
    const { hash } = location;
    if (!hash || !isBienBotHash(hash)) return;

    // Same hash already handled in this mount cycle — skip
    if (lastHandledRef.current === hash) return;
    lastHandledRef.current = hash;

    const { sessionId } = parseBienBotHash(hash);
    if (!sessionId) return;

    logger.debug('[BienBotHashHandler] Opening session from hash', { sessionId });

    // Open the panel to this session via the event bus
    openWithSession(sessionId);

    // Clear the hash from the URL so the back button doesn't re-trigger the panel
    navigate(location.pathname + (location.search || ''), { replace: true });
  }, [location, navigate]);

  // Reset ref when hash is cleared so the same session can be re-opened later
  useEffect(() => {
    if (!location.hash) {
      lastHandledRef.current = null;
    }
  }, [location.hash]);

  return null;
}

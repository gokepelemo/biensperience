import { useCallback, useEffect, useRef, useState } from 'react';
import { StreamChat } from 'stream-chat';

import { getChatToken } from '../utilities/chat-api';
import { logger } from '../utilities/logger';

/**
 * Shared Stream Chat client lifecycle hook.
 *
 * Purpose:
 * - Centralize Stream Chat client initialization (token fetch, connectUser)
 * - Avoid duplication across chat UIs (MessagesModal, PlanItemDetailsModal, ChatModal)
 * - Provide safe, idempotent disconnect behavior
 *
 * Design:
 * - `connectWhen` controls when we *start* a connection.
 * - `disconnectWhen` controls when we *force* disconnect.
 * - If `connectWhen` becomes false later, we do NOT auto-disconnect.
 *   (This supports "connect when tab is opened, keep connected while modal open" patterns.)
 *
 * @param {Object} params
 * @param {boolean} params.connectWhen - When true, initializes a client connection (if not already connected)
 * @param {boolean} params.disconnectWhen - When true, disconnects and clears state
 * @param {string} params.apiKey - Stream Chat API key
 * @param {(apiKey: string) => StreamChat} [params.clientFactory] - Optional factory (defaults to StreamChat.getInstance)
 * @param {string} [params.context] - Logging context label
 * @param {number} [params.deferDisconnectMs=0] - Optional delay to allow UI to unmount before disconnect
 */
export default function useStreamChat({
  connectWhen,
  disconnectWhen,
  apiKey,
  clientFactory,
  context = 'useStreamChat',
  deferDisconnectMs = 0
}) {
  const [client, setClient] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const clientRef = useRef(null);
  // Track an in-flight connect so StrictMode effect re-runs don't get stuck.
  const connectPromiseRef = useRef(null);

  const disconnect = useCallback(async () => {
    const existing = clientRef.current;
    clientRef.current = null;

    // Clear state first so Stream components unmount before disconnect.
    setClient(null);
    setCurrentUser(null);
    setError('');
    setLoading(false);

    if (!existing) return;

    const doDisconnect = async () => {
      try {
        await existing.disconnectUser();
      } catch (e) {
        // ignore
      }
    };

    if (deferDisconnectMs > 0) {
      setTimeout(() => {
        doDisconnect().catch(() => {});
      }, deferDisconnectMs);
      return;
    }

    if (deferDisconnectMs === 0) {
      setTimeout(() => {
        doDisconnect().catch(() => {});
      }, 0);
      return;
    }

    // Fallback: immediate
    await doDisconnect();
  }, [deferDisconnectMs]);

  useEffect(() => {
    if (!disconnectWhen) return undefined;

    disconnect().catch(() => {});
    return undefined;
  }, [disconnectWhen, disconnect]);

  useEffect(() => {
    let cancelled = false;

    const waitForInFlightConnect = async () => {
      const inflight = connectPromiseRef.current;
      if (!inflight) return;

      // Ensure consumers show a loading state while we await the existing connect.
      setLoading(true);

      try {
        await inflight;
      } catch (e) {
        // The in-flight connect already handled state/error.
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    async function connect() {
      if (!connectWhen) return;
      if (!apiKey) return;
      if (clientRef.current) return;

      // If another effect run already started connecting, await it instead of bailing.
      if (connectPromiseRef.current) {
        await waitForInFlightConnect();

        // React 18 StrictMode mounts effects twice in dev.
        // The first run can be "cancelled" by the intentional cleanup, which means
        // the in-flight connect may resolve without setting clientRef.
        // If we're still not connected after awaiting, retry a fresh connect.
        if (clientRef.current) return;
        if (!connectWhen) return;
        if (!apiKey) return;
      }

      setLoading(true);
      setError('');

      try {
        const doConnect = async () => {
          const { token, user } = await getChatToken();

          const factory =
            clientFactory ||
            ((key) => {
              return StreamChat.getInstance(key);
            });

          const streamClient = factory(apiKey);

          await streamClient.connectUser(
            {
              id: user.id,
              name: user.name
            },
            token
          );

          if (cancelled) {
            try {
              await streamClient.disconnectUser();
            } catch (e) {
              // ignore
            }
            return;
          }

          clientRef.current = streamClient;
          setClient(streamClient);
          setCurrentUser(user);
        };

        // Store the promise so StrictMode (and other rapid re-renders) can await it.
        connectPromiseRef.current = doConnect();
        await connectPromiseRef.current;
      } catch (err) {
        logger.error(`[${context}] Failed to initialize Stream Chat client`, err);
        if (!cancelled) {
          setError(err?.message || 'Failed to initialize chat');
        }
      } finally {
        connectPromiseRef.current = null;
        if (!cancelled) setLoading(false);
      }
    }

    connect();

    return () => {
      cancelled = true;
    };
  }, [connectWhen, apiKey, clientFactory, context]);

  return {
    client,
    currentUser,
    loading,
    error,
    setError,
    disconnect
  };
}

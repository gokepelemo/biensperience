import { useState, useMemo, useCallback } from 'react';
import { useFeatureFlag } from './useFeatureFlag';
import { getOrCreatePlanChannel } from '../utilities/chat-api';

/**
 * Custom hook for managing plan chat functionality
 * @param {Object} params - Hook parameters
 * @param {string} params.planId - The plan ID
 * @param {Object} params.user - Current user object
 * @param {Object} params.planOwner - Plan owner object
 * @returns {Object} Chat state and handlers
 */
export function usePlanChat({ planId, user, planOwner }) {
  // State
  const [showMessagesModal, setShowMessagesModal] = useState(false);
  const [messagesInitialChannelId, setMessagesInitialChannelId] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');

  // Check if chat is configured (API key present)
  const chatConfigured = Boolean(import.meta.env.VITE_STREAM_CHAT_API_KEY);

  // Check if chat is enabled for this plan - useFeatureFlag must be called at hook level
  const { enabled: chatEnabled } = useFeatureFlag('chat', {
    user: planOwner,
    fallback: false
  });

  // Handler to open plan chat
  const openPlanChat = useCallback(async () => {
    if (!chatEnabled || chatLoading || !planId) return;

    setChatError('');
    setChatLoading(true);

    try {
      const result = await getOrCreatePlanChannel(planId);
      setMessagesInitialChannelId(result?.id || '');
      setShowMessagesModal(true);
    } catch (err) {
      setChatError(err?.message || 'Failed to open plan chat');
    } finally {
      setChatLoading(false);
    }
  }, [chatEnabled, chatLoading, planId]);

  return {
    chatEnabled,
    chatLoading,
    chatError,
    showMessagesModal,
    setShowMessagesModal,
    messagesInitialChannelId,
    openPlanChat
  };
}
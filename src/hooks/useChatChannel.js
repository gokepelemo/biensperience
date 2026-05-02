import { useEffect, useMemo, useRef, useState } from 'react';
import useStreamChat from './useStreamChat';
import { getOrCreatePlanItemChannel } from '../utilities/chat-api';
import { getFriendlyChatErrorMessage } from '../utilities/chat-error-utils';
import { logger } from '../utilities/logger';

function normalizeId(id) {
  if (!id) return null;
  if (typeof id === 'string') return id;
  if (typeof id === 'object' && id.toString) return id.toString();
  return String(id);
}

export default function useChatChannel({
  show,
  activeTab,
  apiKey,
  plan,
  planItem,
}) {
  const planItemIdStr = normalizeId(planItem?._id);
  const planIdStr = normalizeId(plan?._id);

  const [uiTheme, setUiTheme] = useState(() => {
    try {
      const root = document?.documentElement;
      const theme = root?.getAttribute('data-theme');
      return theme === 'dark' ? 'dark' : 'light';
    } catch (e) {
      return 'light';
    }
  });

  useEffect(() => {
    if (!show) return undefined;
    try {
      const root = document?.documentElement;
      if (!root || !window?.MutationObserver) return undefined;

      const updateTheme = () => {
        try {
          const theme = root.getAttribute('data-theme');
          setUiTheme(theme === 'dark' ? 'dark' : 'light');
        } catch (e) {
          // ignore
        }
      };

      updateTheme();

      const observer = new MutationObserver(updateTheme);
      observer.observe(root, {
        attributes: true,
        attributeFilter: ['data-theme'],
      });

      return () => observer.disconnect();
    } catch (e) {
      return undefined;
    }
  }, [show]);

  const [chatChannel, setChatChannel] = useState(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');
  const chatChannelPlanItemIdRef = useRef(null);

  const canInitChat = useMemo(
    () => Boolean(show && activeTab === 'chat' && apiKey && planIdStr && planItemIdStr),
    [show, activeTab, apiKey, planIdStr, planItemIdStr]
  );

  const {
    client: chatClient,
    loading: chatClientLoading,
    error: chatClientError,
  } = useStreamChat({
    connectWhen: canInitChat,
    disconnectWhen: !show,
    apiKey,
    context: 'PlanItemDetailsModal',
  });

  useEffect(() => {
    let cancelled = false;

    async function initChat() {
      if (!canInitChat) return;
      if (!chatClient || typeof chatClient.channel !== 'function') return;

      const currentChannelPlanItemId = chatChannelPlanItemIdRef.current;
      if (currentChannelPlanItemId && currentChannelPlanItemId !== planItemIdStr) {
        setChatChannel(null);
        chatChannelPlanItemIdRef.current = null;
        return;
      }

      if (chatClient && chatChannel && currentChannelPlanItemId === planItemIdStr) return;

      setChatLoading(true);
      setChatError('');

      try {
        const { id: channelId } = await getOrCreatePlanItemChannel(planIdStr, planItemIdStr);
        const streamChannel = chatClient.channel('messaging', channelId);
        await streamChannel.watch();

        if (!cancelled) {
          setChatChannel(streamChannel);
          chatChannelPlanItemIdRef.current = planItemIdStr;
        }
      } catch (err) {
        logger.error('[useChatChannel] Failed to initialize plan item chat', err);
        if (!cancelled) {
          setChatError(
            getFriendlyChatErrorMessage(err, {
              defaultMessage: 'Failed to initialize chat',
            })
          );
        }
      } finally {
        if (!cancelled) setChatLoading(false);
      }
    }

    initChat();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canInitChat, chatClient, chatChannel, planIdStr, planItemIdStr]);

  useEffect(() => {
    if (show) return;
    setChatChannel(null);
    setChatError('');
    setChatLoading(false);
    chatChannelPlanItemIdRef.current = null;
  }, [show]);

  const mergedChatError = chatClientError || chatError;
  const mergedChatLoading = chatClientLoading || chatLoading;
  const chatNotReady = canInitChat && (!chatClient || !chatChannel);
  const chatShouldShowLoading =
    (canInitChat && (mergedChatLoading || chatNotReady)) ||
    (canInitChat && !mergedChatError && !chatClient && !chatClientLoading);

  return {
    chatClient,
    chatChannel,
    mergedChatError,
    mergedChatLoading,
    canInitChat,
    chatNotReady,
    chatShouldShowLoading,
    uiTheme,
  };
}

import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Chat,
  Channel,
  ChannelHeader,
  MessageInput,
  MessageList,
  Thread,
  Window
} from 'stream-chat-react';
import 'stream-chat-react/dist/css/v2/index.css';

import Modal from '../Modal/Modal';
import Alert from '../Alert/Alert';
import styles from './ChatModal.module.scss';

import { logger } from '../../utilities/logger';
import useStreamChat from '../../hooks/useStreamChat';
import { getFriendlyChatErrorMessage } from '../../utilities/chat-error-utils';

export default function ChatModal({ show, onClose, title, channelType = 'messaging', channelId }) {
  const apiKey = import.meta.env.VITE_STREAM_CHAT_API_KEY;

  const [channel, setChannel] = useState(null);
  const [channelLoading, setChannelLoading] = useState(false);
  const [channelError, setChannelError] = useState('');

  const canInit = useMemo(() => {
    return Boolean(show && apiKey && channelId);
  }, [show, apiKey, channelId]);

  const {
    client,
    loading: clientLoading,
    error: clientError
  } = useStreamChat({
    connectWhen: canInit,
    disconnectWhen: !show,
    apiKey,
    context: 'ChatModal'
  });

  useEffect(() => {
    let cancelled = false;

    async function initChannel() {
      if (!canInit) return;
      if (!client) return;

      setChannelLoading(true);
      setChannelError('');

      try {
        const streamChannel = client.channel(channelType, channelId);
        await streamChannel.watch();
        if (!cancelled) setChannel(streamChannel);
      } catch (err) {
        logger.error('[ChatModal] Failed to initialize channel', err);
        if (!cancelled) {
          setChannelError(getFriendlyChatErrorMessage(err, { defaultMessage: 'Failed to initialize chat' }));
        }
      } finally {
        if (!cancelled) setChannelLoading(false);
      }
    }

    initChannel();

    return () => {
      cancelled = true;
    };
  }, [canInit, client, channelId, channelType]);

  useEffect(() => {
    if (!show) {
      setChannel(null);
      setChannelError('');
      setChannelLoading(false);
    }
  }, [show]);

  const error = clientError || channelError;
  const loading = clientLoading || channelLoading;

  return (
    <Modal
      show={show}
      onClose={onClose}
      title={title}
      size="xl"
      scrollable={false}
      showSubmitButton={false}
    >
      {!apiKey && (
        <Alert
          type="danger"
          message="Chat is not configured (missing VITE_STREAM_CHAT_API_KEY)."
        />
      )}

      {error && <Alert type="danger" message={error} />}

      {loading && <div>Loading chat…</div>}

      {!loading && client && channel && (
        <div className={styles.chatContainer}>
          <Chat client={client} theme="str-chat__theme-light">
            <Channel channel={channel}>
              <Window>
                <ChannelHeader />
                <MessageList />
                <MessageInput focus />
              </Window>
              <Thread />
            </Channel>
          </Chat>
        </div>
      )}
    </Modal>
  );
}

ChatModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.node,
  channelType: PropTypes.string,
  channelId: PropTypes.string
};

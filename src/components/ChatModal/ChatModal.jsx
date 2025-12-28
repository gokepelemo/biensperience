import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { StreamChat } from 'stream-chat';
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

import { getChatToken } from '../../utilities/chat-api';
import { logger } from '../../utilities/logger';

export default function ChatModal({ show, onClose, title, channelType = 'messaging', channelId }) {
  const apiKey = import.meta.env.VITE_STREAM_CHAT_API_KEY;

  const [client, setClient] = useState(null);
  const [channel, setChannel] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canInit = useMemo(() => {
    return Boolean(show && apiKey && channelId);
  }, [show, apiKey, channelId]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!canInit) return;

      setLoading(true);
      setError('');

      try {
        const { token, user } = await getChatToken();

        const streamClient = StreamChat.getInstance(apiKey);
        await streamClient.connectUser(
          {
            id: user.id,
            name: user.name
          },
          token
        );

        const streamChannel = streamClient.channel(channelType, channelId);
        await streamChannel.watch();

        if (cancelled) {
          try {
            await streamClient.disconnectUser();
          } catch (disconnectErr) {
            // Ignore
          }
          return;
        }

        setClient(streamClient);
        setChannel(streamChannel);
      } catch (err) {
        logger.error('[ChatModal] Failed to initialize chat', err);
        if (!cancelled) {
          setError(err?.message || 'Failed to initialize chat');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [canInit, apiKey, channelId, channelType]);

  useEffect(() => {
    if (!show) {
      setChannel(null);
      setError('');
      setLoading(false);

      if (client) {
        client
          .disconnectUser()
          .catch(() => {
            // Ignore
          })
          .finally(() => {
            setClient(null);
          });
      }
    }
  }, [show, client]);

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

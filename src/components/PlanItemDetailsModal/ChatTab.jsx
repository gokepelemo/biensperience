import { Channel, Chat, MessageInput, MessageList, Thread, Window } from 'stream-chat-react';
import { Alert } from '../design-system';
import Loading from '../Loading/Loading';
import StreamChatAvatar from '../ChatModal/StreamChatAvatar';
import styles from './PlanItemDetailsModal.module.css';

export default function ChatTab({
  streamApiKey,
  mergedChatError,
  mergedChatLoading,
  chatShouldShowLoading,
  chatClient,
  chatChannel,
  uiTheme,
}) {
  return (
    <div className={styles.chatTabWrapper}>
      {!streamApiKey && (
        <Alert
          type="danger"
          message="Chat is not configured (missing VITE_STREAM_CHAT_API_KEY)."
        />
      )}

      {mergedChatError && <Alert type="danger" message={mergedChatError} />}

      {streamApiKey && !mergedChatError && chatShouldShowLoading && (
        <Loading size="sm" variant="centered" message="Loading chat..." />
      )}

      {!mergedChatLoading && chatClient && chatChannel && (
        <div className={styles.chatPane}>
          <Chat
            client={chatClient}
            theme={uiTheme === 'dark' ? 'str-chat__theme-dark' : 'str-chat__theme-light'}
          >
            <Channel channel={chatChannel} Avatar={StreamChatAvatar}>
              <Window>
                <MessageList />
                <MessageInput focus />
              </Window>
              <Thread />
            </Channel>
          </Chat>
        </div>
      )}
    </div>
  );
}

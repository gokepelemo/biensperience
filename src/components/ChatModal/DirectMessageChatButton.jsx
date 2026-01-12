import { useState } from 'react';
import PropTypes from 'prop-types';

import { Button } from '../design-system';
import Alert from '../Alert/Alert';

import MessagesModal from './MessagesModal';
import { getOrCreateDmChannel } from '../../utilities/chat-api';
import { getFriendlyChatErrorMessage } from '../../utilities/chat-error-utils';
import { logger } from '../../utilities/logger';

export default function DirectMessageChatButton({ otherUserId, otherUserName = 'User', buttonText = 'Message' }) {
  const [show, setShow] = useState(false);
  const [channelId, setChannelId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleOpen = async () => {
    setError('');
    setLoading(true);

    try {
      const result = await getOrCreateDmChannel(otherUserId);
      setChannelId(result.id);
      setShow(true);
    } catch (err) {
      logger.error('[DirectMessageChatButton] Failed to open DM', err);
      setError(getFriendlyChatErrorMessage(err, { defaultMessage: 'Failed to open DM' }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {error && <Alert type="danger" message={error} />}

      <Button variant="outline-primary" size="sm" onClick={handleOpen} disabled={loading}>
        {loading ? 'Opening…' : buttonText}
      </Button>

      <MessagesModal
        show={show}
        onClose={() => setShow(false)}
        title={`Message ${otherUserName}`}
        initialChannelId={channelId}
      />
    </>
  );
}

DirectMessageChatButton.propTypes = {
  otherUserId: PropTypes.string.isRequired,
  otherUserName: PropTypes.string,
  buttonText: PropTypes.string
};

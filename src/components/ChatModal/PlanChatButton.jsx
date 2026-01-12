import { useState } from 'react';
import PropTypes from 'prop-types';

import { Button } from '../design-system';
import Alert from '../Alert/Alert';

import MessagesModal from './MessagesModal';
import { getOrCreatePlanChannel } from '../../utilities/chat-api';
import { getFriendlyChatErrorMessage } from '../../utilities/chat-error-utils';
import { logger } from '../../utilities/logger';

export default function PlanChatButton({ planId, buttonText = 'Open Plan Chat' }) {
  const [show, setShow] = useState(false);
  const [channelId, setChannelId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleOpen = async () => {
    setError('');
    setLoading(true);

    try {
      const result = await getOrCreatePlanChannel(planId);
      setChannelId(result.id);
      setShow(true);
    } catch (err) {
      logger.error('[PlanChatButton] Failed to open plan chat', err);
      setError(getFriendlyChatErrorMessage(err, { defaultMessage: 'Failed to open plan chat' }));
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
        title="Plan Chat"
        initialChannelId={channelId}
      />
    </>
  );
}

PlanChatButton.propTypes = {
  planId: PropTypes.string.isRequired,
  buttonText: PropTypes.string
};

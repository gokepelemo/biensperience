import { useState } from 'react';
import PropTypes from 'prop-types';

import { Button } from '../design-system';
import Alert from '../Alert/Alert';

import MessagesModal from './MessagesModal';
import { getOrCreatePlanItemChannel } from '../../utilities/chat-api';
import { logger } from '../../utilities/logger';

export default function PlanItemChatButton({ planId, planItemId, buttonText = 'Open Item Chat' }) {
  const [show, setShow] = useState(false);
  const [channelId, setChannelId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleOpen = async () => {
    setError('');
    setLoading(true);

    try {
      const result = await getOrCreatePlanItemChannel(planId, planItemId);
      setChannelId(result.id);
      setShow(true);
    } catch (err) {
      logger.error('[PlanItemChatButton] Failed to open plan item chat', err);
      setError(err?.message || 'Failed to open plan item chat');
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
        title="Plan Item Chat"
        initialChannelId={channelId}
      />
    </>
  );
}

PlanItemChatButton.propTypes = {
  planId: PropTypes.string.isRequired,
  planItemId: PropTypes.string.isRequired,
  buttonText: PropTypes.string
};

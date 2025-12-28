/**
 * CuratorPlanners Component
 * Displays users who have planned the curator's experiences with messaging action
 *
 * Only visible to users with the 'curator' feature flag.
 */

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';
import { FaEnvelope, FaUser, FaMapMarkerAlt, FaChevronRight } from 'react-icons/fa';
import { Button } from '../design-system';
import Loading from '../Loading/Loading';
import MessagesModal from '../ChatModal/MessagesModal';
import { getCuratorPlanners } from '../../utilities/activities-api';
import { getOrCreateDmChannel } from '../../utilities/chat-api';
import { logger } from '../../utilities/logger';
import { formatRelativeTime } from '../../utilities/date-utils';
import styles from './CuratorPlanners.module.scss';

export default function CuratorPlanners({ user }) {
  const [planners, setPlanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  const [experiences, setExperiences] = useState([]);

  // Messaging state
  const [showMessagesModal, setShowMessagesModal] = useState(false);
  const [targetUserId, setTargetUserId] = useState(null);
  const [channelId, setChannelId] = useState(null);
  const [messageLoading, setMessageLoading] = useState(null);

  const fetchPlanners = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getCuratorPlanners({ limit: 20 });

      if (response.success) {
        setPlanners(response.planners || []);
        setTotal(response.total || 0);
        setExperiences(response.curatorExperiences || []);
      } else {
        setError(response.error || 'Failed to load planners');
      }
    } catch (err) {
      logger.error('[CuratorPlanners] Failed to fetch', err);
      setError(err.message || 'Failed to load planners');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlanners();
  }, [fetchPlanners]);

  const handleMessagePlanner = async (planner) => {
    setMessageLoading(planner.userId);

    try {
      const result = await getOrCreateDmChannel(planner.userId);
      setChannelId(result.id);
      setTargetUserId(planner.userId);
      setShowMessagesModal(true);
    } catch (err) {
      logger.error('[CuratorPlanners] Failed to open DM', err);
      setError(err.message || 'Failed to open message');
    } finally {
      setMessageLoading(null);
    }
  };

  const handleCloseMessages = () => {
    setShowMessagesModal(false);
    setChannelId(null);
    setTargetUserId(null);
  };

  if (loading) {
    return (
      <div className={styles.curatorPlanners}>
        <Loading variant="inline" size="sm" message="Loading your audience..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.curatorPlanners}>
        <div className={styles.error}>
          <p>{error}</p>
          <Button variant="outline" size="sm" onClick={fetchPlanners}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (planners.length === 0) {
    return (
      <div className={styles.curatorPlanners}>
        <div className={styles.empty}>
          <FaUser className={styles.emptyIcon} />
          <p>No one has planned your experiences yet.</p>
          <small>When users plan your curated experiences, they&apos;ll appear here.</small>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.curatorPlanners}>
      <div className={styles.header}>
        <h4>Your Audience</h4>
        <span className={styles.count}>{total} {total === 1 ? 'planner' : 'planners'}</span>
      </div>

      <p className={styles.subtitle}>
        These users have planned your curated experiences. You can message them directly.
      </p>

      <div className={styles.plannersList}>
        {planners.map((planner) => (
          <div key={planner.userId} className={styles.plannerItem}>
            <div className={styles.plannerInfo}>
              <div className={styles.avatar}>
                <FaUser />
              </div>
              <div className={styles.details}>
                <Link to={`/profile/${planner.userId}`} className={styles.name}>
                  {planner.userName}
                </Link>
                <div className={styles.meta}>
                  <span className={styles.planCount}>
                    {planner.planCount} {planner.planCount === 1 ? 'plan' : 'plans'}
                  </span>
                  {planner.latestPlanDate && (
                    <span className={styles.lastActive}>
                      Last: {formatRelativeTime(planner.latestPlanDate)}
                    </span>
                  )}
                </div>
                {planner.experiences && planner.experiences.length > 0 && (
                  <div className={styles.experiences}>
                    <FaMapMarkerAlt className={styles.experienceIcon} />
                    <span>
                      {planner.experiences.map(e => e.name).join(', ')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className={styles.actions}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleMessagePlanner(planner)}
                disabled={messageLoading === planner.userId}
              >
                {messageLoading === planner.userId ? (
                  'Opening...'
                ) : (
                  <>
                    <FaEnvelope className="me-1" />
                    Message
                  </>
                )}
              </Button>
              <Link to={`/profile/${planner.userId}`} className={styles.viewProfile}>
                <FaChevronRight />
              </Link>
            </div>
          </div>
        ))}
      </div>

      {total > planners.length && (
        <div className={styles.loadMore}>
          <Button variant="outline" size="sm" onClick={() => {/* TODO: Implement pagination */}}>
            Load More
          </Button>
        </div>
      )}

      {/* Messages Modal */}
      <MessagesModal
        show={showMessagesModal}
        onClose={handleCloseMessages}
        initialChannelId={channelId}
        targetUserId={targetUserId}
      />
    </div>
  );
}

CuratorPlanners.propTypes = {
  user: PropTypes.object.isRequired
};

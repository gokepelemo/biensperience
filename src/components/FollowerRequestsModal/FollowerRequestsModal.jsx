/**
 * Follower Requests Modal
 *
 * Displays pending follow requests with pagination.
 * Users can accept or ignore requests.
 *
 * Task: biensperience-b361
 */

import { useState, useEffect, useCallback, useId } from 'react';
import { FaUserPlus, FaCheck, FaTimes } from 'react-icons/fa';
import { useUser } from '../../contexts/UserContext';
import { useToast } from '../../contexts/ToastContext';
import {
  getFollowRequests,
  acceptFollowRequest,
  rejectFollowRequest
} from '../../utilities/follows-api';
import { eventBus } from '../../utilities/event-bus';
import { logger } from '../../utilities/logger';
import { Modal, Button, Text } from '../design-system';
import Pagination from '../Pagination/Pagination';
import UserAvatar from '../UserAvatar/UserAvatar';
import Loading from '../Loading/Loading';
import styles from './FollowerRequestsModal.module.scss';

const REQUESTS_PER_PAGE = 10;

export default function FollowerRequestsModal({ show, onClose, onRequestCountChange }) {
  const { user } = useUser();
  const { success: showSuccess, error: showError } = useToast();
  const id = useId();

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState({}); // { [requesterId]: 'accept' | 'reject' }
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRequests, setTotalRequests] = useState(0);

  const totalPages = Math.ceil(totalRequests / REQUESTS_PER_PAGE);

  // Fetch requests
  const fetchRequests = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const skip = (page - 1) * REQUESTS_PER_PAGE;
      const result = await getFollowRequests({ limit: REQUESTS_PER_PAGE, skip });

      setRequests(result.requests || []);
      setTotalRequests(result.total || 0);
      setCurrentPage(page);

      // Notify parent of count change
      if (onRequestCountChange) {
        onRequestCountChange(result.total || 0);
      }
    } catch (err) {
      logger.error('Failed to fetch follow requests', { error: err.message }, err);
      showError('Failed to load follow requests');
    } finally {
      setLoading(false);
    }
  }, [showError, onRequestCountChange]);

  // Initial fetch when modal opens
  useEffect(() => {
    if (show) {
      fetchRequests(1);
    }
  }, [show, fetchRequests]);

  // Subscribe to follow request events for real-time updates
  useEffect(() => {
    const handleNewRequest = () => {
      // Refresh to show new request
      fetchRequests(currentPage);
    };

    const unsubCreate = eventBus.subscribe('follow:request:created', handleNewRequest);

    return () => {
      unsubCreate();
    };
  }, [currentPage, fetchRequests]);

  // Handle accept
  const handleAccept = async (requesterId, requesterName) => {
    setActionLoading(prev => ({ ...prev, [requesterId]: 'accept' }));
    try {
      await acceptFollowRequest(requesterId);
      showSuccess(`${requesterName} is now following you`);

      // Remove from local state
      setRequests(prev => prev.filter(r => r.follower._id !== requesterId));
      setTotalRequests(prev => Math.max(0, prev - 1));

      // Notify parent
      if (onRequestCountChange) {
        onRequestCountChange(Math.max(0, totalRequests - 1));
      }

      // If page is now empty and not first page, go to previous
      if (requests.length === 1 && currentPage > 1) {
        fetchRequests(currentPage - 1);
      }
    } catch (err) {
      logger.error('Failed to accept follow request', { error: err.message }, err);
      showError('Failed to accept request');
    } finally {
      setActionLoading(prev => {
        const updated = { ...prev };
        delete updated[requesterId];
        return updated;
      });
    }
  };

  // Handle reject/ignore
  const handleReject = async (requesterId) => {
    setActionLoading(prev => ({ ...prev, [requesterId]: 'reject' }));
    try {
      await rejectFollowRequest(requesterId);

      // Remove from local state
      setRequests(prev => prev.filter(r => r.follower._id !== requesterId));
      setTotalRequests(prev => Math.max(0, prev - 1));

      // Notify parent
      if (onRequestCountChange) {
        onRequestCountChange(Math.max(0, totalRequests - 1));
      }

      // If page is now empty and not first page, go to previous
      if (requests.length === 1 && currentPage > 1) {
        fetchRequests(currentPage - 1);
      }
    } catch (err) {
      logger.error('Failed to reject follow request', { error: err.message }, err);
      showError('Failed to decline request');
    } finally {
      setActionLoading(prev => {
        const updated = { ...prev };
        delete updated[requesterId];
        return updated;
      });
    }
  };

  // Format time ago
  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const diff = now - new Date(timestamp);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  // Render empty state
  const renderEmptyState = () => (
    <div className={styles.emptyState}>
      <FaUserPlus className={styles.emptyIcon} aria-hidden="true" />
      <Text weight="semibold" className="mb-2">No pending requests</Text>
      <Text variant="muted" size="sm">
        When someone requests to follow you, they&apos;ll appear here.
      </Text>
    </div>
  );

  // Render request list
  const renderRequests = () => (
    <div className={styles.requestList} role="list" aria-label="Follower requests">
      {requests.map(request => {
        const isAccepting = actionLoading[request.follower._id] === 'accept';
        const isRejecting = actionLoading[request.follower._id] === 'reject';
        const isProcessing = isAccepting || isRejecting;

        return (
          <div
            key={request._id}
            className={`${styles.requestItem} ${isProcessing ? styles.processing : ''}`}
            role="listitem"
          >
            <div className={styles.userInfo}>
              <UserAvatar
                user={request.follower}
                size="md"
                className={styles.avatar}
              />
              <div className={styles.userDetails}>
                <Text weight="medium">{request.follower.name}</Text>
                <Text variant="muted" size="sm">
                  {formatTimeAgo(request.requestedAt)}
                </Text>
              </div>
            </div>

            <div className={styles.actions}>
              <Button
                variant="gradient"
                size="sm"
                onClick={() => handleAccept(request.follower._id, request.follower.name)}
                disabled={isProcessing}
                aria-label={`Accept follow request from ${request.follower.name}`}
              >
                {isAccepting ? (
                  <Loading size="xs" showMessage={false} />
                ) : (
                  <>
                    <FaCheck className={styles.buttonIcon} aria-hidden="true" />
                    Accept
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleReject(request.follower._id)}
                disabled={isProcessing}
                aria-label={`Decline follow request from ${request.follower.name}`}
              >
                {isRejecting ? (
                  <Loading size="xs" showMessage={false} />
                ) : (
                  <>
                    <FaTimes className={styles.buttonIcon} aria-hidden="true" />
                    Ignore
                  </>
                )}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <Modal
      show={show}
      onClose={onClose}
      title={
        <span className={styles.modalTitle}>
          <FaUserPlus className={styles.titleIcon} aria-hidden="true" />
          Follower Requests
          {totalRequests > 0 && (
            <span className={styles.countBadge} aria-label={`${totalRequests} pending requests`}>
              {totalRequests}
            </span>
          )}
        </span>
      }
      size="lg"
      scrollable
      showSubmitButton={false}
      showCancelButton={false}
    >
      {loading && requests.length === 0 ? (
        <div className={styles.loadingState}>
          <Loading size="md" />
        </div>
      ) : requests.length === 0 ? (
        renderEmptyState()
      ) : (
        <>
          {renderRequests()}

          {totalPages > 1 && (
            <div className={styles.pagination}>
              <Pagination
                page={currentPage}
                totalPages={totalPages}
                onPageChange={fetchRequests}
                variant="compact"
                totalResults={totalRequests}
                resultsPerPage={REQUESTS_PER_PAGE}
                disabled={loading}
              />
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

import { useState, useEffect, useCallback, useRef } from 'react';
import { followUser, unfollowUser, removeFollower, getFollowStatus, getFollowRelationship, getFollowCounts, getFollowers, getFollowing } from '../utilities/follows-api';
import { eventBus } from '../utilities/event-bus';
import { useWebSocketEvents } from './useWebSocketEvents';
import { useToast } from '../contexts/ToastContext';
import { handleError } from '../utilities/error-handler';
import { getFirstName } from '../utilities/name-utils';
import { logger } from '../utilities/logger';
import { lang } from '../lang.constants';


/**
 * Manages all follow-related state, data fetching, event subscriptions, and actions.
 *
 * @param {Object} options
 * @param {string} options.userId - The profile user ID being viewed
 * @param {string} options.currentUserId - The logged-in user's ID
 * @param {boolean} options.isOwnProfile - Whether viewing own profile
 * @param {Object|null} options.currentProfile - The loaded profile object (for display names)
 * @param {boolean} options.followsTabActive - Whether the follows tab is currently active
 * @param {string} options.profileId - The raw profileId from URL params (for navigation detection)
 */
export function useFollowManager({
  userId,
  currentUserId,
  isOwnProfile,
  currentProfile,
  followsTabActive,
  profileId,
}) {
  const { success, error: showError, undoable } = useToast();
  const { subscribe: wsSubscribe, emit: wsEmit } = useWebSocketEvents();

  // Follow status state
  const [isFollowing, setIsFollowing] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 });
  const [followRelationship, setFollowRelationship] = useState(null);
  const [followButtonHovered, setFollowButtonHovered] = useState(false);
  const [followButtonConfirming, setFollowButtonConfirming] = useState(false);
  const followConfirmTimerRef = useRef(null);

  // Follows list state (for the follows tab)
  const [followsFilter, setFollowsFilter] = useState('followers');
  const [followsList, setFollowsList] = useState([]);
  const [followsLoading, setFollowsLoading] = useState(false);
  const [followsPagination, setFollowsPagination] = useState({ total: 0, hasMore: false, skip: 0 });

  // Track which follow actions are in progress (by user ID)
  const [followActionInProgress, setFollowActionInProgress] = useState({});

  // Refs to avoid subscription churn
  const followsFilterRef = useRef(followsFilter);
  const followsListLoadedRef = useRef(false);
  const followsListLengthRef = useRef(0);

  // Stale-request guards
  const activeUserIdRef = useRef(userId);
  const latestFollowDataRequestIdRef = useRef(0);
  const latestFollowsListRequestIdRef = useRef(0);

  // Track previous userId for follows tab
  const prevFollowsUserIdRef = useRef(null);

  // Track previous profileId for reset detection
  const prevProfileIdRef = useRef(profileId);

  // Keep refs fresh
  useEffect(() => {
    activeUserIdRef.current = userId;
  }, [userId]);

  useEffect(() => {
    followsFilterRef.current = followsFilter;
  }, [followsFilter]);

  useEffect(() => {
    followsListLoadedRef.current = Array.isArray(followsList) && followsList.length > 0;
    followsListLengthRef.current = Array.isArray(followsList) ? followsList.length : 0;
  }, [followsList]);

  // Reset state when navigating to a different profile
  useEffect(() => {
    if (prevProfileIdRef.current !== profileId) {
      setFollowCounts({ followers: 0, following: 0 });
      setIsFollowing(false);
      setIsPending(false);
      setFollowsList([]);
      setFollowsPagination({ total: 0, hasMore: false, skip: 0 });
      setFollowRelationship(null);
      setFollowActionInProgress({});
      setFollowButtonHovered(false);
      setFollowButtonConfirming(false);
      if (followConfirmTimerRef.current) {
        clearTimeout(followConfirmTimerRef.current);
        followConfirmTimerRef.current = null;
      }
      prevProfileIdRef.current = profileId;
    }
  }, [profileId]);

  // Fetch follow status and counts when viewing another user's profile
  useEffect(() => {
    if (!userId || !currentUserId || isOwnProfile) return;

    const fetchFollowData = async () => {
      const requestId = ++latestFollowDataRequestIdRef.current;
      const requestedUserId = userId;
      const isStale = () => activeUserIdRef.current !== requestedUserId || latestFollowDataRequestIdRef.current !== requestId;

      try {
        const [relationship, counts, status] = await Promise.all([
          getFollowRelationship(userId),
          getFollowCounts(userId),
          getFollowStatus(userId)
        ]);

        if (isStale()) return;

        setIsFollowing(Boolean(relationship?.isFollowing));
        setIsPending(Boolean(status?.isPending));
        setFollowRelationship(relationship || null);
        setFollowCounts(counts);
      } catch (err) {
        if (isStale()) return;
        logger.error('[useFollowManager] Failed to fetch follow data', { error: err.message });
      }
    };

    fetchFollowData();
  }, [userId, currentUserId, isOwnProfile]);

  // Fetch follow counts for own profile (to display in metrics)
  useEffect(() => {
    if (!userId || !isOwnProfile) return;

    const fetchOwnFollowCounts = async () => {
      const requestId = ++latestFollowDataRequestIdRef.current;
      const requestedUserId = userId;
      const isStale = () => activeUserIdRef.current !== requestedUserId || latestFollowDataRequestIdRef.current !== requestId;

      try {
        const counts = await getFollowCounts(userId);
        if (isStale()) return;
        setFollowCounts(counts);
      } catch (err) {
        if (isStale()) return;
        logger.error('[useFollowManager] Failed to fetch follow counts', { error: err.message });
      }
    };

    fetchOwnFollowCounts();
  }, [userId, isOwnProfile]);

  // Join the user's profile room for real-time follow updates
  useEffect(() => {
    if (!userId || !wsEmit) return;

    wsEmit('room:join', { roomId: `user:${userId}`, userId, type: 'user' }, { localOnly: false });

    return () => {
      wsEmit('room:leave', { roomId: `user:${userId}`, userId, type: 'user' }, { localOnly: false });
    };
  }, [userId, wsEmit]);

  // Listen for follow events (local + WebSocket)
  useEffect(() => {
    if (!userId) return;

    const handleFollowCreated = (event) => {
      const followingId = event.followingId || event.payload?.followingId;
      const eventUserId = event.userId || event.payload?.userId;
      const followerId = event.followerId || event.payload?.followerId;
      const followerName = event.followerName || event.payload?.followerName;

      if (followingId === userId || eventUserId === userId) {
        if (followerId === currentUserId) {
          setIsFollowing(true);
        }
        setFollowCounts(prev => ({ ...prev, followers: prev.followers + 1 }));

        if (followsFilterRef.current === 'followers' && followsListLoadedRef.current && followerId) {
          if (followerName) {
            setFollowsList(prev => {
              if (prev.some(f => f._id === followerId)) return prev;
              return [{
                _id: followerId,
                name: followerName,
                followedAt: new Date().toISOString()
              }, ...prev];
            });
            setFollowsPagination(prev => ({ ...prev, total: prev.total + 1 }));
          }
        }

        logger.debug('[useFollowManager] Follower count incremented via event', { followingId, userId, followerId });
      }
    };

    const handleFollowDeleted = (event) => {
      const followingId = event.followingId || event.payload?.followingId;
      const eventUserId = event.userId || event.payload?.userId;
      const followerId = event.followerId || event.payload?.followerId;

      if (followingId === userId || eventUserId === userId) {
        if (followerId === currentUserId) {
          setIsFollowing(false);
        }
        setFollowCounts(prev => ({ ...prev, followers: Math.max(0, prev.followers - 1) }));

        if (followsFilterRef.current === 'followers' && followerId) {
          setFollowsList(prev => prev.filter(f => f._id !== followerId));
          setFollowsPagination(prev => ({ ...prev, total: Math.max(0, prev.total - 1) }));
        }

        logger.debug('[useFollowManager] Follower count decremented via event', { followingId, userId, followerId });
      }
    };

    const handleFollowerRemoved = (event) => {
      const removedFollowerId =
        event.removedFollowerId ||
        event.followerId ||
        event.payload?.removedFollowerId ||
        event.payload?.followerId;
      const removedById =
        event.removedById ||
        event.userId ||
        event.payload?.removedById ||
        event.payload?.userId;

      if (!removedFollowerId || !removedById) return;

      if (removedById === userId && followsFilterRef.current === 'followers') {
        setFollowsList(prev => prev.filter(f => f._id !== removedFollowerId));
        setFollowCounts(prev => ({ ...prev, followers: Math.max(0, prev.followers - 1) }));
        setFollowsPagination(prev => ({ ...prev, total: Math.max(0, prev.total - 1) }));
        logger.debug('[useFollowManager] Follower removed from list via event', { removedFollowerId, removedById });
      }
    };

    const handleFollowRequestAccepted = (event) => {
      const followerId = event.followerId || event.payload?.followerId;
      const followingId = event.followingId || event.payload?.followingId;

      if (followerId === currentUserId && followingId === userId) {
        setIsFollowing(true);
        setIsPending(false);
        setFollowCounts(prev => ({ ...prev, followers: prev.followers + 1 }));
        logger.debug('[useFollowManager] Follow request accepted', { followerId, followingId });
      }
    };

    const unsubCreate = eventBus.subscribe('follow:created', handleFollowCreated);
    const unsubDelete = eventBus.subscribe('follow:deleted', handleFollowDeleted);
    const unsubRemoved = eventBus.subscribe('follower:removed', handleFollowerRemoved);
    const unsubAccepted = eventBus.subscribe('follow:request:accepted', handleFollowRequestAccepted);

    const unsubWsCreate = wsSubscribe?.('follow:created', handleFollowCreated);
    const unsubWsDelete = wsSubscribe?.('follow:deleted', handleFollowDeleted);
    const unsubWsRemoved = wsSubscribe?.('follower:removed', handleFollowerRemoved);
    const unsubWsAccepted = wsSubscribe?.('follow:request:accepted', handleFollowRequestAccepted);

    return () => {
      unsubCreate();
      unsubDelete();
      unsubRemoved();
      unsubAccepted();
      unsubWsCreate?.();
      unsubWsDelete?.();
      unsubWsRemoved?.();
      unsubWsAccepted?.();
    };
  }, [userId, currentUserId, wsSubscribe]);

  // Handle follow button click
  const handleFollow = useCallback(async () => {
    if (followLoading || !userId) return;

    if (userId === currentUserId) {
      showError(lang.current.toast.follow.cannotFollowSelf);
      return;
    }

    setFollowLoading(true);
    try {
      const result = await followUser(userId, currentUserId);

      const profileName = currentProfile?.name ? getFirstName(currentProfile.name) : lang.current.profile.thisUser;
      if (result.isPending) {
        setIsPending(true);
        setIsFollowing(false);
        success(lang.current.toast.follow.requestSent.replace('{name}', profileName));
      } else {
        setIsFollowing(true);
        setIsPending(false);
        success(lang.current.toast.follow.nowFollowing.replace('{name}', profileName));
      }

      try {
        const rel = await getFollowRelationship(userId);
        setFollowRelationship(rel || null);
      } catch (e) {
        // ignore relationship refresh errors
      }
    } catch (err) {
      const message = handleError(err, { context: 'Follow user' });
      showError(message || lang.current.toast.follow.failedToFollow);
    } finally {
      setFollowLoading(false);
    }
  }, [userId, currentUserId, currentProfile, followLoading, success, showError]);

  // Handle unfollow button click
  const handleUnfollow = useCallback(async () => {
    if (followLoading || !userId) return;

    if (userId === currentUserId) {
      showError(lang.current.toast.follow.invalidOperation);
      return;
    }

    setFollowLoading(true);
    try {
      await unfollowUser(userId, currentUserId);
      setIsFollowing(false);
      const profileName = currentProfile?.name ? getFirstName(currentProfile.name) : lang.current.profile.thisUser;

      undoable(lang.current.toast.follow.unfollowed.replace('{name}', profileName), {
        onUndo: async () => {
          try {
            await followUser(userId, currentUserId);
            setIsFollowing(true);
            setIsPending(false);
          } catch (err) {
            showError(lang.current.toast.follow.failedToRefollow);
          }
        },
        onExpire: () => {
          // Already unfollowed, nothing to do
        },
      });

      try {
        const rel = await getFollowRelationship(userId);
        setFollowRelationship(rel || null);
      } catch (e) {
        // ignore relationship refresh errors
      }
    } catch (err) {
      const message = handleError(err, { context: 'Unfollow user' });
      showError(message || lang.current.toast.follow.failedToUnfollow);
    } finally {
      setFollowLoading(false);
    }
  }, [userId, currentUserId, currentProfile, followLoading, undoable, showError]);

  // Touch-friendly unfollow: first tap reveals "Unfollow", second tap performs it.
  // On desktop, hover already reveals the label before click, so the action fires immediately.
  const handleFollowButtonClick = useCallback(() => {
    // If already showing unfollow state (via hover or prior tap), perform the action
    if (followButtonHovered || followButtonConfirming) {
      handleUnfollow();
      setFollowButtonConfirming(false);
      if (followConfirmTimerRef.current) {
        clearTimeout(followConfirmTimerRef.current);
        followConfirmTimerRef.current = null;
      }
      return;
    }

    // First tap on touch: enter confirming state, auto-reset after 3s
    setFollowButtonConfirming(true);
    if (followConfirmTimerRef.current) clearTimeout(followConfirmTimerRef.current);
    followConfirmTimerRef.current = setTimeout(() => {
      setFollowButtonConfirming(false);
      followConfirmTimerRef.current = null;
    }, 3000);
  }, [followButtonHovered, followButtonConfirming, handleUnfollow]);

  // Handle withdrawing a pending follow request
  const handleWithdrawRequest = useCallback(async () => {
    if (followLoading || !userId) return;
    setFollowLoading(true);
    try {
      await unfollowUser(userId, currentUserId);
      setIsPending(false);
      setIsFollowing(false);
      success(lang.current.toast.follow.requestWithdrawn);
    } catch (err) {
      const message = handleError(err, { context: 'Withdraw follow request' });
      showError(message || lang.current.toast.follow.failedToWithdraw);
    } finally {
      setFollowLoading(false);
    }
  }, [userId, currentUserId, followLoading, success, showError]);

  // Handle removing a follower from the followers list
  const handleRemoveFollower = useCallback(async (followerId, e) => {
    e?.preventDefault();
    e?.stopPropagation();

    if (followActionInProgress[followerId]) return;

    setFollowActionInProgress(prev => ({ ...prev, [followerId]: true }));

    const prevFollowsList = [...followsList];
    setFollowsList(prev => prev.filter(u => u._id !== followerId));

    try {
      await removeFollower(followerId, currentUserId);

      const removedUser = prevFollowsList.find(u => u._id === followerId);
      const followerName = removedUser?.name ? getFirstName(removedUser.name) : lang.current.profile.follower;

      undoable(lang.current.toast.follow.followerRemoved.replace('{name}', followerName), {
        onUndo: async () => {
          try {
            setFollowsList(prevFollowsList);
            setFollowCounts(prev => ({ ...prev, followers: prev.followers + 1 }));
            await followUser(currentUserId, followerId);
          } catch (err) {
            setFollowsList(prev => prev.filter(u => u._id !== followerId));
            setFollowCounts(prev => ({ ...prev, followers: Math.max(0, prev.followers - 1) }));
            showError(lang.current.toast.follow.failedToRestoreFollower);
          }
        },
        onExpire: () => {
          // Already removed, nothing to do
        },
      });

      setFollowCounts(prev => ({ ...prev, followers: Math.max(0, prev.followers - 1) }));
    } catch (err) {
      setFollowsList(prevFollowsList);
      const message = handleError(err, { context: 'Remove follower' });
      showError(message || lang.current.toast.follow.failedToRemoveFollower);
    } finally {
      setFollowActionInProgress(prev => ({ ...prev, [followerId]: false }));
    }
  }, [followsList, followActionInProgress, undoable, showError, currentUserId]);

  // Handle unfollowing a user from the following list
  const handleUnfollowFromList = useCallback(async (followingId, e) => {
    e?.preventDefault();
    e?.stopPropagation();

    if (followActionInProgress[followingId]) return;

    setFollowActionInProgress(prev => ({ ...prev, [followingId]: true }));

    const prevFollowsList = [...followsList];
    setFollowsList(prev => prev.filter(u => u._id !== followingId));
    setFollowCounts(prev => ({ ...prev, following: Math.max(0, prev.following - 1) }));

    try {
      await unfollowUser(followingId, currentUserId);

      const unfollowedUser = prevFollowsList.find(u => u._id === followingId);
      const userName = unfollowedUser?.name ? getFirstName(unfollowedUser.name) : lang.current.profile.thisUser;

      undoable(lang.current.toast.follow.unfollowed.replace('{name}', userName), {
        onUndo: async () => {
          try {
            setFollowsList(prevFollowsList);
            setFollowCounts(prev => ({ ...prev, following: prev.following + 1 }));
            await followUser(followingId, currentUserId);
          } catch (err) {
            setFollowsList(prev => prev.filter(u => u._id !== followingId));
            setFollowCounts(prev => ({ ...prev, following: Math.max(0, prev.following - 1) }));
            showError(lang.current.toast.follow.failedToRefollow);
          }
        },
        onExpire: () => {
          // Already unfollowed, nothing to do
        },
      });
    } catch (err) {
      setFollowsList(prevFollowsList);
      setFollowCounts(prev => ({ ...prev, following: prev.following + 1 }));
      const message = handleError(err, { context: 'Unfollow user' });
      showError(message || lang.current.toast.follow.failedToUnfollow);
    } finally {
      setFollowActionInProgress(prev => ({ ...prev, [followingId]: false }));
    }
  }, [followsList, followActionInProgress, undoable, showError, currentUserId]);

  // Fetch followers or following list
  const fetchFollowsList = useCallback(async (filter = followsFilter, reset = false) => {
    if (!userId) return;

    const requestId = ++latestFollowsListRequestIdRef.current;
    const requestedUserId = userId;
    const isStale = () => activeUserIdRef.current !== requestedUserId || latestFollowsListRequestIdRef.current !== requestId;

    setFollowsLoading(true);
    try {
      const skip = reset ? 0 : followsListLengthRef.current;
      const limit = 20;
      const options = { limit, skip };

      let response;
      if (filter === 'followers') {
        response = await getFollowers(userId, options);

        if (isStale()) return;

        const users = response.followers || [];
        setFollowsList(prev => reset ? users : [...prev, ...users]);
        setFollowsPagination({
          total: response.total || 0,
          hasMore: skip + users.length < (response.total || 0),
          skip: skip + users.length
        });
      } else {
        response = await getFollowing(userId, options);

        if (isStale()) return;

        const users = response.following || [];
        setFollowsList(prev => reset ? users : [...prev, ...users]);
        setFollowsPagination({
          total: response.total || 0,
          hasMore: skip + users.length < (response.total || 0),
          skip: skip + users.length
        });
      }
    } catch (err) {
      if (isStale()) return;
      logger.error('[useFollowManager] Failed to fetch follows list', { error: err.message });
    } finally {
      if (!isStale()) setFollowsLoading(false);
    }
  }, [userId, followsFilter]);

  // Handle follows filter change
  const handleFollowsFilterChange = useCallback((filter) => {
    setFollowsFilter(filter);
    setFollowsList([]);
    setFollowsPagination({ total: 0, hasMore: false, skip: 0 });
    fetchFollowsList(filter, true);
  }, [fetchFollowsList]);

  // Fetch follows list when tab becomes active or profile changes
  useEffect(() => {
    if (!followsTabActive || !userId) return;

    const userIdChanged = prevFollowsUserIdRef.current !== null && prevFollowsUserIdRef.current !== userId;

    if (userIdChanged || !followsListLoadedRef.current) {
      logger.debug('[useFollowManager] Fetching follows list', {
        userId,
        prevUserId: prevFollowsUserIdRef.current,
        userIdChanged,
        listLength: followsListLengthRef.current,
        filter: followsFilter
      });
      fetchFollowsList(followsFilter, true);
    }

    prevFollowsUserIdRef.current = userId;
  }, [followsTabActive, userId, followsFilter, fetchFollowsList]);

  return {
    // Follow status
    isFollowing,
    isPending,
    followLoading,
    followCounts,
    followRelationship,
    followButtonHovered,
    setFollowButtonHovered,
    followButtonConfirming,
    handleFollowButtonClick,

    // Follows list
    followsFilter,
    followsList,
    followsLoading,
    followsPagination,
    followActionInProgress,

    // Actions
    handleFollow,
    handleUnfollow,
    handleWithdrawRequest,
    handleRemoveFollower,
    handleUnfollowFromList,
    fetchFollowsList,
    handleFollowsFilterChange,
  };
}

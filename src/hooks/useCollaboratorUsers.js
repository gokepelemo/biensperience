import { useState, useEffect, useCallback, useRef } from 'react';
import { getBulkUserData } from '../utilities/users-api';
import { logger } from '../utilities/logger';

/**
 * Custom hook to fetch and manage collaborator user data
 * Ensures fresh user data is available for UsersListDisplay components
 * OPTIMIZATION: Uses bulk fetch API to get all users in a single request
 *
 * @param {Array} userIds - Array of user IDs to fetch
 * @returns {Object} { users: Array, loading: boolean, error: string|null, refetch: function }
 */
export function useCollaboratorUsers(userIds = []) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Track previous userIds to prevent duplicate fetches
  const prevUserIdsRef = useRef('');

  const fetchUsers = useCallback(async (ids) => {
    if (!ids || ids.length === 0) {
      setUsers([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // OPTIMIZATION: Fetch all users in a single bulk request instead of N individual requests
      const userData = await getBulkUserData(ids);
      setUsers(userData || []);
    } catch (err) {
      setError('Failed to fetch collaborator data');
      logger.error('Error fetching collaborators', { userIds: ids, error: err.message });
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch users when userIds change (compare by content, not reference)
  useEffect(() => {
    const userIdsString = JSON.stringify(userIds);

    // Only fetch if the IDs actually changed
    if (userIdsString !== prevUserIdsRef.current) {
      prevUserIdsRef.current = userIdsString;
      fetchUsers(userIds);
    }
  }, [userIds, fetchUsers]);

  const refetch = useCallback(() => {
    fetchUsers(userIds);
  }, [userIds, fetchUsers]);

  return {
    users,
    loading,
    error,
    refetch
  };
}
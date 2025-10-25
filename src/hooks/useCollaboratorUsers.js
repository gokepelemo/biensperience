import { useState, useEffect, useCallback, useRef } from 'react';
import { getUserData } from '../utilities/users-api';
import { debug } from '../utilities/debug';
import { logger } from '../utilities/logger';

/**
 * Custom hook to fetch and manage collaborator user data
 * Ensures fresh user data is available for UsersListDisplay components
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
      // Fetch user data for each ID
      const userPromises = ids.map(async (id) => {
        try {
          return await getUserData(id);
        } catch (err) {
          logger.warn('Failed to fetch user', { userId: id }, err);
          return null; // Return null for failed fetches
        }
      });

      const userData = await Promise.all(userPromises);
      // Filter out null results and set users
      setUsers(userData.filter(user => user !== null));
    } catch (err) {
      setError('Failed to fetch collaborator data');
      debug.error('Error fetching collaborators:', err);
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
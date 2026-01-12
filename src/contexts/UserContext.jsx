import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { getUser, logout } from '../utilities/users-service';
import themeManager from '../utilities/theme-manager';
import { getUserData } from '../utilities/users-api';
import { redeemInviteCode } from '../utilities/invite-codes-service';
import { getFavorites } from '../utilities/destinations-api';
import { logger } from '../utilities/logger';
import { eventBus } from '../utilities/event-bus';
import { LOCAL_CHANGE_PROTECTION_MS } from '../utilities/event-bus';
import { storePreferences } from '../utilities/preferences-utils';
// Intentionally do not clear plan cache on logout/user-switch.
// The consolidated cache is user-scoped internally (by userId) and safe to keep
// around so other users on the same device benefit from faster rendering.

const UserContext = createContext();

/**
 * Hook to access user state and authentication
 * @returns {Object} User context with current user, profile, and auth methods
 */
export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}

/**
 * User Provider Component
 * Centralized state management for user authentication and profile data
 * Manages user details, avatar, favorites, planned experiences, and permissions
 */
export function UserProvider({ children }) {
  const [user, setUser] = useState(getUser());
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [favoriteDestinations, setFavoriteDestinations] = useState([]);
  const [plannedExperiences, setPlannedExperiences] = useState([]);
  const inviteCodeRedeemedRef = useRef(false);
  const lastLocalPhotosUpdateRef = useRef(0);

  // Initialization tracking
  useEffect(() => {
    const initialUser = getUser();
    if (initialUser) {
      logger.info('User session initialized', {
        email: initialUser.email,
        id: initialUser._id
      });
    }
  }, []);

  /**
   * Fetch full user profile with favorites and plans
   */
  const fetchProfile = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const profileData = await getUserData(user._id);
      setProfile(profileData);

      // Persist user preferences to localStorage for immediate app-wide usage
      try {
        const prefs = profileData.preferences || {};
        // Keep this minimal (no notification webhooks in local storage)
        try {
          storePreferences({
            currency: prefs.currency || null,
            language: prefs.language || null,
            theme: prefs.theme || null,
            timezone: prefs.timezone || null
          });
        } catch (e) { /* ignore */ }
        // Apply theme immediately for user
        if (prefs.theme) {
          try { themeManager.applyTheme(prefs.theme); } catch (e) { /* ignore */ }
        }
      } catch (e) {
        // ignore localStorage/themeManager failures
      }

      // Extract planned experiences if provided
      if (profileData.experiences) {
        setPlannedExperiences(profileData.experiences);
      }

      // Some deployments compute favorite destinations on the server and include
      // `favoriteDestinations` on the profile object. If it's missing, derive
      // favorites by fetching destinations and filtering for those that include
      // this user in `users_favorite`.
      if (profileData.favoriteDestinations && profileData.favoriteDestinations.length > 0) {
        setFavoriteDestinations(profileData.favoriteDestinations);
      } else {
        // Lazy-load destinations and derive favorites (falls back to server-side support)
        try {
          // Use the new server endpoint that returns only the user's favorited destinations
          const favs = await getFavorites(user._id);
          if (Array.isArray(favs)) {
            setFavoriteDestinations(favs);
          } else {
            setFavoriteDestinations([]);
          }
        } catch (err) {
          // If destinations fetch fails, leave favorites as whatever server provided
          logger.debug('Failed to derive favorite destinations from destinations API', { error: err.message });
        }
      }
    } catch (error) {
      logger.error('Failed to fetch user profile', { error: error.message }, error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  /**
   * Update user state (for login, profile updates, etc.)
   * @param {Object} newUser - Updated user object
   */
  const updateUser = useCallback((newUser) => {
    setUser(newUser);

    // Fetch fresh profile data when user changes
    if (newUser) {
      fetchProfile();
    } else {
      // Clear profile data on logout
      setProfile(null);
      setFavoriteDestinations([]);
      setPlannedExperiences([]);
    }
  }, [fetchProfile]);

  /**
   * Logout and clear user state
   */
  const logoutUser = useCallback(() => {
    logout();
    setUser(null);
    setProfile(null);
    setFavoriteDestinations([]);
    setPlannedExperiences([]);
  }, []);

  /**
   * Check if a destination is favorited
   * @param {string} destinationId - Destination ID
   * @returns {boolean} True if favorited
   */
  const isFavoriteDestination = useCallback((destinationId) => {
    return favoriteDestinations.some(dest =>
      (dest._id || dest) === destinationId
    );
  }, [favoriteDestinations]);

  /**
   * Check if an experience is planned
   * @param {string} experienceId - Experience ID
   * @returns {boolean} True if planned
   */
  const isPlannedExperience = useCallback((experienceId) => {
    return plannedExperiences.some(exp =>
      (exp._id || exp) === experienceId
    );
  }, [plannedExperiences]);

  /**
   * Add a destination to favorites (optimistic update)
   * @param {string|Object} destination - Destination ID or object
   */
  const addFavoriteDestination = useCallback((destination) => {
    const destId = typeof destination === 'string' ? destination : destination._id;

    setFavoriteDestinations(prev => {
      // Avoid duplicates
      if (prev.some(d => (d._id || d) === destId)) {
        return prev;
      }
      return [...prev, destination];
    });
  }, []);

  /**
   * Remove a destination from favorites (optimistic update)
   * @param {string} destinationId - Destination ID
   */
  const removeFavoriteDestination = useCallback((destinationId) => {
    setFavoriteDestinations(prev =>
      prev.filter(dest => (dest._id || dest) !== destinationId)
    );
  }, []);

  /**
   * Toggle favorite destination
   * @param {string|Object} destination - Destination ID or object
   * @returns {boolean} New favorited state
   */
  const toggleFavoriteDestination = useCallback((destination) => {
    const destId = typeof destination === 'string' ? destination : destination._id;

    if (isFavoriteDestination(destId)) {
      removeFavoriteDestination(destId);
      return false;
    } else {
      addFavoriteDestination(destination);
      return true;
    }
  }, [isFavoriteDestination, addFavoriteDestination, removeFavoriteDestination]);

  /**
   * Add an experience to planned experiences (optimistic update)
   * @param {string|Object} experience - Experience ID or object
   */
  const addPlannedExperience = useCallback((experience) => {
    const expId = typeof experience === 'string' ? experience : experience._id;

    setPlannedExperiences(prev => {
      // Avoid duplicates
      if (prev.some(e => (e._id || e) === expId)) {
        return prev;
      }
      return [...prev, experience];
    });
  }, []);

  /**
   * Remove an experience from planned experiences (optimistic update)
   * @param {string} experienceId - Experience ID
   */
  const removePlannedExperience = useCallback((experienceId) => {
    setPlannedExperiences(prev =>
      prev.filter(exp => (exp._id || exp) !== experienceId)
    );
  }, []);

  /**
   * Toggle planned experience
   * @param {string|Object} experience - Experience ID or object
   * @returns {boolean} New planned state
   */
  const togglePlannedExperience = useCallback((experience) => {
    const expId = typeof experience === 'string' ? experience : experience._id;

    if (isPlannedExperience(expId)) {
      removePlannedExperience(expId);
      return false;
    } else {
      addPlannedExperience(experience);
      return true;
    }
  }, [isPlannedExperience, addPlannedExperience, removePlannedExperience]);

  /**
   * Get user's avatar URL with fallback
   * @returns {string} Avatar URL or default avatar
   */
  const getAvatarUrl = useCallback(() => {
    if (profile?.profilePhoto) {
      return profile.profilePhoto;
    }

    if (user?.profilePhoto) {
      return user.profilePhoto;
    }

    // Default avatar (could be a placeholder image or initials-based avatar)
    return getDefaultAvatar(user?.name || 'User');
  }, [user, profile]);

  /**
   * Get user's display name
   * @returns {string} User's name
   */
  const getDisplayName = useCallback(() => {
    return profile?.name || user?.name || 'User';
  }, [user, profile]);

  /**
   * Get user's email
   * @returns {string} User's email
   */
  const getEmail = useCallback(() => {
    return profile?.email || user?.email || '';
  }, [user, profile]);

  /**
   * Check if current user is super admin
   * @returns {boolean} True if super admin
   */
  const isSuperAdmin = useCallback(() => {
    return user?.role === 'super_admin' || user?.isSuperAdmin === true;
  }, [user]);

  /**
   * Get user statistics
   * @returns {Object} User stats (favorites count, plans count, etc.)
   */
  const getStats = useCallback(() => {
    return {
      favoriteDestinationsCount: favoriteDestinations.length,
      plannedExperiencesCount: plannedExperiences.length,
      createdExperiencesCount: profile?.createdExperiences?.length || 0,
      createdDestinationsCount: profile?.createdDestinations?.length || 0,
    };
  }, [favoriteDestinations, plannedExperiences, profile]);

  // Auto-redeem invite code if user signed up with one
  useEffect(() => {
    // Check if user has invite code and hasn't been redeemed yet
    if (user && profile && profile.inviteCode && !inviteCodeRedeemedRef.current) {
      inviteCodeRedeemedRef.current = true;

      const redeemInvite = async () => {
        try {
          logger.info('Auto-redeeming invite code', {
            userId: user._id,
            inviteCode: profile.inviteCode
          });

          const result = await redeemInviteCode(profile.inviteCode);

          // Add returned destinations to favorites
          if (result.destinations && result.destinations.length > 0) {
            result.destinations.forEach(dest => {
              addFavoriteDestination(dest);
            });
          }

          // Refresh profile to get newly created plans
          await fetchProfile();

          logger.info('Invite code redeemed successfully', {
            userId: user._id,
            inviteCode: profile.inviteCode,
            experiencesCount: result.experiences?.length || 0,
            destinationsCount: result.destinations?.length || 0
          });
        } catch (error) {
          logger.error('Failed to redeem invite code', {
            userId: user._id,
            inviteCode: profile.inviteCode,
            error: error.message
          }, error);
          // Don't block user experience if redemption fails
          // The invite can be redeemed manually later
        }
      };

      redeemInvite();
    }
  }, [user, profile, fetchProfile, addFavoriteDestination]);

  // Fetch profile when user changes
  useEffect(() => {
    if (user) {
      fetchProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]); // Only re-fetch when user ID changes (fetchProfile intentionally excluded to prevent loops)

  // Listen for user:updated events to keep user state in sync
  // Supports both eventBus format (event.user) and CustomEvent format (event.detail.user)
  useEffect(() => {
    const handleUserUpdated = (event) => {
      const updatedUser = event.user || event.detail?.user;
      if (!updatedUser || !updatedUser._id) return;

      // Only update if this is the current logged-in user
      if (user && user._id === updatedUser._id) {
        logger.debug('[UserContext] user:updated event received', { id: updatedUser._id });

        // Update user state with new data
        setUser(prev => prev ? { ...prev, ...updatedUser } : updatedUser);

        // Update profile if we have one, but merge carefully to avoid
        // replacing populated `photos` (objects with url/_id) with
        // unpopulated arrays of IDs that the server may return. Skip the
        // profile update entirely if the merged result would be identical
        // to avoid unnecessary re-renders that could produce loops.
        setProfile(prev => {
          if (!prev) return updatedUser; // No existing profile - use server value
          if (!updatedUser) return prev; // Nothing to update

          // Smart-merge photos: preserve populated photos on the client
          const mergedPhotos = (() => {
            if (!Object.prototype.hasOwnProperty.call(updatedUser, 'photos')) return prev.photos;
            if (!prev.photos || prev.photos.length === 0) return updatedUser.photos;

            // Determine if incoming photos are unpopulated (strings/ObjectId)
            const incoming = updatedUser.photos;
            const isUnpopulated = Array.isArray(incoming) && incoming.length > 0 && (typeof incoming[0] === 'string');

            // If we recently edited photos locally, prefer local copy to avoid
            // re-applying server changes that reflect an earlier state. This
            // protects against a save -> server event -> re-init loop.
            try {
              const recent = lastLocalPhotosUpdateRef.current && (Date.now() - lastLocalPhotosUpdateRef.current) < LOCAL_CHANGE_PROTECTION_MS;
              if (recent) {
                return prev.photos;
              }
            } catch (e) {}

            if (isUnpopulated && Array.isArray(prev.photos) && prev.photos.length > 0 && typeof prev.photos[0] === 'object') {
              return prev.photos; // keep client-side populated previews
            }

            return updatedUser.photos;
          })();

          try {
            const merged = { ...prev, ...updatedUser, photos: mergedPhotos };
            try {
              if (JSON.stringify(prev) === JSON.stringify(merged)) return prev;
            } catch (e) {
              // Serialization failed, fall through to return merged
            }
            return merged;
          } catch (e) {
            // Fallback - if merge fails, don't wipe existing profile
            logger.warn('[UserContext] Failed to merge profile on user:updated', { error: e?.message });
            return prev;
          }
        });

        // Re-apply theme if preferences changed
        if (updatedUser.preferences?.theme) {
          try {
            themeManager.applyTheme(updatedUser.preferences.theme);
          } catch (e) {
            // ignore theme errors
          }
        }
      }
    };

    const unsubscribe = eventBus.subscribe('user:updated', handleUserUpdated);

    // Listen for local modification markers (e.g., photos updated locally)
    const unsubscribeLocal = eventBus.subscribe('local:photos-updated', (e) => {
      try {
        const detail = e || e.detail || {};
        if (detail && detail.userId && user && user._id && String(detail.userId) === String(user._id)) {
          lastLocalPhotosUpdateRef.current = detail.at || Date.now();
          logger.debug('[UserContext] Marked local photos update', { at: lastLocalPhotosUpdateRef.current });
        }
      } catch (err) {
        // ignore
      }
    });

    return () => {
      unsubscribe();
      unsubscribeLocal();
    };
  }, [user]);

  const value = {
    // Authentication state
    user,
    isAuthenticated: !!user,
    loading,

    // Profile data
    profile,
    favoriteDestinations,
    plannedExperiences,

    // Auth methods
    updateUser,
    logoutUser,
    fetchProfile,

    // Favorites methods
    isFavoriteDestination,
    addFavoriteDestination,
    removeFavoriteDestination,
    toggleFavoriteDestination,

    // Plans methods
    isPlannedExperience,
    addPlannedExperience,
    removePlannedExperience,
    togglePlannedExperience,

    // Utility methods
    getAvatarUrl,
    getDisplayName,
    getEmail,
    isSuperAdmin,
    getStats,
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}

/**
 * Generate default avatar based on user's name
 * @param {string} name - User's name
 * @returns {string} Data URL for avatar image or placeholder service URL
 */
function getDefaultAvatar(name) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=667eea&color=fff&size=200&bold=true`;
}

/**
 * Optional: Generate SVG avatar locally (no external dependency)
 * @param {string} initials - User initials
 * @returns {string} Data URL for SVG avatar
 */
export function generateSVGAvatar(initials) {
  const svg = `
    <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="200" fill="#667eea"/>
      <text
        x="50%"
        y="50%"
        dominant-baseline="central"
        text-anchor="middle"
        font-size="80"
        font-weight="bold"
        fill="#ffffff"
        font-family="Arial, sans-serif"
      >
        ${initials}
      </text>
    </svg>
  `;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

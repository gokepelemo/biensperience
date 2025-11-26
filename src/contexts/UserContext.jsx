import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { getUser, logout } from '../utilities/users-service';
import themeManager from '../utilities/theme-manager';
import { getUserData } from '../utilities/users-api';
import { redeemInviteCode } from '../utilities/invite-codes-service';
import { getFavorites } from '../utilities/destinations-api';
import { logger } from '../utilities/logger';

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
        const storageObj = {
          currency: prefs.currency || null,
          language: prefs.language || null,
          theme: prefs.theme || null,
        };
        try { localStorage.setItem('biensperience:preferences', JSON.stringify(storageObj)); } catch (e) { /* ignore */ }
        if (prefs.currency) {
          try { localStorage.setItem('biensperience:currency', prefs.currency); } catch (e) {}
        }
        if (prefs.language) {
          try { localStorage.setItem('biensperience:language', prefs.language); } catch (e) {}
        }
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
    // Clear stale plan cache when user changes (login/logout)
    // This prevents User A's cached plans from showing for User B
    try {
      const keysToRemove = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith('plan_')) {
          // Remove all plan cache entries
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => sessionStorage.removeItem(key));
    } catch (err) {
      // Silently fail if sessionStorage is not available
    }
    
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
    
    // Clear user-specific plan cache from sessionStorage
    // This prevents plan state from persisting across different user sessions
    try {
      const keysToRemove = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith('plan_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => sessionStorage.removeItem(key));
    } catch (err) {
      // Silently fail if sessionStorage is not available
    }
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

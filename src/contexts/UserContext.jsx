import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { getUser, logout } from '../utilities/users-service';
import { getUserData } from '../utilities/users-api';
import { logger } from '../utilities/logger';

logger.debug('UserContext module loaded');

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
  logger.debug('UserProvider function called');
  const [user, setUser] = useState(getUser());
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [favoriteDestinations, setFavoriteDestinations] = useState([]);
  const [plannedExperiences, setPlannedExperiences] = useState([]);

  // Debug initial user state
  useEffect(() => {
    const initialUser = getUser();
    logger.debug('UserContext initialized with user', {
      user: initialUser ? { email: initialUser.email, _id: initialUser._id } : null
    });
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

      // Extract favorites and planned experiences
      if (profileData.favoriteDestinations) {
        setFavoriteDestinations(profileData.favoriteDestinations);
      }

      if (profileData.experiences) {
        setPlannedExperiences(profileData.experiences);
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
    logger.debug('UserContext updateUser called', {
      user: newUser ? { email: newUser.email, _id: newUser._id } : null
    });
    setUser(newUser);

    // Fetch fresh profile data when user changes
    if (newUser) {
      logger.debug('User set, calling fetchProfile');
      fetchProfile();
    } else {
      logger.debug('User cleared, clearing profile data');
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
  // Using UI Avatars service (free, no API key needed)
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=667eea&color=fff&size=200&bold=true`;

  // Option 2: Generate a simple SVG avatar locally (no external dependency)
  // const initials = name.split(' ').map(part => part[0]).join('').toUpperCase().substring(0, 2);
  // const svgAvatar = generateSVGAvatar(initials);
  // return svgAvatar;
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

import * as usersAPI from "./users-api.js"
import { debug } from "./debug.js"
import { logger } from "./logger.js"

/**
 * Signs up a new user and stores their authentication token.
 * Handles Safari private browsing mode where localStorage may not be available.
 *
 * @async
 * @param {Object} userData - User registration data
 * @param {string} userData.name - User's full name
 * @param {string} userData.email - User's email address
 * @param {string} userData.password - User's password
 * @returns {Promise<Object|null>} User object if signup successful, null otherwise
 */
export async function signUp(userData) {
    const token = await usersAPI.signUp(userData);
    try {
        localStorage.setItem('token', token);
    } catch (error) {
        logger.warn('Failed to store token in localStorage', {}, error);
    }
    return getUser();
}

/**
 * Retrieves the stored authentication token if it exists and is not expired.
 * Handles Safari private browsing mode where localStorage may not be available.
 *
 * @returns {string|null} JWT token string or null if no valid token
 */
export function getToken() {
    try {
        const token = localStorage.getItem('token');
        if (!token) return null;
        
        // Validate token format (should be 3 parts separated by dots)
        const parts = token.split('.');
        if (parts.length !== 3) {
            logger.warn('Invalid token format - removing corrupted token');
            localStorage.removeItem('token');
            return null;
        }
        
        // Try to decode the payload
        try {
            const payload = JSON.parse(atob(parts[1]));
            if (payload.exp < Date.now() / 1000) {
                localStorage.removeItem('token');
                return null;
            }
            return token;
        } catch (decodeError) {
            // Token is corrupted or invalid
            logger.warn('Failed to decode token - removing corrupted token', { error: decodeError.message });
            localStorage.removeItem('token');
            return null;
        }
    } catch (error) {
        // Handle Safari private browsing mode or other localStorage issues
        logger.warn('localStorage access failed', {}, error);
        return null;
    }
}

/**
 * Retrieves the current user from the stored JWT token.
 *
 * @returns {Object|null} User object with id, name, email, or null if not authenticated
 */
export function getUser() {
    const token = getToken();
    debug.log('getUser called, token exists:', !!token);
    let user;
    if (token) {
        user = JSON.parse(atob(token.split('.')[1])).user;
        user.experiences = null;
        debug.log('getUser decoded user:', { email: user.email, _id: user._id });
    } else {
        debug.log('getUser: no token found');
    }
    return token ? user : null;
}

/**
 * Logs out the current user by removing their authentication token.
 * Handles Safari private browsing mode where localStorage may not be available.
 */
export function logout() {
    try {
        localStorage.removeItem('token');
    } catch (error) {
        logger.warn('Failed to remove token from localStorage', {}, error);
    }
}

export async function login(credentials) {
    debug.log('users-service login called with credentials:', { email: credentials.email });
    const token = await usersAPI.login(credentials);
    debug.log('users-service login got token:', token ? 'token received' : 'no token');
    try {
        localStorage.setItem('token', token);
        debug.log('Token stored in localStorage');
    } catch (error) {
        logger.warn('Failed to store token in localStorage', {}, error);
    }
    const user = getUser();
    debug.log('users-service login returning user:', user ? { email: user.email, _id: user._id } : null);
    return user;
}

export async function checkToken() {
    return usersAPI.checkToken().then(dateStr => new Date(dateStr))
}

/**
 * Updates the stored authentication token with new user data.
 * Used when user profile is updated to keep localStorage in sync.
 *
 * @param {string} token - New JWT token to store
 */
export function updateToken(token) {
    try {
        localStorage.setItem('token', token);
    } catch (error) {
        logger.warn('Failed to update token in localStorage', {}, error);
    }
}
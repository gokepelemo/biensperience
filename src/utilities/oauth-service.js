/**
 * OAuth Utilities
 * Handles OAuth callback token processing
 */

import { getUser } from './users-service';
import { clearStoredToken, setStoredToken } from './token-storage';
import { sendRequest } from './send-request';

/**
 * Process OAuth callback from URL parameters
 * Extracts token and provider from URL query params, stores token, and fetches user
 * 
 * @returns {Promise<Object|null>} User object if OAuth successful, null otherwise
 */
export async function handleOAuthCallback() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  const provider = urlParams.get('oauth');
  const error = urlParams.get('error');

  // Handle OAuth errors
  if (error) {
    const errorMessages = {
      facebook_auth_failed: 'Facebook authentication failed. Please try again.',
      facebook_token_failed: 'Failed to create login session with Facebook.',
      google_auth_failed: 'Google authentication failed. Please try again.',
      google_token_failed: 'Failed to create login session with Google.',
      twitter_auth_failed: 'X authentication failed. Please try again.',
      twitter_token_failed: 'Failed to create login session with X.',
      oauth_csrf_failed: 'Security validation failed. Please try signing in again.',
      facebook_link_failed: 'Failed to link Facebook account. Please try again.',
      google_link_failed: 'Failed to link Google account. Please try again.',
      twitter_link_failed: 'Failed to link X account. Please try again.',
    };

    throw new Error(errorMessages[error] || 'Authentication failed. Please try again.');
  }

  // If OAuth provider parameter exists, try to fetch user (cookies will be sent automatically)
  if (provider) {
    try {
      console.log('[OAuth] OAuth provider detected, fetching user profile...');
      // Fetch user data using cookie-based authentication
      const data = await sendRequest('/api/users/profile');
      const user = data.data;
      console.log('[OAuth] Successfully fetched user:', user.email);
      
      return { user, provider };
    } catch (err) {
      console.error('[OAuth] Error during OAuth auth:', err);
      // Remove any invalid tokens
      clearStoredToken();
      throw new Error(`Failed to complete ${provider} login. Please try again.`);
    }
  }

  // Legacy: If token exists in URL params, store it and fetch user
  if (token && provider) {
    try {
      // Store token in localStorage (encrypted at rest)
      setStoredToken(token);

      // Fetch user data
      const user = await getUser();

      // Clean up URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);

      return { user, provider };
    } catch (err) {
      // Remove invalid token
      clearStoredToken();
      throw new Error(`Failed to complete ${provider} login. Please try again.`);
    }
  }

  return null;
}

/**
 * Get linked accounts for current user
 *
 * @returns {Promise<Object>} Object with linked account status
 */
export async function getLinkedAccounts() {
  return sendRequest('/api/auth/linked-accounts');
}

/**
 * Unlink a social account
 *
 * @param {string} provider - Provider to unlink ('facebook', 'google', 'twitter')
 * @returns {Promise<Object>} Response data
 */
export async function unlinkAccount(provider) {
  return sendRequest(`/api/auth/unlink/${provider}`, 'DELETE');
}

/**
 * Link a social account (opens OAuth flow in same window)
 * 
 * @param {string} provider - Provider to link ('facebook', 'google', 'twitter')
 */
export function linkAccount(provider) {
  const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
  window.location.href = `${baseUrl}/api/auth/link/${provider}`;
}

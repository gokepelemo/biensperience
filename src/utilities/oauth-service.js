/**
 * OAuth Utilities
 * Handles OAuth callback token processing
 */

import { getUser } from './users-service';

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
      twitter_auth_failed: 'Twitter authentication failed. Please try again.',
      twitter_token_failed: 'Failed to create login session with Twitter.',
      oauth_csrf_failed: 'Security validation failed. Please try signing in again.',
      facebook_link_failed: 'Failed to link Facebook account. Please try again.',
      google_link_failed: 'Failed to link Google account. Please try again.',
      twitter_link_failed: 'Failed to link Twitter account. Please try again.',
    };

    throw new Error(errorMessages[error] || 'Authentication failed. Please try again.');
  }

  // If token exists, store it and fetch user
  if (token && provider) {
    try {
      // Store token in localStorage
      localStorage.setItem('token', token);

      // Fetch user data
      const user = await getUser();

      // Clean up URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);

      return { user, provider };
    } catch (err) {
      // Remove invalid token
      localStorage.removeItem('token');
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
  const token = localStorage.getItem('token');
  
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch('/api/auth/linked-accounts', {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch linked accounts');
  }

  return response.json();
}

/**
 * Unlink a social account
 * 
 * @param {string} provider - Provider to unlink ('facebook', 'google', 'twitter')
 * @returns {Promise<Object>} Response data
 */
export async function unlinkAccount(provider) {
  const token = localStorage.getItem('token');
  
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`/api/auth/unlink/${provider}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to unlink account');
  }

  return response.json();
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

import { getToken, logout } from "./users-service.js"
import { logger } from "./logger.js"
import { getSessionId, refreshSessionIfNeeded } from "./session-utils.js"
import { generateTraceId } from "./trace-utils.js"

/**
 * Cache for CSRF token to avoid repeated requests
 */
let csrfToken = null;
let csrfTokenPromise = null;

/**
 * Get CSRF token for state-changing requests
 * @returns {Promise<string>} CSRF token
 */
async function getCsrfToken() {
  // Return cached token if available
  if (csrfToken) {
    return csrfToken;
  }

  // Return pending request if already fetching
  if (csrfTokenPromise) {
    return csrfTokenPromise;
  }

  // Fetch new token
  csrfTokenPromise = fetch('/api/auth/csrf-token', {
    method: 'GET',
    credentials: 'include' // Include cookies for session
  })
  .then(res => {
    if (!res.ok) {
      throw new Error(`Failed to get CSRF token: ${res.status}`);
    }
    return res.json();
  })
  .then(data => {
    csrfToken = data.csrfToken;
    csrfTokenPromise = null;
    return csrfToken;
  })
  .catch(error => {
    csrfTokenPromise = null;
    logger.error('Failed to get CSRF token', error);
    throw error;
  });

  return csrfTokenPromise;
}

/**
 * Sends an HTTP request with optional authentication and JSON payload.
 *
 * @async
 * @param {string} url - The URL to send the request to
 * @param {string} [method="GET"] - HTTP method (GET, POST, PUT, DELETE, etc.)
 * @param {Object} [payload=null] - Request payload to be JSON stringified
 * @returns {Promise<Object>} Response data as JSON
 * @throws {Error} Throws 'Bad Request' if response is not ok
 */
export async function sendRequest(url, method = "GET", payload = null) {
    const options = { method };
    
    // Add CSRF token for state-changing requests
    const isStateChanging = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method.toUpperCase());
    
    if (payload) {
        options.headers = { 'Content-Type': 'application/json' };
        options.body = JSON.stringify(payload);
    }
    
    if (isStateChanging) {
        try {
            const token = await getCsrfToken();
            options.headers = options.headers || {};
            options.headers['x-csrf-token'] = token;
        } catch (error) {
            logger.warn('Failed to get CSRF token, proceeding without it', error);
        }
    }
    
    const token = getToken();
    if (token) {
        options.headers = options.headers || {};
        options.headers.Authorization = `Bearer ${token}`;
        
        // Add session ID for authenticated requests
        try {
            // Get user from token payload
            const payload = JSON.parse(atob(token.split('.')[1]));
            const userId = payload.user?._id;
            
            if (userId) {
                // Refresh session if needed
                const { sessionId } = await refreshSessionIfNeeded(userId);
                
                if (sessionId) {
                    options.headers['bien-session-id'] = sessionId;
                }
            }
        } catch (error) {
            logger.debug('Failed to extract user ID from token or refresh session', error);
            // Continue without session ID - not critical
        }
    }
    
    // Always add trace ID for request tracking
    const traceId = generateTraceId();
    options.headers = options.headers || {};
    options.headers['bien-trace-id'] = traceId;

    try {
        const res = await fetch(url, options);
        if (res.ok) return res.json();

        // Handle 401 Unauthorized - user deleted or token invalid
        if (res.status === 401) {
            logger.warn('Received 401 Unauthorized - logging out user', {
                url,
                method,
                status: res.status
            });

            // Clear token and redirect to login
            logout();

            // Redirect to home page (which will show login)
            window.location.href = '/';

            // Throw error to prevent further processing
            throw new Error('Session expired. Please log in again.');
        }

        // Log detailed error information for debugging
        const errorText = await res.text().catch(() => 'Unable to read error response');
        logger.error(`HTTP ${res.status} ${res.statusText}`, {
            url,
            method,
            status: res.status,
            statusText: res.statusText,
            errorText
        });

        // Try to parse JSON error response
        let errorMessage = `Request failed: ${res.status} ${res.statusText}`;
        try {
            const errorData = JSON.parse(errorText);
            if (errorData.error) {
                errorMessage = errorData.error;
            }
        } catch (e) {
            // If not JSON, use the text as-is if it's not too long
            if (errorText && errorText.length < 200) {
                errorMessage = errorText;
            }
        }

        throw new Error(errorMessage);
    } catch (error) {
        // Handle network errors, CORS issues, etc.
        logger.error('Network request failed', {
            url,
            method,
            error: error.message
        }, error);
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            throw new Error('Network error. Please check your connection and try again.');
        }
        throw error;
    }
}

/**
 * Uploads a file with optional authentication.
 *
 * @async
 * @param {string} url - The URL to upload the file to
 * @param {string} [method="POST"] - HTTP method for the upload
 * @param {FormData|File} [payload=null] - File or FormData payload
 * @returns {Promise<Object>} Response data as JSON
 * @throws {Error} Throws 'Bad Request' if response is not ok
 */
export async function uploadFile(url, method = "POST", payload = null) {
    const options = { method };
    if (payload) {
        options.body = payload;
    }
    const token = getToken();
    if (token) {
        options.headers = options.headers || {};
        options.headers.Authorization = `Bearer ${token}`;
    }

    try {
        const res = await fetch(url, options);
        if (res.ok) return res.json();

        // Handle 401 Unauthorized - user deleted or token invalid
        if (res.status === 401) {
            logger.warn('Received 401 Unauthorized during upload - logging out user', {
                url,
                method,
                status: res.status
            });

            // Clear token and redirect to login
            logout();

            // Redirect to home page (which will show login)
            window.location.href = '/';

            // Throw error to prevent further processing
            throw new Error('Session expired. Please log in again.');
        }

        // Log detailed error information for debugging
        const errorText = await res.text().catch(() => 'Unable to read error response');
        logger.error(`File upload failed with HTTP ${res.status} ${res.statusText}`, {
            url,
            method,
            status: res.status,
            statusText: res.statusText,
            errorText
        });
        throw new Error(`Upload failed: ${res.status} ${res.statusText}`);
    } catch (error) {
        // Handle network errors, CORS issues, etc.
        logger.error('File upload failed', {
            url,
            method,
            error: error.message
        }, error);
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            throw new Error('Network error during upload. Please check your connection and try again.');
        }
        throw error;
    }
}

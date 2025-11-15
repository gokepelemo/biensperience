import { getToken, logout } from "./users-service.js"
import { logger } from "./logger.js"
import { getSessionId, refreshSessionIfNeeded } from "./session-utils.js"
import { generateTraceId } from "./trace-utils.js"
import { broadcastEvent } from './event-bus';

// CSRF token cache
let csrfToken = null;
let csrfTokenPromise = null;

/**
 * Get CSRF token for state-changing requests
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
    logger.debug('[send-request] Starting request', { method, url, hasPayload: !!payload });

    // Default timeout for fetch requests (ms)
    const DEFAULT_TIMEOUT = 30000; // 30s
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

    const options = { method, signal: controller.signal };
    
    // Add CSRF token for state-changing requests
    const isStateChanging = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method.toUpperCase());
    
    if (payload) {
        options.headers = { 'Content-Type': 'application/json' };
        options.body = JSON.stringify(payload);
    }
    
    if (isStateChanging) {
        try {
            logger.debug('[send-request] Fetching CSRF token for state-changing request');
            const token = await getCsrfToken();
            logger.debug('[send-request] CSRF token received', { hasToken: !!token });
            options.headers = options.headers || {};
            options.headers['x-csrf-token'] = token;
        } catch (error) {
            logger.error('[send-request] Failed to get CSRF token', { error: error.message }, error);
        }
    }
    
    const token = getToken();
    if (token) {
        logger.debug('[send-request] JWT token found, adding to headers');
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
                    logger.debug('[send-request] Session ID attached');
                }
            }
        } catch (error) {
            logger.debug('[send-request] Session handling warning', { error: error.message });
            // Continue without session ID - not critical
        }
    } else {
        logger.warn('[send-request] No JWT token found - user may not be authenticated');
    }
    
    // Always add trace ID for request tracking
    const traceId = generateTraceId();
    options.headers = options.headers || {};
    options.headers['bien-trace-id'] = traceId;

    try {
        logger.debug('[send-request] Making fetch request', { 
            url, 
            method, 
            headers: Object.keys(options.headers || {})
        });
        const res = await fetch(url, options);
        clearTimeout(timeoutId);
        logger.debug('[send-request] Response received', { 
            status: res.status, 
            statusText: res.statusText,
            ok: res.ok
        });
        
        if (res.ok) {
            const data = await res.json();
            logger.debug('[send-request] Request successful', { hasData: !!data });
            return data;
        }

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

        // Try to parse JSON error response and attach structured response
        let errorMessage = `Request failed: ${res.status} ${res.statusText}`;
        let errorData = null;
        try {
            errorData = JSON.parse(errorText);
            if (errorData && errorData.error) {
                errorMessage = errorData.error;
            }
        } catch (e) {
            // If not JSON, use the text as-is if it's not too long
            if (errorText && errorText.length < 200) {
                errorMessage = errorText;
            }
        }

        const error = new Error(errorMessage);
        // Attach response-like shape to be compatible with axios-style handlers in the app
        error.response = {
            status: res.status,
            statusText: res.statusText,
            data: errorData || { error: errorMessage }
        };

        // If the backend indicates email verification is required, emit a global event
        try {
            if (res.status === 403 && errorData && errorData.code === 'EMAIL_NOT_VERIFIED') {
                if (typeof window !== 'undefined' && window.dispatchEvent) {
                    window.dispatchEvent(new CustomEvent('bien:email_not_verified', { detail: errorData }));
                    // Broadcast via centralized helper so other tabs receive it
                    try {
                        broadcastEvent('bien:email_not_verified', errorData);
                    } catch (e) {
                        // ignore
                    }
                }
            }
        } catch (e) {
            // ignore event dispatch errors
        }

        throw error;
    } catch (error) {
        // If the fetch was aborted due to timeout, normalize the error
        if (error.name === 'AbortError') {
            logger.error('Request timed out', { url, method, timeoutMs: DEFAULT_TIMEOUT });
            throw new Error('Request timed out. Please try again.');
        }
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
    // Add a short timeout for uploads as well
    const DEFAULT_TIMEOUT = 60000; // 60s
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

    const options = { method, signal: controller.signal };
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
        clearTimeout(timeoutId);
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
        if (error.name === 'AbortError') {
            logger.error('File upload timed out', { url, method, timeoutMs: DEFAULT_TIMEOUT });
            throw new Error('Upload timed out. Please try again.');
        }
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

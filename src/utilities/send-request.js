import { getToken, logout } from "./users-service.js"
import { logger } from "./logger.js"
import { getSessionId, refreshSessionIfNeeded } from "./session-utils.js"
import { generateTraceId } from "./trace-utils.js"
import { broadcastEvent } from './event-bus';
import {
    isErrorResponse,
    extractError,
    handleNetworkError
} from './error-handler';
import { getRequestQueue, PRIORITY } from './request-queue';

// CSRF token cache
let csrfToken = null;
let csrfTokenPromise = null;

/**
 * Clear cached CSRF token (e.g., after CSRF validation failure)
 */
function clearCsrfToken() {
  csrfToken = null;
  csrfTokenPromise = null;
  logger.debug('[send-request] CSRF token cache cleared');
}

/**
 * Get CSRF token for state-changing requests
 * @param {boolean} forceRefresh - Force fetching a new token
 */
async function getCsrfToken(forceRefresh = false) {
  // Clear cache if force refresh requested
  if (forceRefresh) {
    clearCsrfToken();
  }

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
        credentials: 'include', // Include cookies for session
        cache: 'no-store'
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
    logger.debug('[send-request] CSRF token fetched successfully');
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
 * @param {Object} [options={}] - Additional options
 * @param {boolean} [options._isRetry=false] - Internal flag to prevent infinite retries
 * @returns {Promise<Object>} Response data as JSON
 * @throws {Error} Throws 'Bad Request' if response is not ok
 */
export async function sendRequest(url, method = "GET", payload = null, requestOptions = {}) {
    logger.trace('[send-request] Starting request', { method, url, hasPayload: !!payload });

    // Default timeout for fetch requests (ms)
    const DEFAULT_TIMEOUT = 30000; // 30s
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

    // Always include cookies (session + CSRF) for API requests.
    // This is required for CSRF validation and for any cookie-based auth/session features.
    // It also prevents subtle failures when frontend/backend run on different ports.
    const fetchOptions = { method, signal: controller.signal, credentials: 'include' };
    
    // Add CSRF token for state-changing requests
    const isStateChanging = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method.toUpperCase());
    
    if (payload) {
        fetchOptions.headers = { 'Content-Type': 'application/json' };
        fetchOptions.body = JSON.stringify(payload);
    }

    if (isStateChanging) {
        try {
            logger.trace('[send-request] Fetching CSRF token for state-changing request');
            const token = await getCsrfToken();
            logger.trace('[send-request] CSRF token received', { hasToken: !!token });
            fetchOptions.headers = fetchOptions.headers || {};
            fetchOptions.headers['x-csrf-token'] = token;
        } catch (error) {
            logger.error('[send-request] Failed to get CSRF token', { error: error.message }, error);
        }
    }

    const token = getToken();
    if (token) {
        logger.trace('[send-request] JWT token found, adding to headers');
        fetchOptions.headers = fetchOptions.headers || {};
        fetchOptions.headers.Authorization = `Bearer ${token}`;

        // Add session ID for authenticated requests
        try {
            // Get user from token payload
            const tokenPayload = JSON.parse(atob(token.split('.')[1]));
            const userId = tokenPayload.user?._id;

            if (userId) {
                // Refresh session if needed
                const { sessionId } = await refreshSessionIfNeeded(userId);

                if (sessionId) {
                    fetchOptions.headers['bien-session-id'] = sessionId;
                    logger.trace('[send-request] Session ID attached');
                }
            }
        } catch (error) {
            logger.trace('[send-request] Session handling warning', { error: error.message });
            // Continue without session ID - not critical
        }
    } else {
        logger.debug('[send-request] No JWT token found - user may not be authenticated');
    }

    // Always add trace ID for request tracking
    const traceId = generateTraceId();
    fetchOptions.headers = fetchOptions.headers || {};
    fetchOptions.headers['bien-trace-id'] = traceId;

    try {
        logger.trace('[send-request] Making fetch request', {
            url,
            method,
            headers: Object.keys(fetchOptions.headers || {})
        });
        const res = await fetch(url, fetchOptions);
        clearTimeout(timeoutId);
        logger.trace('[send-request] Response received', {
            status: res.status,
            statusText: res.statusText,
            ok: res.ok
        });

        if (res.ok) {
            const data = await res.json();
            logger.trace('[send-request] Request successful', { hasData: !!data });
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

        // Handle 403 Forbidden - could be CSRF token issue
        if (res.status === 403) {
            const errorBody = await res.clone().text().catch(() => '');
            const isCsrfError = errorBody.toLowerCase().includes('csrf') ||
                               errorBody.toLowerCase().includes('invalid token');

            if (isCsrfError && isStateChanging && !requestOptions._isRetry) {
                logger.warn('CSRF token validation failed, clearing cache and retrying once', {
                    url,
                    method
                });

                // Clear the cached CSRF token
                clearCsrfToken();

                // Retry once with a fresh token
                return sendRequest(url, method, payload, { ...requestOptions, _isRetry: true });
            }
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

            // Check if this is a structured error response
            if (isErrorResponse(errorData)) {
                const structuredError = extractError(errorData);
                if (structuredError) {
                    errorMessage = structuredError.userMessage || structuredError.message || errorMessage;

                    // Dispatch structured error event for toast handling via eventBus
                    // broadcastEvent handles both local tab and cross-tab dispatch
                    try {
                        broadcastEvent('bien:api_error', {
                            error: structuredError,
                            response: errorData,
                            url,
                            method,
                            status: res.status
                        });
                    } catch (e) {
                        // ignore broadcast errors
                    }
                }
            } else if (errorData && errorData.error) {
                // Legacy error format
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

        // If the backend indicates email verification is required, emit event via eventBus
        // broadcastEvent handles both local tab and cross-tab dispatch
        try {
            if (res.status === 403 && errorData && errorData.code === 'EMAIL_NOT_VERIFIED') {
                broadcastEvent('bien:email_not_verified', errorData);
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
export async function uploadFile(url, method = "POST", payload = null, requestOptions = {}) {
    // Default timeout for uploads (ms). Can be overridden via requestOptions.timeoutMs.
    // Document uploads with AI processing can take several minutes, so use a generous default.
    const DEFAULT_TIMEOUT = 5 * 60 * 1000; // 5 minutes
    const timeoutMs = Number.isFinite(requestOptions.timeoutMs)
        ? requestOptions.timeoutMs
        : DEFAULT_TIMEOUT;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const options = { method, signal: controller.signal, credentials: 'include' };
    if (payload) {
        options.body = payload;
    }

    // Add CSRF token for state-changing requests (uploads are typically POST)
    const isStateChanging = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method.toUpperCase());
    if (isStateChanging) {
        try {
            const csrfTokenValue = await getCsrfToken();
            options.headers = options.headers || {};
            options.headers['x-csrf-token'] = csrfTokenValue;
        } catch (error) {
            logger.error('[send-request] Failed to get CSRF token for upload', { error: error.message }, error);
        }
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

        // Try to extract the actual error message from JSON response
        let errorMessage = `Upload failed: ${res.status} ${res.statusText}`;
        try {
            const errorData = JSON.parse(errorText);
            if (errorData.error) {
                errorMessage = errorData.error;
            }
        } catch {
            // If not JSON, use the text if it's short enough
            if (errorText && errorText.length < 200) {
                errorMessage = errorText;
            }
        }
        throw new Error(errorMessage);
    } catch (error) {
        if (error.name === 'AbortError') {
            logger.error('File upload timed out', { url, method, timeoutMs });
            throw new Error('Upload timed out. Please try again.');
        }
        // Safari often reports network failures as `TypeError: Load failed`
        if (error && error.name === 'TypeError') {
            logger.error('File upload failed', { url, method, error: error.message }, error);
            throw new Error('Network error during upload. Please check your connection and try again.');
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

/**
 * Queued version of sendRequest with rate limiting
 *
 * Uses the RequestQueue to prevent backend overload while maintaining
 * responsive user experience. Critical requests (auth, session) bypass the queue.
 *
 * @param {string} url - The URL to send the request to
 * @param {string} [method="GET"] - HTTP method
 * @param {Object} [payload=null] - Request payload
 * @param {Object} [requestOptions={}] - Additional options
 * @param {number} [requestOptions.priority] - Priority level (use PRIORITY constants)
 * @param {boolean} [requestOptions.critical] - If true, bypasses queue
 * @param {string} [requestOptions.label] - Human-readable label for debugging
 * @returns {Promise<Object>} Response data as JSON
 */
export async function sendQueuedRequest(url, method = "GET", payload = null, requestOptions = {}) {
    // Determine priority based on request type
    const isStateChanging = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method.toUpperCase());

    // Auth and session requests are critical - bypass queue entirely
    const isCritical = url.includes('/api/auth/') ||
                       url.includes('/api/session') ||
                       requestOptions.critical === true;

    if (isCritical) {
        // Critical requests bypass the queue
        logger.debug('[send-request] Critical request - bypassing queue', { url, method });
        return sendRequest(url, method, payload, requestOptions);
    }

    const priority = requestOptions.priority ?? (
        isStateChanging ? PRIORITY.HIGH : PRIORITY.NORMAL
    );

    const queue = getRequestQueue();

    return queue.enqueue(
        () => sendRequest(url, method, payload, requestOptions),
        {
            priority,
            url,
            method,
            payload,
            label: requestOptions.label || url.split('/').slice(-2).join('/'),
            coalesce: method === 'GET' && requestOptions.coalesce !== false,
        }
    );
}

// Re-export PRIORITY for consumers
export { PRIORITY };

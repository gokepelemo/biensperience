import { getToken } from "./users-service"

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
    if (payload) {
        options.headers = { 'Content-Type': 'application/json' };
        options.body = JSON.stringify(payload);
    }
    const token = getToken();
    if (token) {
        options.headers = options.headers || {};
        options.headers.Authorization = `Bearer ${token}`;
    }

    try {
        const res = await fetch(url, options);
        if (res.ok) return res.json();

        // Log detailed error information for debugging
        const errorText = await res.text().catch(() => 'Unable to read error response');
        console.error(`HTTP ${res.status} ${res.statusText}:`, errorText);
        throw new Error(`Request failed: ${res.status} ${res.statusText}`);
    } catch (error) {
        // Handle network errors, CORS issues, etc.
        console.error('Network request failed:', error);
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

        // Log detailed error information for debugging
        const errorText = await res.text().catch(() => 'Unable to read error response');
        console.error(`Upload failed with HTTP ${res.status} ${res.statusText}:`, errorText);
        throw new Error(`Upload failed: ${res.status} ${res.statusText}`);
    } catch (error) {
        // Handle network errors, CORS issues, etc.
        console.error('File upload failed:', error);
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            throw new Error('Network error during upload. Please check your connection and try again.');
        }
        throw error;
    }
}

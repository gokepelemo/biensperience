import * as usersAPI from "./users-api"

/**
 * Signs up a new user and stores their authentication token.
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
    localStorage.setItem('token', token)
    return getUser();
}

/**
 * Retrieves the stored authentication token if it exists and is not expired.
 *
 * @returns {string|null} JWT token string or null if no valid token
 */
export function getToken() {
    const token = localStorage.getItem('token');
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.exp < Date.now() / 1000) {
        localStorage.removeItem('token')
        return null;
    }
    return token;
}

/**
 * Retrieves the current user from the stored JWT token.
 *
 * @returns {Object|null} User object with id, name, email, or null if not authenticated
 */
export function getUser() {
    const token = getToken();
    let user;
    if (token) {
        user = JSON.parse(atob(token.split('.')[1])).user;
        user.experiences = null;
     }
    return token ? user : null;
}

/**
 * Logs out the current user by removing their authentication token.
 */
export function logout() {
    localStorage.removeItem('token');
}

export async function login(credentials) {
    const token = await usersAPI.login(credentials);
    localStorage.setItem('token', token);
    return getUser()
}

export async function checkToken() {
    return usersAPI.checkToken().then(dateStr => new Date(dateStr))
}
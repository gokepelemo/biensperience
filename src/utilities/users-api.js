import { sendRequest } from "./send-request.js";
const BASE_URL = `/api/users/`;

export function signUp(userData) {
  return sendRequest(`${BASE_URL}`, "POST", userData);
}

export function login(credentials) {
  return sendRequest(`${BASE_URL}login`, "POST", credentials);
}

export function checkToken() {
  return sendRequest(`${BASE_URL}check-token`);
}

export async function getUserData(id) {
  return await sendRequest(`${BASE_URL}${id}`, "GET");
}

export async function updateUser(id, userData) {
  return await sendRequest(`${BASE_URL}${id}`, "PUT", userData);
}

export async function searchUsers(query) {
  return await sendRequest(`${BASE_URL}search?q=${encodeURIComponent(query)}`, "GET");
}

export async function updateUserRole(userId, roleData) {
  return await sendRequest(`${BASE_URL}${userId}/role`, "PUT", roleData);
}

export async function getAllUsers() {
  return await sendRequest(`${BASE_URL}all`, "GET");
}

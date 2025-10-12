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

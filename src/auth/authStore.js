import { apiFetch } from "../api/client";

const TOKEN_KEY = "itms_token";
const USER_KEY = "itms_user";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function getStoredUser() {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}
export function setStoredUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}
export function clearStoredUser() {
  localStorage.removeItem(USER_KEY);
}

export async function login({ email, password }) {
  const data = await apiFetch("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
  setToken(data.token);
  setStoredUser(data.user);
  return data.user;
}

export async function register({ username, email, password }) {
  const data = await apiFetch("/api/auth/register", {
    method: "POST",
    body: { username, email, password },
  });
  setToken(data.token);
  setStoredUser(data.user);
  return data.user;
}

export async function fetchMe() {
  const token = getToken();
  if (!token) return null;
  const data = await apiFetch("/api/auth/me", { token });
  setStoredUser(data.user);
  return data.user;
}

export function logout() {
  clearToken();
  clearStoredUser();
}

export async function logoutAsync() {
  return new Promise((resolve) => {
    logout();
    setTimeout(resolve, 0);
  });
}

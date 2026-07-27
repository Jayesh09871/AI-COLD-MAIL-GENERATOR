import axios from 'axios';

// FIX #2b: Normalize VITE_API_URL so trailing slashes / malformed values never
// cause axios to build double-slash paths like /api//auth/register (which CORS
// or routers may reject).  Safe defaults for local dev if env var is missing.
const rawBase = (typeof import.meta.env !== 'undefined' && import.meta.env.VITE_API_URL) || 'http://localhost:5000/api';
const normalizedBase = (() => {
  let s = String(rawBase).trim();
  // Collapse any number of trailing slashes to at most 0 — we let axios join paths cleanly
  s = s.replace(/\/+$/, '');
  // If user accidentally pasted root URL without /api, add it automatically
  if (s && !/\/api\/*$/.test(s) && /^https?:\/\/[^/]+$/.test(s)) {
    s = `${s}/api`;
  }
  return s;
})();

const api = axios.create({
    baseURL: normalizedBase
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default api;
import axios from 'axios';

const BASE_URL = 'http://localhost:8080/api';

// In-memory access token storage (never in localStorage or sessionStorage)
let inMemoryAccessToken = null;

// Subscribers queue for requests awaiting an active token refresh
let isRefreshing = false;
let failedQueue = [];

// Callback for notifying AuthContext when auth expires or refreshes
let authStateListeners = {
  onTokenRefreshed: null,
  onAuthExpired: null,
};

export const setAccessToken = (token) => {
  inMemoryAccessToken = token;
};

export const getAccessToken = () => inMemoryAccessToken;

export const registerAuthListeners = ({ onTokenRefreshed, onAuthExpired }) => {
  authStateListeners.onTokenRefreshed = onTokenRefreshed;
  authStateListeners.onAuthExpired = onAuthExpired;
};

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Main Axios instance
const apiClient = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // Send and receive HttpOnly cookies for refresh & logout
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach Bearer token if present in memory
apiClient.interceptors.request.use(
  (config) => {
    if (inMemoryAccessToken && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${inMemoryAccessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401s and execute single-flight token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Do not attempt refresh on auth endpoints (login, register, refresh, logout)
    const isAuthEndpoint = originalRequest?.url?.includes('/auth/login') ||
                           originalRequest?.url?.includes('/auth/register') ||
                           originalRequest?.url?.includes('/auth/refresh') ||
                           originalRequest?.url?.includes('/auth/logout');

    if (error.response?.status === 401 && !originalRequest?._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        // Queue this request while refresh is in progress
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Call the refresh endpoint directly using a clean request
        const response = await axios.post(
          `${BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        const newAccessToken = response.data?.data?.accessToken;
        const user = response.data?.data?.user;

        setAccessToken(newAccessToken);

        if (authStateListeners.onTokenRefreshed) {
          authStateListeners.onTokenRefreshed(newAccessToken, user);
        }

        processQueue(null, newAccessToken);

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        setAccessToken(null);
        processQueue(refreshError, null);

        if (authStateListeners.onAuthExpired) {
          authStateListeners.onAuthExpired();
        }

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;

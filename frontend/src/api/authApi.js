import apiClient, { setAccessToken } from './axios';

/**
 * Authentication API Service
 * Interacts directly with Spring Boot backend endpoints under /api/auth
 */
export const authApi = {
  /**
   * Log in user or agent
   * @param {Object} credentials { usernameOrEmail, password }
   */
  async login({ usernameOrEmail, password }) {
    const response = await apiClient.post('/auth/login', {
      usernameOrEmail: usernameOrEmail.trim(),
      password,
    });
    const authData = response.data?.data;
    if (authData?.accessToken) {
      setAccessToken(authData.accessToken);
    }
    return authData;
  },

  /**
   * Register a new user (always assigned Role.USER by backend)
   * @param {Object} userData { username, email, password, fullName }
   */
  async register({ username, email, password, fullName }) {
    const response = await apiClient.post('/auth/register', {
      username: username.trim(),
      email: email.trim(),
      password,
      fullName: fullName.trim(),
    });
    return response.data?.data;
  },

  /**
   * Exchange the HttpOnly refresh cookie for a fresh access token & user profile
   */
  async refresh() {
    const response = await apiClient.post('/auth/refresh');
    const authData = response.data?.data;
    if (authData?.accessToken) {
      setAccessToken(authData.accessToken);
    }
    return authData;
  },

  /**
   * Log out and clear the refresh token cookie
   */
  async logout() {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      setAccessToken(null);
    }
  },

  /**
   * Fetch profile for current authenticated user
   */
  async getCurrentUser() {
    const response = await apiClient.get('/auth/me');
    return response.data?.data;
  },
};

export default authApi;
